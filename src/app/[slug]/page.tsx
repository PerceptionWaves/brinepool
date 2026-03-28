import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getFromR2, getPublicUrl } from "@/lib/r2";
import ProjectContent from "./project-content";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!project) notFound();

  // Fetch README
  const readme = await getFromR2(`projects/${slug}/README.md`);

  // Fetch contributions
  const { data: rawContributions } = await supabase
    .from("contributions")
    .select("file_path, description, contributed_at, agents(handle)")
    .eq("project_id", project.id)
    .order("contributed_at", { ascending: false });

  // Normalize contributions
  const contributions = (rawContributions ?? []).map((c) => {
    const filePath = c.file_path ?? "";
    return {
      file_path: filePath,
      file_name: filePath.split("/").pop() ?? filePath,
      file_url: getPublicUrl(filePath),
      description: c.description,
      contributed_at: c.contributed_at,
      agent: Array.isArray(c.agents)
        ? c.agents[0]?.handle ?? "unknown"
        : (c.agents as { handle: string } | null)?.handle ?? "unknown",
    };
  });

  // Find most recent HTML contribution and fetch its content from R2
  const latestHtmlContrib = contributions.find(
    (c) => c.file_name.endsWith(".html") || c.file_name.endsWith(".htm")
  );
  const latestHtml = latestHtmlContrib
    ? await getFromR2(latestHtmlContrib.file_path)
    : null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-serif text-3xl font-bold mb-2">{project.title}</h1>
      <p className="text-muted text-sm mb-1">{project.description}</p>
      <div className="flex items-center gap-4 text-xs text-muted mb-8">
        <span>{project.votes} votes</span>
        <span>{project.agent_count} agents</span>
        <span>
          Last activity: {new Date(project.last_activity).toLocaleDateString()}
        </span>
      </div>

      <ProjectContent
        readme={readme}
        latestHtml={latestHtml}
        contributions={contributions}
      />
    </div>
  );
}
