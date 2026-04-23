"use client";

import { useState, useRef, useEffect } from "react";
import ReadmeRenderer from "./readme-renderer";

interface Contribution {
  file_path: string;
  description: string | null;
  contributed_at: string;
  file_name: string;
  file_url: string;
  agent: string;
}

interface Props {
  readme: string | null;
  latestHtml: string | null;
  contributions: Contribution[];
}

export default function ProjectContent({ readme, latestHtml, contributions }: Props) {
  const hasLatest = !!latestHtml;
  const [tab, setTab] = useState<"latest" | "brief">(hasLatest ? "latest" : "brief");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-resize iframe to fit content
  useEffect(() => {
    if (tab !== "latest" || !iframeRef.current) return;

    const iframe = iframeRef.current;
    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          const height = doc.documentElement.scrollHeight;
          iframe.style.height = `${Math.max(height, 400)}px`;
        }
      } catch {
        iframe.style.height = "800px";
      }
    };

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [tab]);

  return (
    <div>
      {/* Tabs — only show if we have a latest HTML contribution */}
      {hasLatest && (
        <div className="flex gap-0 border-b border-border mb-8">
          <button
            onClick={() => setTab("latest")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === "latest"
                ? "border-b-2 border-accent text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            Latest
          </button>
          <button
            onClick={() => setTab("brief")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === "brief"
                ? "border-b-2 border-accent text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            Brief
          </button>
        </div>
      )}

      {/* Tab content */}
      {tab === "latest" && latestHtml ? (
        <div className="mb-12">
          <iframe
            ref={iframeRef}
            srcDoc={latestHtml}
            sandbox="allow-scripts allow-same-origin"
            className="w-full border border-border"
            style={{ minHeight: "400px" }}
            title="Latest contribution"
          />
        </div>
      ) : readme ? (
        <div className="prose mb-12">
          <ReadmeRenderer content={readme} />
        </div>
      ) : null}

      {/* Contributions table */}
      {contributions.length > 0 && (
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
              {contributions.map((c, i) => {
                const isHtml = c.file_name.endsWith(".html") || c.file_name.endsWith(".htm");
                return (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <a
                        href={c.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent underline font-mono text-xs"
                      >
                        {c.file_name}
                      </a>
                      {isHtml && (
                        <a
                          href={c.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-xs text-teal"
                        >
                          View
                        </a>
                      )}
                      {c.description && (
                        <p className="text-xs text-muted mt-0.5">{c.description}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted text-xs">{c.agent}</td>
                    <td className="px-3 py-2 text-muted text-xs">
                      {new Date(c.contributed_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
