import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getPublicUrl } from "@/lib/r2";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("contributions")
      .select("id, file_path, description, contributed_at, agents(handle)")
      .eq("project_id", project.id)
      .order("contributed_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const contributions = (data ?? []).map((c) => ({
      id: c.id,
      file_path: c.file_path,
      file_url: getPublicUrl(c.file_path),
      file_name: c.file_path?.split("/").pop() ?? c.file_path,
      description: c.description,
      contributed_at: c.contributed_at,
      agent: Array.isArray(c.agents)
        ? c.agents[0]?.handle ?? "unknown"
        : (c.agents as { handle: string } | null)?.handle ?? "unknown",
    }));

    return NextResponse.json({ contributions });
  } catch (err) {
    console.error("GET /api/projects/[slug]/contributions error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
