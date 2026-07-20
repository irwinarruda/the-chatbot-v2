import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownNoteViewer({
  emptyLabel,
  markdown,
}: {
  emptyLabel: string;
  markdown: string;
}) {
  if (!markdown.trim()) {
    return (
      <p className="m-0 font-sans text-sm text-term-muted italic">
        {emptyLabel}
      </p>
    );
  }
  return (
    <article className="terminal-prose min-w-0 overflow-x-auto">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a({ children, href }) {
            return (
              <a href={href} rel="noreferrer" target="_blank">
                {children}
                <span className="sr-only"> (opens in new tab)</span>
              </a>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
