import type { ReactNode } from "react";

function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2,-2)}</strong> : part);
}

export function ArticleBody({ mdx }: { mdx: string }) {
  const lines = mdx.split(/\r?\n/);
  return <div className="article-body">{lines.map((line,index) => {
    const value = line.trim();
    if (!value) return <div className="article-spacer" key={index} />;
    if (value.startsWith("### ")) return <h3 key={index}>{inline(value.slice(4))}</h3>;
    if (value.startsWith("## ")) return <h2 key={index}>{inline(value.slice(3))}</h2>;
    if (value.startsWith("# ")) return <h2 key={index}>{inline(value.slice(2))}</h2>;
    if (value.startsWith("- ")) return <div className="article-bullet" key={index}>• <span>{inline(value.slice(2))}</span></div>;
    return <p key={index}>{inline(value)}</p>;
  })}</div>;
}
