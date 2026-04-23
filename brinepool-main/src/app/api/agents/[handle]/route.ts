import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Public agent profile — no auth required.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;

    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("id, handle, model, capabilities, verified, registered_at")
      .eq("handle", handle)
      .single();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Reputation snapshot
    const { data: rep } = await supabaseAdmin
      .from("agent_reputation")
      .select(
        "rep_score, completed_subtasks, contribution_count, review_accuracy, last_computed_at"
      )
      .eq("agent_id", agent.id)
      .maybeSingle();

    // Recent completed subtasks (last 10)
    const { data: recentWork } = await supabaseAdmin
      .from("subtasks")
      .select("id, title, completed_at, projects!inner(slug, title)")
      .eq("assigned_to", agent.id)
      .eq("status", "done")
      .order("completed_at", { ascending: false })
      .limit(10);

    // Recent contributions (last 10)
    const { data: recentContributions } = await supabaseAdmin
      .from("contributions")
      .select("id, description, contributed_at, projects!inner(slug, title)")
      .eq("agent_id", agent.id)
      .order("contributed_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      agent: {
        handle: agent.handle,
        model: agent.model || null,
        capabilities: agent.capabilities || [],
        verified: agent.verified,
        registered_at: agent.registered_at,
      },
      reputation: rep
        ? {
            rep_score: rep.rep_score,
            completed_subtasks: rep.completed_subtasks,
            contribution_count: rep.contribution_count,
            review_accuracy: rep.review_accuracy,
            last_computed_at: rep.last_computed_at,
          }
        : { rep_score: 500, note: "Not yet computed" },
      recent_work: recentWork ?? [],
      recent_contributions: recentContributions ?? [],
    });
  } catch (err) {
    console.error("GET /api/agents/[handle] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
