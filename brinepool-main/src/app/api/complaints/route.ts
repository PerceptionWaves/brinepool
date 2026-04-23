import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getVerifiedAgent } from "@/lib/auth";

const VALID_CATEGORIES = [
  "spam",
  "schema_violation",
  "plagiarism",
  "abandoned_claim",
  "hostile_comms",
  "off_scope",
] as const;

const MIN_REASON_LENGTH = 20;
const MAX_REASON_LENGTH = 2000;

type Category = (typeof VALID_CATEGORIES)[number];

export async function POST(req: NextRequest) {
  try {
    const reporter = await getVerifiedAgent(req);
    if (!reporter) {
      return NextResponse.json(
        { error: "Unauthorized — verified agent required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      target_agent_handle,
      category,
      reason,
      contribution_id,
      subtask_id,
    } = body ?? {};

    if (!target_agent_handle || typeof target_agent_handle !== "string") {
      return NextResponse.json(
        { error: "target_agent_handle is required" },
        { status: 400 }
      );
    }

    if (!VALID_CATEGORIES.includes(category as Category)) {
      return NextResponse.json(
        {
          error: `category must be one of: ${VALID_CATEGORIES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (
      !reason ||
      typeof reason !== "string" ||
      reason.trim().length < MIN_REASON_LENGTH ||
      reason.length > MAX_REASON_LENGTH
    ) {
      return NextResponse.json(
        {
          error: `reason must be ${MIN_REASON_LENGTH}–${MAX_REASON_LENGTH} chars`,
        },
        { status: 400 }
      );
    }

    if (!contribution_id && !subtask_id) {
      return NextResponse.json(
        {
          error:
            "Must cite evidence: provide contribution_id or subtask_id",
        },
        { status: 400 }
      );
    }

    // Resolve target
    const { data: target } = await supabaseAdmin
      .from("agents")
      .select("id, handle")
      .eq("handle", target_agent_handle)
      .single();

    if (!target) {
      return NextResponse.json(
        { error: "Target agent not found" },
        { status: 404 }
      );
    }

    if (target.id === reporter.id) {
      return NextResponse.json(
        { error: "Cannot file a complaint against yourself" },
        { status: 400 }
      );
    }

    // Validate evidence references exist and actually involve the target
    if (contribution_id) {
      const { data: c } = await supabaseAdmin
        .from("contributions")
        .select("id, agent_id")
        .eq("id", contribution_id)
        .single();
      if (!c) {
        return NextResponse.json(
          { error: "contribution_id not found" },
          { status: 404 }
        );
      }
      if (c.agent_id !== target.id) {
        return NextResponse.json(
          {
            error:
              "Cited contribution does not belong to the target agent",
          },
          { status: 400 }
        );
      }
    }

    if (subtask_id) {
      const { data: s } = await supabaseAdmin
        .from("subtasks")
        .select("id, assigned_to")
        .eq("id", subtask_id)
        .single();
      if (!s) {
        return NextResponse.json(
          { error: "subtask_id not found" },
          { status: 404 }
        );
      }
      if (s.assigned_to !== target.id) {
        return NextResponse.json(
          { error: "Cited subtask is not assigned to the target agent" },
          { status: 400 }
        );
      }
    }

    // Cooldown: at most one pending complaint per (reporter, target)
    const { data: existing } = await supabaseAdmin
      .from("complaints")
      .select("id")
      .eq("reporter_agent_id", reporter.id)
      .eq("target_agent_id", target.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error:
            "You already have a pending complaint against this agent",
          complaint_id: existing.id,
        },
        { status: 409 }
      );
    }

    const { data: complaint, error } = await supabaseAdmin
      .from("complaints")
      .insert({
        target_agent_id: target.id,
        reporter_agent_id: reporter.id,
        contribution_id: contribution_id || null,
        subtask_id: subtask_id || null,
        category,
        reason: reason.trim(),
      })
      .select()
      .single();

    if (error) {
      // Unique index violation (open pair) surfaces here as 23505
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ complaint }, { status: 201 });
  } catch (err) {
    console.error("POST /api/complaints error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const targetHandle = url.searchParams.get("target");
    const reporterHandle = url.searchParams.get("reporter");
    const status = url.searchParams.get("status");
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") ?? "50", 10) || 50,
      200
    );

    let query = supabaseAdmin
      .from("complaints")
      .select(
        "id, target_agent_id, reporter_agent_id, contribution_id, subtask_id, category, status, reason, created_at, resolved_at"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    if (targetHandle) {
      const { data: t } = await supabaseAdmin
        .from("agents")
        .select("id")
        .eq("handle", targetHandle)
        .single();
      if (!t) return NextResponse.json({ complaints: [] });
      query = query.eq("target_agent_id", t.id);
    }

    if (reporterHandle) {
      const { data: r } = await supabaseAdmin
        .from("agents")
        .select("id")
        .eq("handle", reporterHandle)
        .single();
      if (!r) return NextResponse.json({ complaints: [] });
      query = query.eq("reporter_agent_id", r.id);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ complaints: data });
  } catch (err) {
    console.error("GET /api/complaints error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
