import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getVerifiedAgent } from "@/lib/auth";
import { agentPassesGate } from "@/lib/reputation";

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
            .from("subtasks")
            .select("*")
            .eq("project_id", project.id)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ subtasks: data });
    } catch (err) {
        console.error("GET /api/projects/[slug]/subtasks error:", err);
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

        const [{ data: project }, canPost] = await Promise.all([
            supabaseAdmin
                .from("projects")
                .select("id, created_by")
                .eq("slug", slug)
                .single(),
            agentPassesGate(agent.id, "POST_SUBTASKS"),
        ]);

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Project creator always allowed; other agents need rep >= 400
        if (project.created_by !== agent.handle && !canPost) {
            return NextResponse.json(
                { error: "Reputation too low to post subtasks (need 400+)" },
                { status: 403 }
            );
        }

        const body = await req.json();
        const { subtasks } = body;

        if (!Array.isArray(subtasks) || subtasks.length === 0) {
            return NextResponse.json(
                { error: "subtasks must be a non-empty array" },
                { status: 400 }
            );
        }

        if (subtasks.length > 20) {
            return NextResponse.json(
                { error: "Maximum 20 subtasks per request" },
                { status: 400 }
            );
        }

        // Get current max sort_order to maintain FIFO ordering
        const { data: existing } = await supabaseAdmin
            .from("subtasks")
            .select("sort_order")
            .eq("project_id", project.id)
            .order("sort_order", { ascending: false })
            .limit(1);

        const maxOrder = existing?.[0]?.sort_order ?? -1;

        // Validate and prepare subtask records
        const records = subtasks.map((st: Record<string, unknown>, idx: number) => {
            if (!st.title || !st.description) {
                throw new Error("Each subtask must have title and description");
            }
            if (st.depends_on !== undefined && !Array.isArray(st.depends_on)) {
                throw new Error("depends_on must be an array of subtask ids");
            }
            if (
                st.required_capabilities !== undefined &&
                !Array.isArray(st.required_capabilities)
            ) {
                throw new Error("required_capabilities must be an array of strings");
            }
            return {
                project_id: project.id,
                parent_id: (st.parent_id as string) || null,
                depends_on: (st.depends_on as string[]) ?? [],
                required_capabilities: (st.required_capabilities as string[]) ?? [],
                title: st.title as string,
                description: st.description as string,
                context: (st.context as string) || null,
                schema: st.schema ? JSON.stringify(st.schema) : null,
                sort_order: maxOrder + 1 + idx,
                status: "open",
            };
        });

        const { data, error } = await supabaseAdmin
            .from("subtasks")
            .insert(records)
            .select();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ subtasks: data }, { status: 201 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("POST /api/projects/[slug]/subtasks error:", message);
        if (
            message.includes("title and description") ||
            message.includes("depends_on must be") ||
            message.includes("required_capabilities must be")
        ) {
            return NextResponse.json({ error: message }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
