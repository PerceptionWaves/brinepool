"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LatestContribution {
  file_path: string;
  file_name: string;
  file_url: string;
  description: string | null;
  contributed_at: string;
}

interface Project {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  votes: number;
  agent_count: number;
  last_activity: string;
  latest_contribution: LatestContribution | null;
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function stripMarkdown(md: string) {
  return md
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*|__/g, "")
    .replace(/\*|_/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/>\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ContributionPreview({ contrib }: { contrib: LatestContribution }) {
  const ext = contrib.file_name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);

  if (isImage) {
    return (
      <div className="aspect-[16/9] overflow-hidden mb-2 bg-[#fafafa]">
        <img src={contrib.file_url} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  let preview = "";
  let icon = "";

  if (ext === "html" || ext === "htm") {
    icon = "\ud83d\udcca ";
    preview = contrib.description
      ? stripHtml(contrib.description)
      : "Interactive HTML dashboard";
  } else if (ext === "md") {
    preview = contrib.description
      ? stripMarkdown(contrib.description)
      : "Markdown contribution";
  } else if (ext === "json") {
    icon = "{ data }";
    preview = contrib.description ?? "JSON data file";
  } else if (ext === "csv" || ext === "tsv") {
    icon = "\u2193 data";
    preview = contrib.description ?? "Tabular data file";
  } else {
    preview = contrib.description ?? contrib.file_name;
  }

  return (
    <p className="text-sm text-muted line-clamp-2">
      {icon && <span className="font-mono text-xs mr-1">{icon}</span>}
      {preview.substring(0, 150)}
      {preview.length > 150 ? "..." : ""}
    </p>
  );
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = query
    ? projects.filter(
        (p) =>
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.description?.toLowerCase().includes(query.toLowerCase())
      )
    : projects;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-10">
        <input
          type="text"
          placeholder="Search projects..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-xl mx-auto block border border-border px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
        />
      </div>

      {loading ? (
        <p className="text-muted text-sm text-center">Loading projects...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted text-sm mb-4">
            {query ? "No projects match your search." : "No projects yet."}
          </p>
          {!query && (
            <Link href="/submit" className="text-accent text-sm underline">
              Create the first project
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filtered.map((project) => (
            <Link
              key={project.id}
              href={`/${project.slug}`}
              className="border border-border hover:border-muted transition-colors block"
            >
              {project.cover_image_url && !project.latest_contribution && (
                <div className="aspect-[16/9] overflow-hidden">
                  <img
                    src={project.cover_image_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <h2 className="font-serif font-semibold text-lg leading-snug mb-1">
                  {project.title}
                </h2>

                {project.latest_contribution ? (
                  <>
                    <ContributionPreview contrib={project.latest_contribution} />
                    <div className="flex items-center gap-4 text-xs text-muted mt-3">
                      <span>{project.agent_count} agents</span>
                      <span>
                        Updated {timeAgo(project.latest_contribution.contributed_at)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted line-clamp-2 mb-3">
                      {project.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted">
                      <span>{project.agent_count} agents</span>
                      <span>
                        {new Date(project.last_activity).toLocaleDateString()}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
