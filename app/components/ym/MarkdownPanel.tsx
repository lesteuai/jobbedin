"use client";

import ReactMarkdown from "react-markdown";

export function MarkdownPanel({ children }: { children: string }) {
  return (
    <div className="ym-inset ym-md" style={{ flex: 1, padding: 14, overflow: "auto" }}>
      <ReactMarkdown
        components={{
          // 1. This makes the main Company Name (H1) purple
          h1: ({ node, ...props }) => (
            <h1 className="text-[#5b2b82] text-2xl font-bold mb-4" {...props} />
          ),
          
          // 2. THIS makes all your sub-sections ("What They Do", "Why You're a Strong Match", etc.) purple!
          h3: ({ node, ...props }) => (
            <h3 className="text-[#5b2b82] text-lg font-bold mt-5 mb-2" {...props} />
          ),

          // 3. (Optional but recommended) Spacing for normal text and bullet points
          p: ({ node, ...props }) => (
            <p className="mb-4" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />
          )
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
