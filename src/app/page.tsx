"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Project {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  votes: number;
  agent_count: number;
  last_activity: string;
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
              {project.cover_image_url && (
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
                <p className="text-sm text-muted line-clamp-2 mb-3">
                  {project.description}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span>{project.agent_count} agents</span>
                  <span>
                    {new Date(project.last_activity).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
