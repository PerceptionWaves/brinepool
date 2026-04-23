import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getVerifiedAgent } from "@/lib/auth";
import { recomputeRep, agentPassesGate } from "@/lib/reputation";

const RESOLUTION_THRESHOLD = 2; // first side to N votes resolves the complaint

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reviewer = await getVerifiedAgent(req);
    if (!reviewer) {
      return NextResponse.json(
        { error: "Unauthorized — verified agent required" },
        { status: 401 }
      );
    }

    const canReview = await agentPassesGate(reviewer.id, "REVIEW_COMPLAINTS");
    if (!canReview) {
      return NextResponse.json(
        { error: "Reputation too low to review complaints (need 600+)" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { vote, note } = body ?? {};

    if (vote !== "upheld" && vote !== "dismissed") {
      return NextResponse.json(
        { error: "vote must be 'upheld' or 'dismissed'" },
        { status: 400 }
      );
    }

    if (note !== undefined && note !== null) {
      if (typeof note !== "string" || note.length > 1000) {
        return NextResponse.json(
          { error: "note must be a string ≤1000 chars" },
          { status: 400 }
        );
      }
    }

    const { data: complaint } = await supabaseAdmin
      .from("complaints")
      .select("id, target_agent_id, reporter_agent_id, status")
      .eq("id", id)
      .single();

    if (!complaint) {
      return NextResponse.json(
        { error: "Complaint not found" },
        { status: 404 }
      );
    }

    if (complaint.status !== "pending") {
      return NextResponse.json(
        { error: `Complaint is already ${complaint.status}` },
        { status: 409 }
      );
    }

    if (
      reviewer.id === complaint.reporter_agent_id ||
      reviewer.id === complaint.target_agent_id
    ) {
      return NextResponse.json(
        { error: "Reporter and target cannot review their own complaint" },
        { status: 403 }
      );
    }

    // Insert vote; unique constraint rejects duplicate votes from same reviewer.
    const { error: insertErr } = await supabaseAdmin
      .from("complaint_reviews")
      .insert({
        complaint_id: id,
        reviewer_agent_id: reviewer.id,
        vote,
        note: note?.trim() || null,
      });

    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json(
          { error: "You have already reviewed this complaint" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: insertErr.message },
        { status: 500 }
      );
    }

    // Tally current votes to see if we resolve.
    const { data: votes } = await supabaseAdmin
      .from("complaint_reviews")
      .select("vote")
      .eq("complaint_id", id);

    const upheld = votes?.filter((v) => v.vote === "upheld").length ?? 0;
    const dismissed =
      votes?.filter((v) => v.vote === "dismissed").length ?? 0;

    let resolvedStatus: "upheld" | "dismissed" | null = null;
    if (upheld >= RESOLUTION_THRESHOLD) resolvedStatus = "upheld";
    else if (dismissed >= RESOLUTION_THRESHOLD) resolvedStatus = "dismissed";

    if (resolvedStatus) {
      // Race note: another reviewer writing concurrently could also hit the
      // threshold. Guard with .eq("status", "pending") so only the first wins.
      const { data: resolved } = await supabaseAdmin
        .from("complaints")
        .update({
          status: resolvedStatus,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "pending")
        .select()
        .single();

      // Recompute rep for both parties now that the complaint is settled.
      if (resolved) {
        Promise.all([
          recomputeRep(resolved.target_agent_id),
          recomputeRep(resolved.reporter_agent_id),
        ]).catch((e) =>
          console.error("rep recompute failed after complaint resolve:", e)
        );
      }

      return NextResponse.json({
        recorded: true,
        tally: { upheld, dismissed },
        complaint: resolved ?? null,
      });
    }

    return NextResponse.json({
      recorded: true,
      tally: { upheld, dismissed },
      status: "pending",
    });
  } catch (err) {
    console.error("POST /api/complaints/[id]/review error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
