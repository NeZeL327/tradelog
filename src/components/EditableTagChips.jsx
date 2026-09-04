import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Pencil, Plus, RotateCcw, X } from "lucide-react";
import {
  DEFAULT_CONFLUENCES,
  DEFAULT_MISTAKES,
  DEFAULT_PSYCHOLOGY,
  addTagToList,
  normalizeTagLabel,
  remapSelectedTags,
  removeTagFromList,
  renameTagInList,
} from "@/lib/tradeTags";

const chipBase =
  "px-2 py-0.5 rounded-full text-[11px] leading-tight border transition min-h-[1.6rem] inline-flex items-center gap-1";

const ACCENTS = {
  emerald: {
    active: "bg-emerald-600 border-emerald-600 text-white shadow-sm",
    idle: "bg-background/80 border-border/80 text-muted-foreground hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300",
    manage: "border-emerald-400/60 bg-emerald-500/10",
    section: "bg-emerald-500/[0.04] dark:bg-emerald-400/[0.06] border-emerald-500/20",
    icon: "text-emerald-600",
  },
  rose: {
    active: "bg-rose-600 border-rose-600 text-white shadow-sm",
    idle: "bg-background/80 border-border/80 text-muted-foreground hover:border-rose-400 hover:text-rose-700 dark:hover:text-rose-300",
    manage: "border-rose-400/60 bg-rose-500/10",
    section: "bg-rose-500/[0.04] dark:bg-rose-400/[0.06] border-rose-500/20",
    icon: "text-rose-500",
  },
  violet: {
    active: "bg-primary border-primary text-primary-foreground",
    idle: "bg-background/80 border-border/80 text-muted-foreground hover:border-primary/50 hover:text-foreground",
    manage: "border-primary/60 bg-primary/10",
    section: "bg-muted/40 border-border",
    icon: "text-muted-foreground",
  },
};

/**
 * Multi-select chips with editable vocabulary (add / rename / delete / reset).
 */
export default function EditableTagChips({
  label,
  icon: Icon,
  accent = "emerald",
  options = [],
  selected = [],
  onToggle,
  onOptionsChange,
  onSelectedChange,
  kind = "confluences",
  sectionClassName,
  labelClassName,
}) {
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingTag, setEditingTag] = useState(null);
  const [editValue, setEditValue] = useState("");
  const styles = ACCENTS[accent] || ACCENTS.emerald;
  const defaults =
    kind === "mistakes"
      ? DEFAULT_MISTAKES
      : kind === "psychology"
        ? DEFAULT_PSYCHOLOGY
        : DEFAULT_CONFLUENCES;

  useEffect(() => {
    if (!managing) {
      setEditingTag(null);
      setEditValue("");
    }
  }, [managing]);

  const selectedSet = new Set((selected || []).map((t) => normalizeTagLabel(t)));

  const commitOptions = (nextOptions, nextSelected) => {
    onOptionsChange?.(nextOptions);
    if (nextSelected) onSelectedChange?.(nextSelected);
  };

  const handleAdd = () => {
    const { list, added } = addTagToList(options, draft, defaults);
    if (!added) {
      setDraft("");
      return;
    }
    commitOptions(list);
    setDraft("");
    // Auto-select newly added tag on the current trade
    if (!selectedSet.has(added)) onToggle?.(added);
  };

  const handleRemoveOption = (tag) => {
    const next = removeTagFromList(options, tag, defaults);
    const nextSelected = (selected || []).filter(
      (t) => normalizeTagLabel(t).toLowerCase() !== normalizeTagLabel(tag).toLowerCase()
    );
    commitOptions(next, nextSelected);
  };

  const startRename = (tag) => {
    setEditingTag(tag);
    setEditValue(tag);
  };

  const commitRename = () => {
    if (!editingTag) return;
    const { list, renamed } = renameTagInList(options, editingTag, editValue, defaults);
    if (!renamed) {
      setEditingTag(null);
      setEditValue("");
      return;
    }
    const nextSelected = remapSelectedTags(selected, editingTag, normalizeTagLabel(editValue));
    commitOptions(list, nextSelected);
    setEditingTag(null);
    setEditValue("");
  };

  const handleReset = () => {
    const nextSelected = (selected || []).filter((t) =>
      defaults.some((d) => d.toLowerCase() === normalizeTagLabel(t).toLowerCase())
    );
    commitOptions([...defaults], nextSelected);
  };

  return (
    <div className={cn("rounded-xl border border-border/60 p-2.5 sm:p-3 space-y-2", styles.section, sectionClassName)}>
      <div className="flex items-center justify-between gap-2">
        <Label className={cn("text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5 mb-0", labelClassName)}>
          {Icon ? <Icon className={cn("w-3.5 h-3.5", styles.icon)} /> : null}
          {label}
        </Label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setManaging((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] border transition",
              managing
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            title="Dodaj, zmień nazwę lub usuń z listy"
          >
            <Pencil className="w-3 h-3" />
            {managing ? "Gotowe" : "Edytuj listę"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {(options || []).map((tag) => {
          const active = selectedSet.has(tag);
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
                  className="h-7 w-36 text-[11px] px-2"
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
                if (managing) startRename(tag);
                else onToggle?.(tag);
              }}
              className={cn(
                chipBase,
                managing ? styles.manage : active ? styles.active : styles.idle
              )}
              title={managing ? "Kliknij, aby zmienić nazwę" : undefined}
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
                  title="Usuń z listy"
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
          );
        })}
        {(options || []).length === 0 && (
          <span className="text-[11px] text-muted-foreground py-0.5">
            Lista pusta — dodaj własne warunki poniżej
          </span>
        )}
      </div>

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
          placeholder={kind === "mistakes" ? "Nowy błąd…" : "Nowy warunek…"}
          className="h-7 flex-1 min-w-[8rem] text-[11px] px-2"
          maxLength={48}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px] gap-1"
          onClick={handleAdd}
          disabled={!normalizeTagLabel(draft)}
        >
          <Plus className="w-3 h-3" />
          Dodaj
        </Button>
        {managing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 text-muted-foreground"
            onClick={handleReset}
            title="Przywróć domyślną listę"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </Button>
        )}
      </div>

      {managing && (
        <p className="text-[10px] text-muted-foreground leading-snug">
          Tryb edycji: kliknij chip = zmień nazwę, × = usuń z listy (stare trejdy w Analytics zostają).
        </p>
      )}
    </div>
  );
}
