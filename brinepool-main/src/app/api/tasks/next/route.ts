import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getVerifiedAgent } from "@/lib/auth";

const CLAIM_TIMEOUT_MS = 30 * 60 * 1000;

// Cross-project FIFO task dispenser.
// Optional ?capabilities=html,chart.js filter — returns tasks whose
// required_capabilities is a subset of the requesting agent's capabilities.
export async function GET(req: NextRequest) {
  try {
    const agent = await getVerifiedAgent(req);
    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized — verified agent required" },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const capFilter = url.searchParams.get("capabilities");
    const requestedCaps: string[] = capFilter
      ? capFilter.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean)
      : [];

    // Use agent's own capabilities if no override provided
    const agentCaps: string[] = Array.isArray(agent.capabilities)
      ? (agent.capabilities as string[]).map((c: string) => c.toLowerCase())
      : [];
    const effectiveCaps = requestedCaps.length > 0 ? requestedCaps : agentCaps;

    const now = new Date(Date.now() - CLAIM_TIMEOUT_MS).toISOString();

    // Expire stale claims globally (best-effort; per-project routes also do this)
    await supabaseAdmin
      .from("subtasks")
      .update({ status: "open", assigned_to: null, claimed_at: null })
      .eq("status", "in_progress")
      .lt("claimed_at", now);

    // Fetch a batch of open tasks to filter in-process (Supabase can't do
    // jsonb containment queries on arrays well without pg functions, so we
    // over-fetch and filter here).
    const { data: candidates, error } = await supabaseAdmin
      .from("subtasks")
      .select(
        `id, title, description, context, schema, required_capabilities,
         depends_on, sort_order, created_at, project_id,
         projects!inner(slug, title)`
      )
      .eq("status", "open")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!candidates || candidates.length === 0) {
      return NextResponse.json({
        subtask: null,
        message: "No open tasks available across any project",
      });
    }

    // Only fetch the completion status of dependencies that actually appear
    // in our candidate set — NOT all completed subtasks globally.
    const allDepIds = Array.from(
      new Set(
        candidates.flatMap(
          (c) => ((c as { depends_on?: string[] }).depends_on ?? []) as string[]
        )
      )
    );
    const doneDeps = new Set<string>();
    if (allDepIds.length > 0) {
      const { data: doneRows } = await supabaseAdmin
        .from("subtasks")
        .select("id")
        .in("id", allDepIds)
        .eq("status", "done");
      for (const r of doneRows ?? []) doneDeps.add(r.id);
    }

    let chosen = null;
    for (const task of candidates) {
      // Check required_capabilities match
      const required: string[] = Array.isArray(task.required_capabilities)
        ? (task.required_capabilities as string[]).map((c: string) =>
            c.toLowerCase()
          )
        : [];
      if (
        effectiveCaps.length > 0 &&
        required.length > 0 &&
        !required.every((r) => effectiveCaps.includes(r))
      ) {
        continue;
      }

      // Check all depends_on are done
      const deps: string[] =
        (task as { depends_on?: string[] }).depends_on ?? [];
      if (deps.length > 0 && !deps.every((d) => doneDeps.has(d))) {
        continue;
      }

      chosen = task;
      break;
    }

    if (!chosen) {
      return NextResponse.json({
        subtask: null,
        message:
          "No open tasks match your capabilities or all tasks have unmet dependencies",
      });
    }

    const project = chosen.projects as { slug: string; title: string };

    return NextResponse.json({
      project: { slug: project.slug, title: project.title },
      subtask: {
        id: chosen.id,
        title: chosen.title,
        description: chosen.description,
        context: chosen.context || null,
        schema: chosen.schema || null,
        required_capabilities: chosen.required_capabilities || [],
      },
      claim_url: `/api/projects/${project.slug}/subtasks/${chosen.id}/claim`,
      submit_url: `/api/projects/${project.slug}/subtasks/${chosen.id}/submit`,
    });
  } catch (err) {
    console.error("GET /api/tasks/next error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}