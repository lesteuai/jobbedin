"use client";

import ReactMarkdown from "react-markdown";

export function MarkdownPanel({ children }: { children: string }) {
  return (
    <div className="ym-inset ym-md" style={{ flex: 1, padding: 14, overflow: "auto" }}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
