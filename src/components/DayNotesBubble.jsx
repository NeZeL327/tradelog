import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Check, ChevronDown, ChevronUp, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/LanguageProvider";
import NoteMarkdownView from "@/components/NoteMarkdownView";
import { buildDayNotesCopy } from "@/lib/dayNotesCopy";

const FOCUSABLE = "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex=\"-1\"])";
const NEG = "var(--ds-neg)";
const WARN = "var(--ds-warn)";
const FAINT = "var(--ds-text3)";

function tagDot(kind) {
  if (kind === "mistake" || kind === "overtrading") return NEG;
  if (kind === "mind" || kind === "risk" || kind === "mistakes") return WARN;
  return FAINT;
}
const GLASS = {
  background: "var(--ds-s1)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid var(--ds-frame)",
  boxShadow: "inset 0 1px 0 var(--ds-frame-top), 0 24px 64px rgba(0, 0, 0, 0.55)",
};

function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function focusables(root) {
  if (!root) return [];
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.getAttribute("aria-hidden") !== "true");
}

function placeBubble(anchor, box) {
  const margin = 12;
  const gap = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(560, vw * 0.92, vw - margin * 2);
  if (!anchor) {
    const maxHeight = vh * 0.7;
    const height = Math.min(box?.offsetHeight || maxHeight, maxHeight);
    return {
      left: Math.max(margin, (vw - width) / 2),
      top: Math.max(margin, (vh - height) / 2),
      width,
      maxHeight,
      side: "bottom",
      arrowLeft: width / 2,
      hideArrow: true,
    };
  }
  const ar = anchor.getBoundingClientRect();
  const below = vh - ar.bottom - margin - gap;
  const above = ar.top - margin - gap;
  const side = below >= 200 && below >= above ? "bottom" : "top";
  const maxHeight = Math.min(vh * 0.7, Math.max(160, side === "bottom" ? below : above));
  const height = Math.min(box?.offsetHeight || maxHeight, maxHeight);
  let left = ar.left + ar.width / 2 - width / 2;
  left = Math.max(margin, Math.min(left, vw - width - margin));
  const top = side === "bottom" ? ar.bottom + gap : Math.max(margin, ar.top - gap - height);
  const arrowLeft = Math.max(18, Math.min(ar.left + ar.width / 2 - left, width - 18));
  return { left, top, width, maxHeight, side, arrowLeft };
}

