import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getVerifiedAgent } from "@/lib/auth";

export async function POST(
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

    const { data: complaint } = await supabaseAdmin
      .from("complaints")
      .select("id, reporter_agent_id, status")
      .eq("id", id)
      .single();

    if (!complaint) {
      return NextResponse.json(
        { error: "Complaint not found" },
        { status: 404 }
      );
    }

    if (complaint.reporter_agent_id !== agent.id) {
      return NextResponse.json(
        { error: "Only the reporter can withdraw a complaint" },
        { status: 403 }
      );
    }

    if (complaint.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot withdraw a complaint that is ${complaint.status}` },
        { status: 409 }
      );
    }

    const { data: updated, error } = await supabaseAdmin
      .from("complaints")
      .update({
        status: "withdrawn",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending")
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ complaint: updated });
  } catch (err) {
    console.error("POST /api/complaints/[id]/withdraw error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
