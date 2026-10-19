import Markdown from "react-markdown";
import { cn } from "@/lib/utils";
import { safeMarkdownHref, toMarkdownWithBreaks } from "@/lib/noteMarkdown";

const ALLOWED = [
  "p", "br", "strong", "em", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "a", "code",
];

const mdComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  h1: ({ children }) => <h3 className="mb-2 text-[15px] font-semibold text-ds-text last:mb-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 text-[15px] font-semibold text-ds-text last:mb-0">{children}</h3>,
  h3: ({ children }) => <h3 className="mb-2 text-[14px] font-semibold text-ds-text last:mb-0">{children}</h3>,
  h4: ({ children }) => <h3 className="mb-2 text-[14px] font-semibold text-ds-text last:mb-0">{children}</h3>,
  h5: ({ children }) => <h3 className="mb-2 text-[13px] font-semibold text-ds-text last:mb-0">{children}</h3>,
  h6: ({ children }) => <h3 className="mb-2 text-[13px] font-semibold text-ds-text last:mb-0">{children}</h3>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-ds-line pl-3 text-ds-text3 last:mb-0">{children}</blockquote>
  ),
  strong: ({ children }) => <strong className="font-semibold text-ds-text">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  a: ({ href, children }) => {
    const safe = safeMarkdownHref(href);
    if (!safe) return <span>{children}</span>;
    return (
      <a href={safe} target="_blank" rel="noopener noreferrer" className="text-ds-accent underline-offset-2 hover:underline">
        {children}
      </a>
    );
  },
  img: () => null,
};

export default function NoteMarkdownView({ value, className }) {
  const source = String(value ?? "");
  if (!source.trim()) return null;
  return (
    <div className={cn("text-[13px] leading-relaxed text-ds-text2", className)}>
      <Markdown
        skipHtml
        allowedElements={ALLOWED}
        unwrapDisallowed
        urlTransform={(url) => safeMarkdownHref(url) || ""}
        components={mdComponents}
      >
        {toMarkdownWithBreaks(source)}
      </Markdown>
    </div>
  );
}
