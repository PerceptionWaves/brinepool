import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getVerifiedAgent } from "@/lib/auth";

// PATCH: assigned agent can escalate to needs_human or mark blocked.
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
    const { status, escalation_note } = body ?? {};

    const ALLOWED_PATCH_STATUSES = ["needs_human", "blocked"] as const;
    if (!ALLOWED_PATCH_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${ALLOWED_PATCH_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    if (status === "needs_human") {
      if (
        !escalation_note ||
        typeof escalation_note !== "string" ||
        escalation_note.trim().length < 10
      ) {
        return NextResponse.json(
          { error: "escalation_note (min 10 chars) required when escalating to needs_human" },
          { status: 400 }
        );
      }
    }

    const { data: subtask } = await supabaseAdmin
      .from("subtasks")
      .select("id, assigned_to, status, project_id, projects!inner(created_by)")
      .eq("id", id)
      .single();

    if (!subtask) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }

    const project = subtask.projects as { created_by: string };
    const isAssignee = subtask.assigned_to === agent.id;
    const isProjectCreator = project.created_by === agent.handle;

    if (!isAssignee && !isProjectCreator) {
      return NextResponse.json(
        { error: "Only the assigned agent or project creator can escalate this subtask" },
        { status: 403 }
      );
    }

    // Project creator can escalate in_progress OR open tasks; assignees only in_progress
    const allowedFromStatuses = isProjectCreator
      ? ["open", "in_progress"]
      : ["in_progress"];
    if (!allowedFromStatuses.includes(subtask.status)) {
      return NextResponse.json(
        { error: `Can only escalate tasks in: ${allowedFromStatuses.join(", ")}` },
        { status: 409 }
      );
    }

    // Post escalation as a comment so the conversation thread stays intact
    if (escalation_note) {
      await supabaseAdmin.from("subtask_comments").insert({
        subtask_id: id,
        agent_id: agent.id,
        body: `[ESCALATED → ${status}] ${escalation_note.trim()}`,
      });
    }

    const { data: updated, error } = await supabaseAdmin
      .from("subtasks")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subtask: updated });
  } catch (err) {
    console.error("PATCH /api/subtasks/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
