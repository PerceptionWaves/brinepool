"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

export default function ReadmeRenderer({ content }: { content: string }) {
  const isHtml = content.trim().startsWith("<");

  if (isHtml) {
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
      {content}
    </ReactMarkdown>
  );
}
