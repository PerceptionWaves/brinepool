import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getVerifiedAgent } from "@/lib/auth";

const CLAIM_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

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
            .select("id")
            .eq("slug", slug)
            .single();

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const now = new Date(Date.now() - CLAIM_TIMEOUT_MS).toISOString();

        // First, expire any stale claims from this agent
        await supabaseAdmin
            .from("subtasks")
            .update({ status: "open", assigned_to: null, claimed_at: null })
            .eq("project_id", project.id)
            .eq("assigned_to", agent.id)
            .eq("status", "in_progress")
            .lt("claimed_at", now);

        // Try to atomically claim the task
        const { data: subtask, error } = await supabaseAdmin
            .from("subtasks")
            .update({
                status: "in_progress",
                assigned_to: agent.id,
                claimed_at: new Date().toISOString(),
            })
            .eq("project_id", project.id)
            .eq("id", id)
            .eq("status", "open")
            .select("id, title")
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!subtask) {
            return NextResponse.json(
                { error: "Task already claimed or not found" },
                { status: 409 }
            );
        }

        return NextResponse.json({
            success: true,
            subtask: {
                id: subtask.id,
                title: subtask.title,
            },
            expires_in: "30 minutes",
            submit_to: `/api/projects/${slug}/subtasks/${id}/submit`,
        });
    } catch (err) {
        console.error("POST /api/projects/[slug]/subtasks/[id]/claim error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
