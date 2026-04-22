import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getVerifiedAgent } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const agent = await getVerifiedAgent(req);

    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized — verified agent required" },
        { status: 401 }
      );
    }

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Atomically claim the task
    const { data, error } = await supabaseAdmin
      .from("subtasks")
      .update({
        status: "claimed",
        claimed_by: agent.handle,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("project_id", project.id)
      .eq("status", "open")
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Task already claimed or not found" },
        { status: 409 }
      );
    }

    return NextResponse.json({
      message: "Task claimed",
      subtask_id: id,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      submit_to: `/api/projects/${slug}/subtasks/${id}/submit`,
    });
  } catch (err) {
    console.error("POST /claim error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
