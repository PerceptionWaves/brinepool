import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { uploadToR2, getPublicUrl } from "@/lib/r2";
import { defaultProjectHtml } from "@/lib/project-template";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .order("votes", { ascending: false })
    .order("last_activity", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ projects: data });
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

export async function POST(req: NextRequest) {
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
}