function IconBtn({ label, onClick, children, disabled }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ds-text2 transition-colors duration-150 hover:bg-ds-s3 hover:text-ds-text disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function DayNotesBody({
  title,
  dateLabel,
  countLabel,
  sections,
  scoreLabel,
  scoreValue,
  tags,
  emptyNote,
  copied,
  onCopy,
  onClose,
  onOpenTrade,
  onStep,
  activeIndex,
  sectionRefs,
  t,
}) {
  return (
    <>
      <header className="flex shrink-0 items-start gap-2 border-b border-ds-line px-4 pb-3 pt-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ds-text3">{title}</p>
          <p className="mt-1 truncate text-[15px] font-medium text-ds-text">{dateLabel}</p>
          {countLabel ? <p className="mt-0.5 text-[12px] text-ds-text2">{countLabel}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn label={t("dayNotesPrev")} disabled={sections.length < 2} onClick={() => onStep(-1)}>
            <ChevronUp className="h-4 w-4" />
          </IconBtn>
          <IconBtn label={t("dayNotesNext")} disabled={sections.length < 2} onClick={() => onStep(1)}>
            <ChevronDown className="h-4 w-4" />
          </IconBtn>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-ds-text2 transition-colors duration-150 hover:bg-ds-s3 hover:text-ds-text"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t("dayNotesCopied") : t("dayNotesCopy")}
          </button>
          <IconBtn label={t("dayNotesClose")} onClick={onClose}>
            <X className="h-4 w-4" />
          </IconBtn>
        </div>
      </header>
      <div className="day-notes-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-4">
        {sections.length ? sections.map((row, index) => (
          <section
            key={row.id || index}
            ref={(node) => { sectionRefs.current[index] = node; }}
            className="py-3 first:pt-0 last:pb-0"
            style={{
              borderTop: index ? "1px solid var(--ds-line)" : undefined,
              background: index === activeIndex ? "var(--ds-s3)" : undefined,
              margin: index === activeIndex ? "0 -16px" : undefined,
              paddingLeft: index === activeIndex ? 16 : undefined,
              paddingRight: index === activeIndex ? 16 : undefined,
              borderRadius: index === activeIndex ? 12 : undefined,
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate text-[13px] font-medium text-ds-text">
                {row.symbol}
                {row.direction ? <span className="font-normal text-ds-text2">{` · ${row.direction}`}</span> : null}
                {row.time ? <span className="font-normal text-ds-text3">{` · ${row.time}`}</span> : null}
              </p>
              {row.result ? (
                <span className="shrink-0 tabular-nums text-[13px]" style={{ color: row.resultColor || "var(--ds-text2)" }}>
                  {row.result}
                </span>
              ) : null}
            </div>
            {row.notes ? (
              <NoteMarkdownView className="mt-2 text-[13px] leading-[20px]" value={row.notes} />
            ) : (
              <p className="mt-2 text-[12px] text-ds-text3">{emptyNote}</p>
            )}
            {row.trade && onOpenTrade ? (
              <button
                type="button"
                onClick={() => onOpenTrade(row.trade)}
                className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-ds-text2 transition-colors duration-150 hover:text-ds-text"
              >
                {t("openTradeLink")}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </section>
        )) : (
          <p className="text-[13px] text-ds-text2">{emptyNote}</p>
        )}
      </div>
      {scoreValue || tags.length ? (
        <footer className="shrink-0 border-t border-ds-line px-4 py-3">
          {scoreValue ? (
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ds-text3">
              {scoreLabel}: <span className="text-[13px] font-medium tracking-normal text-ds-text">{scoreValue}</span>
            </p>
          ) : null}
          {tags.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((entry) => (
                <span
                  key={entry.tag}
                  className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-[3px] text-[10px] font-semibold uppercase leading-[14px] tracking-[0.08em]"
                  style={{ borderColor: "var(--ds-pill-line)", color: "var(--ds-text2)" }}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tagDot(entry.kind) }} />
                  <span className="truncate">{entry.tag}</span>
                </span>
              ))}
            </div>
          ) : null}
        </footer>
      ) : null}
    </>
  );
}

export default function DayNotesBubble({
  open,
  onOpenChange,
  anchorRef,
  title,
  dateLabel,
  countLabel,
  sections = [],
  scoreLabel,
  scoreValue,
  tags = [],
  onOpenTrade,
  focusId,
}) {
  const { t } = useLanguage();
  const sheet = useNarrow();
  const reduced = useReducedMotion();
  const boxRef = useRef(null);
  const sectionRefs = useRef([]);
  const [place, setPlace] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const close = useCallback(() => onOpenChange?.(false), [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const idx = focusId ? sections.findIndex((row) => String(row.id) === String(focusId)) : 0;
    setActiveIndex(idx >= 0 ? idx : 0);
    setCopied(false);
  }, [open, focusId]); // sections identity changes every parent render; index is resolved on open/focus only

  useLayoutEffect(() => {
    if (!open || sheet) return undefined;
    const update = () => {
      setPlace(placeBubble(anchorRef?.current, boxRef.current));
    };
    update();
    const frame = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, sheet, anchorRef, sections.length]);

  useEffect(() => {
    if (!open) return undefined;
    const box = boxRef.current;
    const prev = document.activeElement;
    const trigger = anchorRef?.current;
    const list = focusables(box);
    (list[0] || box)?.focus();

    let prevHtml = "";
    let prevBody = "";
    if (sheet) {
      prevHtml = document.documentElement.style.overflow;
      prevBody = document.body.style.overflow;
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }

    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
        event.preventDefault();
        const dir = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((cur) => {
          if (!sections.length) return 0;
          return (cur + dir + sections.length) % sections.length;
        });
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusables(box);
      if (!nodes.length) {
        event.preventDefault();
        box?.focus();
        return;
      }
      const i = nodes.indexOf(document.activeElement);
      if (event.shiftKey && i <= 0) {
        event.preventDefault();
        nodes[nodes.length - 1].focus();
      } else if (!event.shiftKey && (i === nodes.length - 1 || i === -1)) {
        event.preventDefault();
        nodes[0].focus();
      }
    };

    const onPtr = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (box?.contains(target)) return;
      if (trigger?.contains(target)) return;
      close();
    };

    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPtr);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPtr);
      if (sheet) {
        document.documentElement.style.overflow = prevHtml;
        document.body.style.overflow = prevBody;
      }
      const back = trigger || prev;
      if (back && typeof back.focus === "function") {
        requestAnimationFrame(() => back.focus());
      }
    };
  }, [open, sheet, close, anchorRef, sections.length]);

  useEffect(() => {
    if (!open) return;
    const node = sectionRefs.current[activeIndex];
    node?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [activeIndex, open, reduced]);

  const onCopy = async () => {
    const text = buildDayNotesCopy({
      title,
      dateLabel,
      countLabel,
      sections,
      emptyNote: t("noNote"),
      scoreLabel,
      scoreValue,
      tags,
    });
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(el);
      el.select();
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      el.remove();
    }
    if (!ok) return;
    setCopied(true);
    toast.success(t("dayNotesCopied"));
    window.setTimeout(() => setCopied(false), 1600);
  };

  const onStep = (dir) => {
    if (!sections.length) return;
    setActiveIndex((cur) => (cur + dir + sections.length) % sections.length);
  };

  const openTrade = (trade) => {
    onOpenTrade?.(trade);
    close();
  };

  if (!open || typeof document === "undefined") return null;

  const aria = [title, dateLabel, countLabel].filter(Boolean).join(". ");
  const bodyProps = {
    title,
    dateLabel,
    countLabel,
    sections,
    scoreLabel,
    scoreValue,
    tags,
    emptyNote: t("noNote"),
    copied,
    onCopy,
    onClose: close,
    onOpenTrade: openTrade,
    onStep,
    activeIndex,
    sectionRefs,
    t,
  };

  if (sheet) {
    return createPortal(
      <div className="fixed inset-0 z-[240]">
        <button type="button" aria-label={t("dayNotesClose")} className="absolute inset-0 bg-black/45" onClick={close} />
        <div
          ref={boxRef}
          role="dialog"
          aria-modal="true"
          aria-label={aria}
          tabIndex={-1}
          className="day-notes-bubble absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[20px] rounded-b-none outline-none"
          style={{ ...GLASS, maxHeight: "70vh" }}
        >
          <div className="flex justify-center pt-2" aria-hidden>
            <span className="h-1 w-10 rounded-full bg-ds-line" />
          </div>
          <DayNotesBody {...bodyProps} />
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: place?.left ?? 12,
        top: place?.top ?? 12,
        width: place?.width ?? Math.min(560, window.innerWidth * 0.92),
        zIndex: 240,
        visibility: place ? "visible" : "hidden",
      }}
    >
      {place && !place.hideArrow ? (
        <span
          className="day-notes-arrow"
          style={{
            top: place.side === "bottom" ? -6 : undefined,
            bottom: place.side === "top" ? -6 : undefined,
            left: place.arrowLeft - 6,
          }}
          aria-hidden
        />
      ) : null}
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-label={aria}
        tabIndex={-1}
        className="day-notes-bubble flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[20px] outline-none"
        style={{ ...GLASS, maxHeight: place?.maxHeight ?? "70vh" }}
      >
        <DayNotesBody {...bodyProps} />
      </div>
    </div>,
    document.body,
  );
}
