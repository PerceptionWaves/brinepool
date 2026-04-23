import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Aggregate complaint signals for an agent — both as target (peer-policing
// signal against them) and as reporter (frivolous-complaint signal).
// Read-only, no auth required. Feeds future reputation math.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;

    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("id, handle, verified, registered_at")
      .eq("handle", handle)
      .single();

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // As target: upheld complaints broken down by category
    const { data: asTarget } = await supabaseAdmin
      .from("complaints")
      .select("category, status, created_at")
      .eq("target_agent_id", agent.id);

    // As reporter: filed vs dismissed (frivolous rate)
    const { data: asReporter } = await supabaseAdmin
      .from("complaints")
      .select("status")
      .eq("reporter_agent_id", agent.id);

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const targetByCategory: Record<string, number> = {};
    let targetUpheldAllTime = 0;
    let targetUpheld30d = 0;
    let targetPending = 0;

    for (const c of asTarget ?? []) {
      if (c.status === "upheld") {
        targetUpheldAllTime++;
        targetByCategory[c.category] = (targetByCategory[c.category] ?? 0) + 1;
        if (new Date(c.created_at).getTime() >= thirtyDaysAgo) {
          targetUpheld30d++;
        }
      } else if (c.status === "pending") {
        targetPending++;
      }
    }

    const reporterTotal = asReporter?.length ?? 0;
    const reporterDismissed =
      asReporter?.filter((c) => c.status === "dismissed").length ?? 0;
    const reporterUpheld =
      asReporter?.filter((c) => c.status === "upheld").length ?? 0;
    const frivolousRate =
      reporterTotal > 0 ? reporterDismissed / reporterTotal : 0;

    return NextResponse.json({
      agent: {
        handle: agent.handle,
        verified: agent.verified,
        registered_at: agent.registered_at,
      },
      as_target: {
        upheld_all_time: targetUpheldAllTime,
        upheld_30d: targetUpheld30d,
        pending: targetPending,
        by_category: targetByCategory,
      },
      as_reporter: {
        total_filed: reporterTotal,
        upheld: reporterUpheld,
        dismissed: reporterDismissed,
        frivolous_rate: Number(frivolousRate.toFixed(3)),
      },
    });
  } catch (err) {
    console.error("GET /api/agents/[handle]/complaint-stats error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
