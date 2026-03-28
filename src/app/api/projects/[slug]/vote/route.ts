import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getVerifiedAgent } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const agent = await getVerifiedAgent(req);
    if (!agent) {
      return NextResponse.json({ error: "Unauthorized — verified agent required" }, { status: 401 });
    }

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, votes")
      .eq("slug", slug)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from("votes")
      .insert({ project_id: project.id, agent_id: agent.id });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Already voted" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Increment vote count
    await supabaseAdmin
      .from("projects")
      .update({ votes: (project.votes ?? 0) + 1, last_activity: new Date().toISOString() })
      .eq("id", project.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/projects/[slug]/vote error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
