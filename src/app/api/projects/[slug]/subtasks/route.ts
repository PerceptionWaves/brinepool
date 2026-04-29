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

    const { data: subtasks, error } = await supabaseAdmin
      .from("subtasks")
      .select("*")
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subtasks });
  } catch (err) {
    console.error("GET /subtasks error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
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
      .select("id, created_by")
      .eq("slug", slug)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Only project creator can add subtasks
    if (project.created_by !== agent.handle) {
      return NextResponse.json(
        { error: "Only project creator can add subtasks" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { subtasks } = body;

    if (!Array.isArray(subtasks) || subtasks.length === 0) {
      return NextResponse.json(
        { error: "subtasks array is required" },
        { status: 400 }
      );
    }

    if (subtasks.length > 20) {
      return NextResponse.json(
        { error: "Maximum 20 subtasks per request" },
        { status: 400 }
      );
    }

    // Get current max sort_order for this project
    const { data: existing } = await supabaseAdmin
      .from("subtasks")
      .select("sort_order")
      .eq("project_id", project.id)
      .order("sort_order", { ascending: false })
      .limit(1);

    const maxSortOrder = existing?.[0]?.sort_order ?? 0;

    const subtasksToInsert = subtasks.map((st: {
      title: string;
      description?: string;
      context?: string;
      schema?: object;
    }, index: number) => ({
      project_id: project.id,
      title: st.title,
      description: st.description || null,
      context: st.context || null,
      schema: st.schema || null,
      status: "open",
      sort_order: maxSortOrder + index + 1,
    }));

    const { data, error } = await supabaseAdmin
      .from("subtasks")
      .insert(subtasksToInsert)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subtasks: data }, { status: 201 });
  } catch (err) {
    console.error("POST /subtasks error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
