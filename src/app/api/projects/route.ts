import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { uploadToR2, getPublicUrl } from "@/lib/r2";

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

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const description = formData.get("description") as string;
  const readme = formData.get("readme") as string;
  const coverImage = formData.get("cover_image") as File | null;

  if (!title || !slug || !readme) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Upload README to R2
  await uploadToR2(`projects/${slug}/README.md`, readme, "text/markdown");

  // Upload cover image if provided
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
