import { useEffect, useState } from "react";
import { ChevronDown, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  addTagToList,
  normalizeTagLabel,
  removeTagFromList,
  renameTagInList,
  remapSelectedTags,
} from "@/lib/tradeTags";

const chipBase =
  "px-2 py-0.5 rounded-md text-[11px] leading-tight border transition min-h-[1.55rem] inline-flex items-center gap-1";

function mergeUniqueTags(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const raw of list || []) {
      const tag = normalizeTagLabel(raw);
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
  }
  return out;
}

/**
 * Schema-aligned tagged note: click tags and/or write — like journal plans (TradesViz/Edgewonk).
 * Compact by default so the guided flow stays readable.
 */
export default function DayPlanTaggedNote({
  label,
  hint,
  text = "",
  tags = [],
  options = [],
  defaultOptions = [],
  /** Schema answers shown first (from HORIZON_PROMPTS[].tags). */
  suggestTags = [],
  onTextChange,
  onTagsChange,
  onOptionsChange,
  rows = 2,
  maxLength,
  className,
  /** Collapse empty note behind "Dodaj notatkę" — better for prompt rows. */
  noteCollapsible = false,
  /** Hide textarea entirely (vocab strip only). */
  hideNote = false,
  /** When false, chips are display/edit-only (no selection). */
  selectable = true,
  /** Show inline vocab editor (add / rename / reset). Prefer once per section. */
  showVocabManager = false,
  done,
}) {
  const selected = Array.isArray(tags) ? tags : [];
  const defaults = Array.isArray(defaultOptions) ? defaultOptions : [];
  const vocab = Array.isArray(options) && options.length ? options : defaults;
  const suggest = Array.isArray(suggestTags) ? suggestTags : [];
  const chips = mergeUniqueTags(suggest, vocab, selected);

  const selectedKeys = new Set(selected.map((t) => normalizeTagLabel(t).toLowerCase()));
  const filled =
    done != null
      ? !!done
      : selected.length > 0 || !!String(text || "").trim();

  const [noteOpen, setNoteOpen] = useState(
    () => !hideNote && (!!String(text || "").trim() || !noteCollapsible)
  );
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingTag, setEditingTag] = useState(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (String(text || "").trim()) setNoteOpen(true);
  }, [text]);

  useEffect(() => {
    if (!managing) {
      setEditingTag(null);
      setEditValue("");
    }
  }, [managing]);

  const toggleTag = (tag) => {
    const key = normalizeTagLabel(tag).toLowerCase();
    if (!key) return;
    if (selectedKeys.has(key)) {
      onTagsChange?.(selected.filter((t) => normalizeTagLabel(t).toLowerCase() !== key));
    } else {
      onTagsChange?.([...selected, normalizeTagLabel(tag)]);
    }
  };

  const handleAdd = () => {
    const { list, added } = addTagToList(vocab, draft, defaults);
    if (!added) {
      setDraft("");
      return;
    }
    onOptionsChange?.(list);
    setDraft("");
    if (!selectedKeys.has(added.toLowerCase())) {
      onTagsChange?.([...selected, added]);
    }
  };

  const handleRemoveOption = (tag) => {
    const next = removeTagFromList(vocab, tag, defaults);
    onOptionsChange?.(next);
    onTagsChange?.(
      selected.filter((t) => normalizeTagLabel(t).toLowerCase() !== normalizeTagLabel(tag).toLowerCase())
    );
  };

  const commitRename = () => {
    if (!editingTag) return;
    const { list, renamed } = renameTagInList(vocab, editingTag, editValue, defaults);
    if (!renamed) {
      setEditingTag(null);
      setEditValue("");
      return;
    }
    onOptionsChange?.(list);
    onTagsChange?.(remapSelectedTags(selected, editingTag, normalizeTagLabel(editValue)));
    setEditingTag(null);
    setEditValue("");
  };

  const handleReset = () => {
    const nextSelected = selected.filter((t) =>
      defaults.some((d) => d.toLowerCase() === normalizeTagLabel(t).toLowerCase())
    );
    onOptionsChange?.([...defaults]);
    onTagsChange?.(nextSelected);
  };

  return (
    <div
      className={cn(
        "space-y-1.5 rounded-lg border px-2.5 py-2 transition-colors",
        filled ? "border-primary/25 bg-primary/[0.04]" : "border-border/60 bg-background/25",
        className
      )}
    >
      {(label || done != null || maxLength != null) && (
        <div className="flex items-center justify-between gap-2">
          {label ? (
            <Label className="text-xs font-medium text-foreground/90">{label}</Label>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {filled ? (
              <span className="text-[10px] font-medium uppercase tracking-wide text-profit">OK</span>
            ) : null}
            {maxLength != null ? (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {String(text || "").length}/{maxLength}
              </span>
            ) : null}
          </div>
        </div>
      )}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}

      <div className="flex flex-wrap items-center gap-1">
        {chips.map((tag) => {
          const active = selectedKeys.has(normalizeTagLabel(tag).toLowerCase());
          const isSchema = suggest.some(
            (s) => normalizeTagLabel(s).toLowerCase() === normalizeTagLabel(tag).toLowerCase()
          );
          if (managing && editingTag === tag) {
            return (
              <span key={tag} className="inline-flex items-center gap-1">
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename();
                    }
                    if (e.key === "Escape") {
                      setEditingTag(null);
                      setEditValue("");
                    }
                  }}
                  className="h-7 w-32 text-[11px] px-2"
                  autoFocus
                  maxLength={48}
                />
                <Button type="button" size="sm" className="h-7 px-2 text-[11px]" onClick={commitRename}>
                  OK
                </Button>
              </span>
            );
          }
          return (
            <button
              key={tag}
              type="button"
              onClick={() => {
                if (managing) {
                  setEditingTag(tag);
                  setEditValue(tag);
                } else if (selectable) {
                  toggleTag(tag);
                }
              }}
              className={cn(
                chipBase,
                managing
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : selectable && active
                    ? "border-primary bg-primary text-primary-foreground"
                    : isSchema
                      ? "border-border/80 bg-card/80 text-foreground/90 hover:border-primary/45"
                      : "border-border/60 bg-background/60 text-muted-foreground hover:border-primary/35 hover:text-foreground",
                !selectable && !managing && "cursor-default"
              )}
              title={
                managing
                  ? "Zmień nazwę"
                  : !selectable
                    ? "Lista tagów"
                    : isSchema
                      ? "Odpowiedź ze schematu"
                      : "Tag"
              }
            >
              <span>{tag}</span>
              {managing && (
                <span
                  role="button"
                  tabIndex={0}
                  className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveOption(tag);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemoveOption(tag);
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
        {!chips.length ? (
          <span className="text-[11px] text-muted-foreground">Brak tagów — dodaj własne</span>
        ) : null}
      </div>

      {showVocabManager ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Nowy tag…"
            className="h-7 min-w-[7rem] flex-1 px-2 text-[11px]"
            maxLength={48}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={handleAdd}
            disabled={!normalizeTagLabel(draft)}
          >
            <Plus className="h-3 w-3" />
            Dodaj
          </Button>
          <button
            type="button"
            onClick={() => setManaging((v) => !v)}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px]",
              managing
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Pencil className="h-3 w-3" />
            {managing ? "Gotowe" : "Edytuj listę"}
          </button>
          {managing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
              onClick={handleReset}
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          ) : null}
        </div>
      ) : null}

      {!hideNote && noteCollapsible && !noteOpen ? (
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Dodaj notatkę (opcjonalnie)
        </button>
      ) : null}
      {!hideNote && (!noteCollapsible || noteOpen) ? (
        <Textarea
          rows={rows}
          maxLength={maxLength}
          value={text || ""}
          onChange={(e) => onTextChange?.(e.target.value)}
          placeholder="Notatka (opcjonalnie)…"
          className="text-sm"
        />
      ) : null}
    </div>
  );
}
