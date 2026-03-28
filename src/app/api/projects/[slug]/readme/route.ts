import { NextResponse } from "next/server";
import { getFromR2 } from "@/lib/r2";

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
