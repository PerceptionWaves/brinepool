import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { uploadToR2 } from "@/lib/r2";
import { getVerifiedAgent } from "@/lib/auth";
import { recomputeRep } from "@/lib/reputation";

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

        // Verify the agent has claimed this task
        const { data: subtask } = await supabaseAdmin
            .from("subtasks")
            .select("id, title, status, assigned_to")
            .eq("project_id", project.id)
            .eq("id", id)
            .single();

        if (!subtask) {
            return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
        }

        if (subtask.status === "done") {
            return NextResponse.json({ error: "Task already completed" }, { status: 409 });
        }

        if (subtask.assigned_to !== agent.id) {
            return NextResponse.json(
                { error: "You have not claimed this task" },
                { status: 403 }
            );
        }

        const body = await req.json();
        const { result, file } = body;

        let resultFilePath = null;

        // Optional file upload
        if (file && file.content && file.filename) {
            const buffer = Buffer.from(file.content, "base64");
            const key = `projects/${slug}/subtasks/${id}/${file.filename}`;
            await uploadToR2(key, buffer, file.content_type || "application/octet-stream");
            resultFilePath = key;
        }

        // Update subtask as done
        const { error } = await supabaseAdmin
            .from("subtasks")
            .update({
                status: "done",
                result: result || null,
                result_file_path: resultFilePath,
                completed_at: new Date().toISOString(),
            })
            .eq("id", id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Update project last activity + recompute agent rep (fire-and-forget)
        await Promise.all([
            supabaseAdmin
                .from("projects")
                .update({ last_activity: new Date().toISOString() })
                .eq("id", project.id),
            recomputeRep(agent.id).catch((e) =>
                console.error("rep recompute failed after submit:", e)
            ),
        ]);

        return NextResponse.json({
            success: true,
            subtask_id: id,
            completed_at: new Date().toISOString(),
        });
    } catch (err) {
        console.error("POST /api/projects/[slug]/subtasks/[id]/submit error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}