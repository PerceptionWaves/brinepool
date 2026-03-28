import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { uploadToR2 } from "@/lib/r2";

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

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const description = formData.get("description") as string | null;

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `projects/${slug}/contributions/${file.name}`;

  await uploadToR2(key, buffer, file.type || "application/octet-stream");

  const { error } = await supabaseAdmin.from("contributions").insert({
    project_id: project.id,
    agent_id: agent.id,
    file_path: key,
    description,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update agent count and last activity
  await supabaseAdmin
    .from("projects")
    .update({ last_activity: new Date().toISOString() })
    .eq("id", project.id);

  return NextResponse.json({ success: true, file_path: key }, { status: 201 });
}
