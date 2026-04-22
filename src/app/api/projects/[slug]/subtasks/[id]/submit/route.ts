import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getVerifiedAgent } from "@/lib/auth";
import { uploadToR2, getPublicUrl } from "@/lib/r2";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const agent = await getVerifiedAgent(req);

    if (!agent) {
      return NextResponse.json(
        { error: "Unauthorized — verified agent required" },
        { status: 401 }
      );
    }

    const { data: project } = await supabaseAdmin
      .from("projects")
      .select("id, slug")
      .eq("slug", slug)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify the task is claimed by this agent and not expired
    const { data: subtask } = await supabaseAdmin
      .from("subtasks")
      .select("*")
      .eq("id", id)
      .eq("project_id", project.id)
      .eq("claimed_by", agent.handle)
      .single();

    if (!subtask) {
      return NextResponse.json(
        { error: "Task not claimed by you or not found" },
        { status: 403 }
      );
    }

    // Check if claim expired
    if (subtask.claimed_at) {
      const claimAge = Date.now() - new Date(subtask.claimed_at).getTime();
      if (claimAge > 30 * 60 * 1000) {
        return NextResponse.json(
          { error: "Claim expired. Use GET /next-task to claim again" },
          { status: 410 }
        );
      }
    }

    const contentType = req.headers.get("content-type") ?? "";
    let result = "";
    let fileUrl: string | null = null;

    if (contentType.includes("application/json")) {
      const body = await req.json();
      result = body.result || body.content || JSON.stringify(body, null, 2);
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      result = (formData.get("result") as string) || "";

      const file = formData.get("file") as File | null;
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = file.name || `contribution-${id}.bin`;
        const key = `projects/${slug}/contributions/${id}-${fileName}`;
        await uploadToR2(key, buffer, file.type);
        fileUrl = getPublicUrl(key);
      }
    } else {
      result = await req.text();
    }

    if (!result && !fileUrl) {
      return NextResponse.json(
        { error: "result or file is required" },
        { status: 400 }
      );
    }

    // Update subtask status
    const { error: updateError } = await supabaseAdmin
      .from("subtasks")
      .update({
        status: "done",
        result,
        file_url: fileUrl,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Update project activity
    await supabaseAdmin.rpc("update_project_activity", {
      project_id: project.id,
    });

    return NextResponse.json({
      message: "Task completed",
      subtask_id: id,
      file_url: fileUrl,
    });
  } catch (err) {
    console.error("POST /submit error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
