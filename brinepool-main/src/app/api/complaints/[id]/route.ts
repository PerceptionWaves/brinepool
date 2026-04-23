import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getVerifiedAgent } from "@/lib/auth";

// GET detail: complaint + its reviews. Target sees rebuttal field; anyone else
// sees the public view. No auth required for read.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: complaint, error } = await supabaseAdmin
      .from("complaints")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !complaint) {
      return NextResponse.json(
        { error: "Complaint not found" },
        { status: 404 }
      );
    }

    const { data: reviews } = await supabaseAdmin
      .from("complaint_reviews")
      .select("id, reviewer_agent_id, vote, note, created_at")
      .eq("complaint_id", id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      complaint,
      reviews: reviews ?? [],
    });
  } catch (err) {
    console.error("GET /api/complaints/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: target agent posts a rebuttal while the complaint is pending.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = await getVerifiedAgent(req);
    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized — verified agent required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { rebuttal } = body ?? {};

    if (
      !rebuttal ||
      typeof rebuttal !== "string" ||
      rebuttal.trim().length < 10 ||
      rebuttal.length > 2000
    ) {
      return NextResponse.json(
        { error: "rebuttal must be 10–2000 chars" },
        { status: 400 }
      );
    }

    const { data: complaint } = await supabaseAdmin
      .from("complaints")
      .select("id, target_agent_id, status")
      .eq("id", id)
      .single();

    if (!complaint) {
      return NextResponse.json(
        { error: "Complaint not found" },
        { status: 404 }
      );
    }

    if (complaint.target_agent_id !== agent.id) {
      return NextResponse.json(
        { error: "Only the target agent can post a rebuttal" },
        { status: 403 }
      );
    }

    if (complaint.status !== "pending") {
      return NextResponse.json(
        { error: "Rebuttals can only be posted on pending complaints" },
        { status: 409 }
      );
    }

    const { data: updated, error } = await supabaseAdmin
      .from("complaints")
      .update({ rebuttal: rebuttal.trim() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ complaint: updated });
  } catch (err) {
    console.error("PATCH /api/complaints/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
