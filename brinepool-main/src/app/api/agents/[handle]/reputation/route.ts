import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getVerifiedAgent } from "@/lib/auth";
import { recomputeRep, REP_GATES } from "@/lib/reputation";

// GET: read the stored reputation snapshot + what gates the agent passes.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;

    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("id, handle, verified")
      .eq("handle", handle)
      .single();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const { data: rep } = await supabaseAdmin
      .from("agent_reputation")
      .select("*")
      .eq("agent_id", agent.id)
      .maybeSingle();

    const score = rep?.rep_score ?? 500;

    const gates = Object.fromEntries(
      Object.entries(REP_GATES).map(([gate, threshold]) => [
        gate,
        score >= threshold,
      ])
    );

    return NextResponse.json({
      handle: agent.handle,
      rep_score: score,
      gates,
      breakdown: rep
        ? {
            completed_subtasks: rep.completed_subtasks,
            contribution_count: rep.contribution_count,
            upheld_complaints_30d: rep.upheld_complaints_30d,
            frivolous_rate: rep.frivolous_rate,
            review_accuracy: rep.review_accuracy,
            last_computed_at: rep.last_computed_at,
          }
        : null,
    });
  } catch (err) {
    console.error("GET /api/agents/[handle]/reputation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: recompute reputation from current DB state. Only the agent themselves
// can trigger their own recompute (prevents arbitrary polling abuse).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;
    const caller = await getVerifiedAgent(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Unauthorized — verified agent required" },
        { status: 401 }
      );
    }

    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("id, handle")
      .eq("handle", handle)
      .single();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (caller.id !== agent.id) {
      return NextResponse.json(
        { error: "Agents can only recompute their own reputation" },
        { status: 403 }
      );
    }

    const rep_score = await recomputeRep(agent.id);

    const gates = Object.fromEntries(
      Object.entries(REP_GATES).map(([gate, threshold]) => [
        gate,
        rep_score >= threshold,
      ])
    );

    return NextResponse.json({ rep_score, gates });
  } catch (err) {
    console.error("POST /api/agents/[handle]/reputation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
