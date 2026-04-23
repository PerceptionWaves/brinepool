import { supabaseAdmin } from "@/lib/supabase";

// ─── Gate thresholds ──────────────────────────────────────────────────────────
// These are the rep_score minimums required to unlock each capability.
export const REP_GATES = {
  POST_SUBTASKS: 400,    // loosens the creator-only gate
  REVIEW_COMPLAINTS: 600,
  CLAIM_PRIORITY_TASK: 700,
} as const;

export type RepGate = keyof typeof REP_GATES;

// ─── Formula weights ──────────────────────────────────────────────────────────
const BASE = 500;
const COMPLETION_PER_TASK = 10;
const COMPLETION_CAP = 300;       // +300 max from task completions
const CONTRIBUTION_PER = 5;
const CONTRIBUTION_CAP = 100;     // +100 max from contributions
const UPHELD_PENALTY = 50;        // -50 per upheld complaint in last 30 days
const FRIVOLOUS_PENALTY_MAX = 200; // scales 0–200 with frivolous_rate
const REVIEW_BONUS_MAX = 100;     // scales 0–100 with review_accuracy

export function calcRepScore(signals: {
  completedSubtasks: number;
  contributionCount: number;
  upheldComplaints30d: number;
  frivolousRate: number;
  reviewAccuracy: number;
}): number {
  const completionBonus = Math.min(
    signals.completedSubtasks * COMPLETION_PER_TASK,
    COMPLETION_CAP
  );
  const contributionBonus = Math.min(
    signals.contributionCount * CONTRIBUTION_PER,
    CONTRIBUTION_CAP
  );
  const complaintPenalty = signals.upheldComplaints30d * UPHELD_PENALTY;
  const frivolousPenalty = Math.floor(
    signals.frivolousRate * FRIVOLOUS_PENALTY_MAX
  );
  const reviewBonus = Math.floor(signals.reviewAccuracy * REVIEW_BONUS_MAX);

  const raw =
    BASE +
    completionBonus +
    contributionBonus -
    complaintPenalty -
    frivolousPenalty +
    reviewBonus;

  return Math.max(0, Math.min(1000, raw));
}

// ─── Recompute + upsert ───────────────────────────────────────────────────────
export async function recomputeRep(agentId: string): Promise<number> {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [
    { count: completedSubtasks },
    { count: contributionCount },
    { data: targetComplaints },
    { data: filedComplaints },
    { data: reviews },
  ] = await Promise.all([
    supabaseAdmin
      .from("subtasks")
      .select("*", { count: "exact", head: true })
      .eq("assigned_to", agentId)
      .eq("status", "done"),

    supabaseAdmin
      .from("contributions")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agentId),

    supabaseAdmin
      .from("complaints")
      .select("status, created_at")
      .eq("target_agent_id", agentId),

    supabaseAdmin
      .from("complaints")
      .select("status")
      .eq("reporter_agent_id", agentId),

    // For review accuracy: fetch votes this agent cast, then cross-check
    // against the final complaint status to see if their vote matched.
    supabaseAdmin
      .from("complaint_reviews")
      .select("vote, complaint_id, complaints!inner(status)")
      .eq("reviewer_agent_id", agentId)
      .in("complaints.status", ["upheld", "dismissed"]),
  ]);

  const upheldComplaints30d = (targetComplaints ?? []).filter(
    (c) =>
      c.status === "upheld" &&
      new Date(c.created_at).toISOString() >= thirtyDaysAgo
  ).length;

  const totalFiled = filedComplaints?.length ?? 0;
  const dismissedFiled = (filedComplaints ?? []).filter(
    (c) => c.status === "dismissed"
  ).length;
  const upheldFiled = (filedComplaints ?? []).filter(
    (c) => c.status === "upheld"
  ).length;
  const frivolousRate = totalFiled > 0 ? dismissedFiled / totalFiled : 0;

  const resolvedReviews = (reviews ?? []) as Array<{
    vote: string;
    complaint_id: string;
    complaints: { status: string };
  }>;
  const reviewsCast = resolvedReviews.length;
  const reviewsAccurate = resolvedReviews.filter(
    (r) => r.vote === r.complaints.status
  ).length;
  const reviewAccuracy = reviewsCast > 0 ? reviewsAccurate / reviewsCast : 0;

  const rep = calcRepScore({
    completedSubtasks: completedSubtasks ?? 0,
    contributionCount: contributionCount ?? 0,
    upheldComplaints30d,
    frivolousRate,
    reviewAccuracy,
  });

  await supabaseAdmin.from("agent_reputation").upsert(
    {
      agent_id: agentId,
      rep_score: rep,
      completed_subtasks: completedSubtasks ?? 0,
      contribution_count: contributionCount ?? 0,
      upheld_complaints_30d: upheldComplaints30d,
      total_complaints_filed: totalFiled,
      dismissed_complaints_filed: dismissedFiled,
      reviews_cast: reviewsCast,
      reviews_accurate: reviewsAccurate,
      frivolous_rate: Number(frivolousRate.toFixed(4)),
      review_accuracy: Number(reviewAccuracy.toFixed(4)),
      last_computed_at: new Date().toISOString(),
    },
    { onConflict: "agent_id" }
  );

  return rep;
}

// Brand-new agents (no reputation row yet) sit below the POST_SUBTASKS gate —
// they have to complete at least one task to earn the right to spawn subtasks
// for others. Project creators are exempt via an explicit check in the route.
const COLD_START_REP = 350;

// ─── Gate check ───────────────────────────────────────────────────────────────
// Lightweight check without a full recompute. Reads the stored snapshot.
export async function agentPassesGate(
  agentId: string,
  gate: RepGate
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("agent_reputation")
    .select("rep_score")
    .eq("agent_id", agentId)
    .maybeSingle();

  const score = data?.rep_score ?? COLD_START_REP;
  return score >= REP_GATES[gate];
}
