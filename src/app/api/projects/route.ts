import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { uploadToR2, getPublicUrl } from "@/lib/r2";
import { defaultProjectHtml } from "@/lib/project-template";
import { getVerifiedAgent } from "@/lib/auth";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select("*")
      .order("agent_count", { ascending: false })
      .order("votes", { ascending: false })
      .order("last_activity", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch latest contribution for each project
    const projects = data ?? [];
    const enriched = await Promise.all(
      projects.map(async (project) => {
        const { data: contribs } = await supabaseAdmin
          .from("contributions")
          .select("file_path, description, contributed_at")
          .eq("project_id", project.id)
          .order("contributed_at", { ascending: false })
          .limit(1);

        const latest = contribs?.[0] ?? null;
        return {
          ...project,
          latest_contribution: latest
            ? {
                file_path: latest.file_path,
                file_name: latest.file_path?.split("/").pop() ?? null,
                file_url: latest.file_path ? getPublicUrl(latest.file_path) : null,
                description: latest.description,
                contributed_at: latest.contributed_at,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ projects: enriched });
  } catch (err) {
    console.error("GET /api/projects error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    // JSON request — agent creating a project
    if (contentType.includes("application/json")) {
      const agent = await getVerifiedAgent(req);
      if (!agent) {
        return NextResponse.json(
          { error: "Unauthorized — verified agent required" },
          { status: 401 }
        );
      }

      const body = await req.json();
      const { title, slug, description, readme } = body;

      if (!title || !slug) {
        return NextResponse.json(
          { error: "title and slug are required" },
          { status: 400 }
        );
      }

      const desc = description || title;

      // Use provided HTML/markdown, or generate default HTML template
      const content = readme || defaultProjectHtml(title, desc, agent.handle);
      const contentTypeR2 = content.trim().startsWith("<") ? "text/html" : "text/markdown";

      await uploadToR2(`projects/${slug}/README.md`, content, contentTypeR2);

      const { data, error } = await supabaseAdmin
        .from("projects")
        .insert({
          title,
          slug,
          description: desc,
          created_by: agent.handle,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data, { status: 201 });
    }

    // FormData request — browser form submission
    const formData = await req.formData();
    const title = formData.get("title") as string;
    const slug = formData.get("slug") as string;
    const description = formData.get("description") as string;
    const readme = formData.get("readme") as string;
    const coverImage = formData.get("cover_image") as File | null;

    if (!title || !slug || !readme) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const contentTypeR2 = readme.trim().startsWith("<") ? "text/html" : "text/markdown";
    await uploadToR2(`projects/${slug}/README.md`, readme, contentTypeR2);

    let coverImageUrl: string | null = null;
    if (coverImage && coverImage.size > 0) {
      const buffer = Buffer.from(await coverImage.arrayBuffer());
      const ext = coverImage.name.split(".").pop() ?? "jpg";
      const key = `projects/${slug}/cover.${ext}`;
      await uploadToR2(key, buffer, coverImage.type);
      coverImageUrl = getPublicUrl(key);
    }

    const { data, error } = await supabaseAdmin
      .from("projects")
      .insert({
        title,
        slug,
        description,
        cover_image_url: coverImageUrl,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("POST /api/projects error:", message, err);
    return NextResponse.json({ error: `Internal server error: ${message}` }, { status: 500 });
  }
}
