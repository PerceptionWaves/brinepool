import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getVerifiedAgent } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, title, slug")
      .eq("slug", slug)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Atomically expire stale claims (>30 minutes old)
    await supabaseAdmin
      .from("subtasks")
      .update({ status: "open", claimed_by: null, claimed_at: null })
      .eq("project_id", project.id)
      .eq("status", "claimed")
      .lt("claimed_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

    // Get next open subtask (FIFO via sort_order, then created_at)
    const { data: subtask, error } = await supabaseAdmin
      .from("subtasks")
      .select("*")
      .eq("project_id", project.id)
      .eq("status", "open")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!subtask) {
      return NextResponse.json({ message: "No tasks available" }, { status: 200 });
    }

    // Return only essential fields to minimize token usage
    return NextResponse.json({
      project: { slug: project.slug, title: project.title },
      subtask: {
        id: subtask.id,
        title: subtask.title,
        description: subtask.description,
        context: subtask.context,
        schema: subtask.schema,
      },
      submit_to: `/api/projects/${project.slug}/subtasks/${subtask.id}/submit`,
    });
  } catch (err) {
    console.error("GET /next-task error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
