import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Eraser,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";
import { editorDocToMarkdown, noteMarkdownToHtml } from "@/lib/richNoteMarkdown";

function ToolBtn({ label, pressed, disabled, onClick, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed ? "true" : "false"}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
        "disabled:opacity-40 disabled:pointer-events-none",
        pressed && "bg-primary/15 text-primary"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Edytor notatek „jak w Wordzie”: widoczne formatowanie, okno rośnie z tekstem.
 * value / onChange operują na Markdown (ten sam format co wcześniej).
 */
export default function RichNoteEditor({ value, onChange, placeholder, minHeight = 96, className }) {
  const { t } = useLanguage();
  const lastEmitted = useRef(value ?? "");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [, force] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder: placeholder || "" }),
    ],
    content: noteMarkdownToHtml(value),
    editorProps: {
      attributes: { class: "rich-note-content" },
    },
    onUpdate: ({ editor: ed }) => {
      const next = editorDocToMarkdown(ed.state.doc);
      lastEmitted.current = next;
      onChangeRef.current?.(next);
    },
    onSelectionUpdate: () => force((n) => n + 1),
    onTransaction: () => force((n) => n + 1),
  });

  // Zmiana wartości z zewnątrz (np. wczytanie innej transakcji).
  useEffect(() => {
    if (!editor) return;
    const incoming = value ?? "";
    if (incoming === lastEmitted.current) return;
    lastEmitted.current = incoming;
    editor.commands.setContent(noteMarkdownToHtml(incoming), { emitUpdate: false });
  }, [value, editor]);

  const run = (fn) => () => editor && fn(editor.chain().focus()).run();
  const active = (name, attrs) => Boolean(editor?.isActive(name, attrs));

  return (
    <div
      className={cn(
        "rich-note-editor rounded-lg border border-border/70 bg-muted/25 dark:bg-white/[0.03]",
        "focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/30",
        className
      )}
    >
      <div
        role="toolbar"
        aria-label={t("noteEditorToolbar")}
        className="flex flex-wrap items-center gap-0.5 border-b border-border/60 px-1.5 py-1"
      >
        <ToolBtn label={`${t("noteEditorBold")} (⌘B)`} pressed={active("bold")} onClick={run((c) => c.toggleBold())}>
          <Bold className="h-3.5 w-3.5" strokeWidth={2} />
        </ToolBtn>
        <ToolBtn label={`${t("noteEditorItalic")} (⌘I)`} pressed={active("italic")} onClick={run((c) => c.toggleItalic())}>
          <Italic className="h-3.5 w-3.5" strokeWidth={2} />
        </ToolBtn>
        <ToolBtn label={`${t("noteEditorUnderline") || "Podkreślenie"} (⌘U)`} pressed={active("underline")} onClick={run((c) => c.toggleUnderline())}>
          <UnderlineIcon className="h-3.5 w-3.5" strokeWidth={2} />
        </ToolBtn>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ToolBtn label={t("noteEditorHeading")} pressed={active("heading", { level: 3 })} onClick={run((c) => c.toggleHeading({ level: 3 }))}>
          <Heading3 className="h-3.5 w-3.5" strokeWidth={2} />
        </ToolBtn>
        <ToolBtn label={t("noteEditorBullet")} pressed={active("bulletList")} onClick={run((c) => c.toggleBulletList())}>
          <List className="h-3.5 w-3.5" strokeWidth={2} />
        </ToolBtn>
        <ToolBtn label={t("noteEditorNumbered")} pressed={active("orderedList")} onClick={run((c) => c.toggleOrderedList())}>
          <ListOrdered className="h-3.5 w-3.5" strokeWidth={2} />
        </ToolBtn>
        <ToolBtn label={t("noteEditorQuote")} pressed={active("blockquote")} onClick={run((c) => c.toggleBlockquote())}>
          <Quote className="h-3.5 w-3.5" strokeWidth={2} />
        </ToolBtn>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ToolBtn label={t("noteEditorClear")} onClick={run((c) => c.unsetAllMarks().clearNodes())}>
          <Eraser className="h-3.5 w-3.5" strokeWidth={2} />
        </ToolBtn>
        <ToolBtn label={`${t("noteEditorUndo")} (⌘Z)`} disabled={!editor?.can().undo()} onClick={run((c) => c.undo())}>
          <Undo2 className="h-3.5 w-3.5" strokeWidth={2} />
        </ToolBtn>
        <ToolBtn label={`${t("noteEditorRedo")} (⇧⌘Z)`} disabled={!editor?.can().redo()} onClick={run((c) => c.redo())}>
          <Redo2 className="h-3.5 w-3.5" strokeWidth={2} />
        </ToolBtn>
      </div>
      <EditorContent editor={editor} style={{ "--rich-note-min-h": `${minHeight}px` }} />
      <style>{`
        .rich-note-editor .rich-note-content {
          min-height: var(--rich-note-min-h, 96px);
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.6;
          outline: none;
          color: hsl(var(--foreground));
          overflow-wrap: anywhere;
        }
        .rich-note-editor .rich-note-content p { margin: 0 0 0.5em; }
        .rich-note-editor .rich-note-content > :last-child { margin-bottom: 0; }
        .rich-note-editor .rich-note-content h3 { font-size: 15px; font-weight: 600; margin: 0.6em 0 0.35em; }
        .rich-note-editor .rich-note-content h3:first-child { margin-top: 0; }
        .rich-note-editor .rich-note-content ul { list-style: disc; padding-left: 1.4em; margin: 0 0 0.5em; }
        .rich-note-editor .rich-note-content ol { list-style: decimal; padding-left: 1.6em; margin: 0 0 0.5em; }
        .rich-note-editor .rich-note-content li p { margin: 0; }
        .rich-note-editor .rich-note-content blockquote {
          border-left: 2px solid hsl(var(--border)); padding-left: 0.8em; margin: 0 0 0.5em;
          color: hsl(var(--muted-foreground));
        }
        .rich-note-editor .rich-note-content strong { font-weight: 700; }
        .rich-note-editor .rich-note-content a { color: hsl(var(--primary)); text-decoration: underline; }
        .rich-note-editor .rich-note-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder); float: left; height: 0; pointer-events: none;
          color: hsl(var(--muted-foreground) / 0.6);
        }
      `}</style>
    </div>
  );
}
