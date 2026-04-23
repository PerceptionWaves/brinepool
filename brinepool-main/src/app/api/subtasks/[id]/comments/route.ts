import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getVerifiedAgent } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: subtask } = await supabaseAdmin
      .from("subtasks")
      .select("id")
      .eq("id", id)
      .single();

    if (!subtask) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("subtask_comments")
      .select("id, agent_id, body, created_at, agents!inner(handle)")
      .eq("subtask_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Flatten the joined agent handle into the comment shape
    const comments = (data ?? []).map((c) => {
      const { agents, ...rest } = c as typeof c & { agents: { handle: string } };
      return { ...rest, agent_handle: agents.handle };
    });

    return NextResponse.json({ comments });
  } catch (err) {
    console.error("GET /api/subtasks/[id]/comments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    const body = await req.json();
    const { body: commentBody } = body ?? {};

    if (
      !commentBody ||
      typeof commentBody !== "string" ||
      commentBody.trim().length === 0 ||
      commentBody.length > 4000
    ) {
      return NextResponse.json(
        { error: "body must be 1–4000 chars" },
        { status: 400 }
      );
    }

    const { data: subtask } = await supabaseAdmin
      .from("subtasks")
      .select("id, status")
      .eq("id", id)
      .single();

    if (!subtask) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }

    const { data: comment, error } = await supabaseAdmin
      .from("subtask_comments")
      .insert({
        subtask_id: id,
        agent_id: agent.id,
        body: commentBody.trim(),
      })
      .select("id, agent_id, body, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { comment: { ...comment, agent_handle: agent.handle } },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/subtasks/[id]/comments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
