import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getVerifiedAgent } from "@/lib/auth";

const CLAIM_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export async function GET(
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
            .select("id, slug, title")
            .eq("slug", slug)
            .single();

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const now = new Date(Date.now() - CLAIM_TIMEOUT_MS).toISOString();

        // Expire stale claims
        await supabaseAdmin
            .from("subtasks")
            .update({ status: "open", assigned_to: null, claimed_at: null })
            .eq("project_id", project.id)
            .eq("status", "in_progress")
            .lt("claimed_at", now);

        // Get next open subtasks (FIFO). Over-fetch a small batch so we can
        // skip any whose depends_on are unmet.
        const { data: candidates, error } = await supabaseAdmin
            .from("subtasks")
            .select("id, title, description, context, schema, required_capabilities, depends_on")
            .eq("project_id", project.id)
            .eq("status", "open")
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })
            .limit(20);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!candidates || candidates.length === 0) {
            return NextResponse.json({ subtask: null, message: "No open tasks available" });
        }

        // Resolve dependencies only for the candidates we're actually considering.
        const allDeps = Array.from(
            new Set(candidates.flatMap((c) => (c.depends_on as string[]) ?? []))
        );
        const doneDeps = new Set<string>();
        if (allDeps.length > 0) {
            const { data: doneRows } = await supabaseAdmin
                .from("subtasks")
                .select("id")
                .in("id", allDeps)
                .eq("status", "done");
            for (const r of doneRows ?? []) doneDeps.add(r.id);
        }

        const subtask = candidates.find((c) => {
            const deps = (c.depends_on as string[]) ?? [];
            return deps.every((d) => doneDeps.has(d));
        });

        if (!subtask) {
            return NextResponse.json({
                subtask: null,
                message: "All open tasks have unmet dependencies",
            });
        }

        // Parse schema if present
        let parsedSchema = null;
        if (subtask.schema) {
            try {
                parsedSchema = typeof subtask.schema === "string"
                    ? JSON.parse(subtask.schema)
                    : subtask.schema;
            } catch {
                parsedSchema = null;
            }
        }

        return NextResponse.json({
            project: {
                slug: project.slug,
                title: project.title,
            },
            subtask: {
                id: subtask.id,
                title: subtask.title,
                description: subtask.description,
                context: subtask.context || null,
                schema: parsedSchema,
                required_capabilities: subtask.required_capabilities ?? [],
            },
            submit_to: `/api/projects/${slug}/subtasks/${subtask.id}/submit`,
        });
    } catch (err) {
        console.error("GET /api/projects/[slug]/next-task error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
