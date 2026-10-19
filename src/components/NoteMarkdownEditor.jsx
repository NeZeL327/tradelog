import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Eraser,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";
import {
  applyNoteEnter,
  applyNoteTab,
  clearNoteFormatting,
  clipboardPlainText,
  selectionFormats,
  toggleBulletList,
  toggleHeading,
  toggleNumberedList,
  toggleQuote,
  wrapInline,
} from "@/lib/noteMarkdown";

const MAX_HISTORY = 80;

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
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-ds-text3 transition-colors",
        "hover:bg-ds-s3 hover:text-ds-text",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus)]",
        "disabled:opacity-40",
        pressed && "bg-ds-s3 text-ds-text"
      )}
    >
      {children}
    </button>
  );
}

export default function NoteMarkdownEditor({ value, onChange, compact = false }) {
  const { t } = useLanguage();
  const areaRef = useRef(null);
  const lastSent = useRef(value);
  const histRef = useRef([{ value: value || "", start: 0, end: 0 }]);
  const posRef = useRef(0);
  const [histPos, setHistPos] = useState(0);
  const [formats, setFormats] = useState(() => selectionFormats(value || "", 0, 0));

  useEffect(() => {
    if (value === lastSent.current) return;
    lastSent.current = value;
    histRef.current = [{ value: value || "", start: 0, end: 0 }];
    posRef.current = 0;
    setHistPos(0);
    setFormats(selectionFormats(value || "", 0, 0));
  }, [value]);

  const snapshot = () => {
    const el = areaRef.current;
    return {
      value: lastSent.current || "",
      start: el?.selectionStart ?? 0,
      end: el?.selectionEnd ?? 0,
    };
  };

  const pushHist = (next) => {
    const stack = histRef.current.slice(0, posRef.current + 1);
    const prev = stack[stack.length - 1];
    if (prev && prev.value === next.value && prev.start === next.start && prev.end === next.end) return;
    stack.push(next);
    if (stack.length > MAX_HISTORY) stack.shift();
    histRef.current = stack;
    posRef.current = stack.length - 1;
    setHistPos(posRef.current);
  };

  const restore = (item) => {
    lastSent.current = item.value;
    onChange(item.value);
    requestAnimationFrame(() => {
      const el = areaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(item.start, item.end);
      setFormats(selectionFormats(item.value, item.start, item.end));
    });
  };

  const apply = (fn) => {
    const el = areaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    pushHist(snapshot());
    const next = fn(value || "", start, end);
    lastSent.current = next.value;
    onChange(next.value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.start, next.end);
      setFormats(selectionFormats(next.value, next.start, next.end));
      pushHist(next);
    });
  };

  const undo = () => {
    if (posRef.current <= 0) return;
    posRef.current -= 1;
    setHistPos(posRef.current);
    restore(histRef.current[posRef.current]);
  };

  const redo = () => {
    if (posRef.current >= histRef.current.length - 1) return;
    posRef.current += 1;
    setHistPos(posRef.current);
    restore(histRef.current[posRef.current]);
  };

  const onInput = (event) => {
    const next = event.target.value;
    lastSent.current = next;
    onChange(next);
    pushHist({
      value: next,
      start: event.target.selectionStart,
      end: event.target.selectionEnd,
    });
    setFormats(selectionFormats(next, event.target.selectionStart, event.target.selectionEnd));
  };

  const onSelect = (event) => {
    setFormats(selectionFormats(event.target.value, event.target.selectionStart, event.target.selectionEnd));
  };

  const onPaste = (event) => {
    event.preventDefault();
    const text = clipboardPlainText(
      event.clipboardData.getData("text/plain"),
      event.clipboardData.getData("text/html")
    );
    apply((current, start, end) => {
      const next = current.slice(0, start) + text + current.slice(end);
      const caret = start + text.length;
      return { value: next, start: caret, end: caret };
    });
  };

  const onKeyDown = (event) => {
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (meta && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if (meta && event.key.toLowerCase() === "b") {
      event.preventDefault();
      apply((current, start, end) => wrapInline(current, start, end, "**"));
      return;
    }
    if (meta && event.key.toLowerCase() === "i") {
      event.preventDefault();
      apply((current, start, end) => wrapInline(current, start, end, "*"));
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      apply((current, start, end) => applyNoteEnter(current, start, end));
      return;
    }
    if (event.key === "Tab") {
      const el = areaRef.current;
      const next = applyNoteTab(value || "", el.selectionStart, el.selectionEnd, event.shiftKey);
      if (next) {
        event.preventDefault();
        apply(() => next);
      }
    }
  };

  const canUndo = histPos > 0;
  const canRedo = histPos < histRef.current.length - 1;

  return (
    <div className="flex flex-col gap-2">
      <div
        role="toolbar"
        aria-label={t("noteEditorToolbar")}
        className="flex flex-wrap items-center gap-0.5 rounded-[12px] border border-ds-line bg-ds-glass p-0.5 backdrop-blur-md"
      >
        <ToolBtn label={t("noteEditorBold")} pressed={formats.bold} onClick={() => apply((v, s, e) => wrapInline(v, s, e, "**"))}>
          <Bold className="h-4 w-4" strokeWidth={1.5} />
        </ToolBtn>
        <ToolBtn label={t("noteEditorItalic")} pressed={formats.italic} onClick={() => apply((v, s, e) => wrapInline(v, s, e, "*"))}>
          <Italic className="h-4 w-4" strokeWidth={1.5} />
        </ToolBtn>
        <ToolBtn label={t("noteEditorBullet")} pressed={formats.bullet} onClick={() => apply(toggleBulletList)}>
          <List className="h-4 w-4" strokeWidth={1.5} />
        </ToolBtn>
        <ToolBtn label={t("noteEditorNumbered")} pressed={formats.numbered} onClick={() => apply(toggleNumberedList)}>
          <ListOrdered className="h-4 w-4" strokeWidth={1.5} />
        </ToolBtn>
        <ToolBtn label={t("noteEditorHeading")} pressed={formats.heading} onClick={() => apply(toggleHeading)}>
          <Heading3 className="h-4 w-4" strokeWidth={1.5} />
        </ToolBtn>
        <ToolBtn label={t("noteEditorQuote")} pressed={formats.quote} onClick={() => apply(toggleQuote)}>
          <Quote className="h-4 w-4" strokeWidth={1.5} />
        </ToolBtn>
        <span className="mx-0.5 h-5 w-px bg-ds-line" aria-hidden />
        <ToolBtn label={t("noteEditorClear")} onClick={() => apply(clearNoteFormatting)}>
          <Eraser className="h-4 w-4" strokeWidth={1.5} />
        </ToolBtn>
        <ToolBtn label={t("noteEditorUndo")} disabled={!canUndo} onClick={undo}>
          <Undo2 className="h-4 w-4" strokeWidth={1.5} />
        </ToolBtn>
        <ToolBtn label={t("noteEditorRedo")} disabled={!canRedo} onClick={redo}>
          <Redo2 className="h-4 w-4" strokeWidth={1.5} />
        </ToolBtn>
      </div>
      <Textarea
        ref={areaRef}
        value={value}
        onChange={onInput}
        onSelect={onSelect}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        rows={compact ? 5 : 10}
        className={cn("w-full resize-y", compact ? "min-h-[5rem]" : "min-h-[200px]")}
      />
    </div>
  );
}
