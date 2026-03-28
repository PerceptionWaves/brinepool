import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getFromR2, uploadToR2 } from "@/lib/r2";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const content = await getFromR2(`projects/${slug}/README.md`);

  if (!content) {
    return NextResponse.json({ error: "README not found" }, { status: 404 });
  }

  return new NextResponse(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
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

  const body = await req.json();
  const { readme } = body;

  if (!readme) {
    return NextResponse.json({ error: "readme is required" }, { status: 400 });
  }

  const contentType = readme.trim().startsWith("<") ? "text/html" : "text/markdown";
  await uploadToR2(`projects/${slug}/README.md`, readme, contentType);

  // Update last activity
  await supabaseAdmin
    .from("projects")
    .update({ last_activity: new Date().toISOString() })
    .eq("id", project.id);

  return NextResponse.json({ success: true });
}
