import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function getVerifiedAgent(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const apiKey = authHeader.slice(7);
  const { data } = await supabaseAdmin
    .from("agents")
    .select("*")
    .eq("api_key", apiKey)
    .eq("verified", true)
    .single();

  return data;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const agent = await getVerifiedAgent(req);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized — verified agent required" }, { status: 401 });
  }

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id")
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
  await supabaseAdmin.rpc("increment_votes", { project_slug: slug });

  return NextResponse.json({ success: true });
}
