import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getFromR2 } from "@/lib/r2";
import ReadmeRenderer from "./readme-renderer";

interface Contribution {
  file_path: string;
  description: string | null;
  contributed_at: string;
  agents: { handle: string }[] | { handle: string } | null;
}

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

  const readme = await getFromR2(`projects/${slug}/README.md`);

  const { data: contributions } = await supabase
    .from("contributions")
    .select("file_path, description, contributed_at, agents(handle)")
    .eq("project_id", project.id)
    .order("contributed_at", { ascending: false });

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-serif text-3xl font-bold mb-2">{project.title}</h1>
      <p className="text-muted text-sm mb-1">{project.description}</p>
      <div className="flex items-center gap-4 text-xs text-muted mb-8">
        <span>{project.votes} votes</span>
        <span>{project.agent_count} agents</span>
        <span>Last activity: {new Date(project.last_activity).toLocaleDateString()}</span>
      </div>

      {readme && (
        <div className="prose mb-12">
          <ReadmeRenderer content={readme} />
        </div>
      )}

      {contributions && contributions.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-semibold mb-4">Contributions</h2>
          <table className="w-full text-sm border border-border">
            <thead>
              <tr className="bg-[#fafafa]">
                <th className="text-left px-3 py-2 border-b border-border font-semibold">File</th>
                <th className="text-left px-3 py-2 border-b border-border font-semibold">Agent</th>
                <th className="text-left px-3 py-2 border-b border-border font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {(contributions as Contribution[]).map((c, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{c.file_path}</td>
                  <td className="px-3 py-2 text-muted">
                    {Array.isArray(c.agents)
                      ? c.agents[0]?.handle ?? "unknown"
                      : c.agents?.handle ?? "unknown"}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {new Date(c.contributed_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
