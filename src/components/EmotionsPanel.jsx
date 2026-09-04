import { useRef, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";

export const EMOTION_STAGES = [
  {
    key: "before",
    title: "🧠 Emocje przed wejściem",
    placeholder: 'Np. "Po dwóch SL chciałem szybko odrobić."',
    options: [
      { emoji: "😌", label: "Spokój" },
      { emoji: "🙂", label: "Pewność siebie" },
      { emoji: "😐", label: "Neutralnie" },
      { emoji: "😰", label: "Stres" },
      { emoji: "😨", label: "Strach" },
      { emoji: "🤩", label: "Chciwość / FOMO" },
      { emoji: "😤", label: "Chęć odegrania się (Revenge)" },
    ],
  },
  {
    key: "during",
    title: "📈 Emocje w trakcie trade'u",
    placeholder: '"Przesunąłem SL za wcześnie."',
    options: [
      { emoji: "😌", label: "Spokój" },
      { emoji: "😬", label: "Niepewność" },
      { emoji: "😰", label: "Stres" },
      { emoji: "😱", label: "Panika" },
      { emoji: "🤞", label: "Nadzieja" },
      { emoji: "😤", label: "Złość" },
      { emoji: "😴", label: "Nuda" },
    ],
  },
  {
    key: "after",
    title: "✅ Emocje po zakończeniu",
    placeholder: "Co czułeś po zamknięciu pozycji?",
    options: [
      { emoji: "😊", label: "Satysfakcja" },
      { emoji: "😐", label: "Obojętność" },
      { emoji: "😞", label: "Rozczarowanie" },
      { emoji: "😡", label: "Złość" },
      { emoji: "😌", label: "Ulga" },
      { emoji: "🤔", label: "Chęć analizy" },
      { emoji: "🎯", label: "Dyscyplina" },
    ],
  },
];

const emptyStage = () => ({ rating: 0, tags: [], comment: "" });

export const createEmptyEmotions = () => ({
  before: emptyStage(),
  during: emptyStage(),
  after: emptyStage(),
});

export const normalizeEmotions = (raw) => {
  const base = createEmptyEmotions();
  if (!raw || typeof raw !== "object") return base;
  for (const key of Object.keys(base)) {
    const stage = raw[key];
    if (stage && typeof stage === "object") {
      base[key] = {
        rating: Number(stage.rating) || 0,
        tags: Array.isArray(stage.tags) ? stage.tags : [],
        comment: typeof stage.comment === "string" ? stage.comment : "",
      };
    }
  }
  return base;
};

export const countFilledEmotionStages = (emotions) => {
  const data = normalizeEmotions(emotions);
  return Object.values(data).filter(
    (s) => s.rating > 0 || s.tags.length > 0 || s.comment.trim().length > 0
  ).length;
};

function StarRating({ value, onChange, readOnly = false, size = "md" }) {
  const starClass =
    size === "xs" ? "w-3.5 h-3.5" : size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(value === n ? 0 : n)}
          className={cn(
            "p-0.5 transition-transform",
            !readOnly && "hover:scale-110",
            readOnly && "cursor-default"
          )}
          aria-label={`Intensywność ${n}`}
        >
          <Star
            className={cn(
              starClass,
              n <= value
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-slate-300 dark:text-slate-600"
            )}
          />
        </button>
      ))}
    </div>
  );
}

const INTENSITY_LEVELS = [
  { n: 1, label: "Spokój", hint: "prawie brak emocji", color: "text-emerald-600 dark:text-emerald-400" },
  { n: 2, label: "Lekko", hint: "delikatne emocje", color: "text-lime-600 dark:text-lime-400" },
  { n: 3, label: "Umiarkowanie", hint: "wyczuwalne napięcie", color: "text-amber-600 dark:text-amber-400" },
  { n: 4, label: "Silnie", hint: "dużo emocji", color: "text-orange-600 dark:text-orange-400" },
  { n: 5, label: "Bardzo mocno", hint: "przeładowanie", color: "text-rose-600 dark:text-rose-400" },
];

function MiniStars({ count, active = false }) {
  return (
    <span className="inline-flex items-center gap-px shrink-0" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "w-2.5 h-2.5",
            i <= count
              ? active
                ? "fill-amber-400 text-amber-400"
                : "fill-amber-400/70 text-amber-400/70"
              : "fill-transparent text-slate-300/80 dark:text-slate-600"
          )}
        />
      ))}
    </span>
  );
}

/** Ładna legenda skali 1–5 z gwiazdkami i opisami */
function IntensityLegend({ value = 0, variant = "full" }) {
  if (variant === "selected") {
    const level = INTENSITY_LEVELS.find((l) => l.n === value);
    if (!level) return null;
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-1">
        <MiniStars count={value} active />
        <span className={cn("text-[10px] font-semibold leading-none", level.color)}>
          {level.n}. {level.label}
        </span>
        <span className="text-[10px] text-muted-foreground leading-none truncate">
          — {level.hint}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/25 bg-gradient-to-b from-amber-500/[0.08] to-transparent p-1.5 space-y-1">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/90 dark:text-amber-200/90">
          Skala intensywności
        </p>
        <p className="text-[9px] text-muted-foreground">1 = mało · 5 = dużo</p>
      </div>
      <ul className="space-y-px">
        {INTENSITY_LEVELS.map((level) => {
          const active = value === level.n;
          return (
            <li
              key={level.n}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors",
                active
                  ? "bg-amber-400/20 ring-1 ring-amber-400/40"
                  : "hover:bg-muted/40"
              )}
            >
              <MiniStars count={level.n} active={active} />
              <span className={cn("text-[10px] font-bold tabular-nums shrink-0", level.color)}>
                {level.n}
              </span>
              <span className={cn(
                "text-[10px] font-semibold truncate",
                active ? "text-foreground" : "text-foreground/90"
              )}>
                {level.label}
              </span>
              <span className="text-[9px] text-muted-foreground truncate ml-auto">
                {level.hint}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EmotionTag({ active, emoji, label, onClick, readOnly = false, compact = false }) {
  if (readOnly) {
    if (!active) return null;
    return (
      <span className={cn(
        "inline-flex items-center rounded-full border bg-primary/10 border-primary/30 text-foreground",
        compact ? "px-1.5 py-0.5 text-[10px] gap-0.5" : "px-2 py-0.5 text-[11px] gap-1"
      )}>
        <span className={cn("leading-none", compact ? "text-[11px]" : "text-xs")}>{emoji}</span>
        <span>{label}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border transition min-h-[1.55rem]",
        compact ? "gap-0.5 px-1.5 py-0.5 text-[10px]" : "gap-1 px-2 py-0.5 text-[11px]",
        active
          ? "bg-primary border-primary text-primary-foreground"
          : "bg-background/80 border-border/80 text-muted-foreground hover:border-primary/50 hover:text-foreground"
      )}
    >
      <span className={cn("leading-none", compact ? "text-[11px]" : "text-xs")}>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  className,
  readOnly = false,
  minRows = 1,
}) {
  const ref = useRef(null);

  const adjustHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, minRows * 22)}px`;
  }, [minRows]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  if (readOnly) {
    if (!String(value || "").trim()) return null;
    return (
      <p className={cn(
        "text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words",
        className
      )}>
        {value}
      </p>
    );
  }

  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        requestAnimationFrame(adjustHeight);
      }}
      onInput={adjustHeight}
      placeholder={placeholder}
      rows={minRows}
      className={cn("resize-none overflow-hidden min-h-0", className)}
    />
  );
}

function SetupConfidenceBlock({
  setupConfidence,
  onSetupConfidenceChange,
  setupConfidenceComment = "",
  onSetupConfidenceCommentChange,
  readOnly = false,
  compact = false,
  t,
}) {
  const hasStars = Number(setupConfidence) > 0;
  const hasComment = String(setupConfidenceComment || "").trim().length > 0;
  if (readOnly && !hasStars && !hasComment) return null;
  if (!readOnly && !onSetupConfidenceChange && !onSetupConfidenceCommentChange) return null;

  return (
    <div className={cn(
      "rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30",
      compact ? "space-y-1.5 p-2" : "space-y-2 p-4"
    )}>
      <Label className={cn(
        "block font-semibold text-slate-900 dark:text-slate-100 shrink-0",
        compact ? "text-[11px]" : "text-sm"
      )}>
        {t("setupConfidence")}
      </Label>
      {!compact && (
        <p className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
          {t("setupConfidenceHint")}
        </p>
      )}
      {(hasStars || !readOnly) && (
        <div className="shrink-0">
          <StarRating
            value={Number(setupConfidence) || 0}
            onChange={onSetupConfidenceChange}
            readOnly={readOnly}
            size={compact ? "xs" : "sm"}
          />
        </div>
      )}
      {!readOnly && (
        <div>
          <p className={cn(
            "font-medium text-slate-500 dark:text-slate-400",
            compact ? "text-[10px] mb-0.5" : "text-xs mb-1"
          )}>
            {t("setupConfidenceCommentLabel")}
          </p>
          <AutoGrowTextarea
            value={setupConfidenceComment}
            onChange={(next) => onSetupConfidenceCommentChange?.(next)}
            placeholder={t("setupConfidenceCommentPlaceholder")}
            minRows={1}
            className={compact ? "text-[11px] py-1" : "text-sm"}
          />
        </div>
      )}
      {readOnly && hasComment && (
        <div>
          <p className={cn(
            "font-medium text-slate-500 dark:text-slate-400",
            compact ? "text-[10px] mb-0.5" : "text-xs mb-1"
          )}>
            {t("setupConfidenceCommentLabel")}
          </p>
          <AutoGrowTextarea
            value={setupConfidenceComment}
            readOnly
            className={compact ? "text-[11px] leading-snug" : "text-sm"}
          />
        </div>
      )}
    </div>
  );
}

function EmotionStage({ stage, value, onChange, readOnly = false, compact = false }) {
  const toggleTag = (label) => {
    const tags = value.tags.includes(label)
      ? value.tags.filter((t) => t !== label)
      : [...value.tags, label];
    onChange({ ...value, tags });
  };

  const isEmpty = value.rating === 0 && value.tags.length === 0 && !value.comment.trim();
  if (readOnly && isEmpty) return null;

  return (
    <div className={cn(
      "rounded-xl border border-border/60 bg-muted/20 dark:bg-white/[0.03]",
      compact ? "space-y-1.5 p-2" : "space-y-2 p-2.5"
    )}>
      <h3 className={cn(
        "font-semibold uppercase tracking-wide text-muted-foreground shrink-0",
        compact ? "text-[10px] leading-tight" : "text-[10px]"
      )}>{stage.title}</h3>

      {value.rating > 0 || !readOnly ? (
        <div className="shrink-0 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground">Intensywność emocji</p>
          <StarRating
            value={value.rating}
            onChange={(rating) => onChange({ ...value, rating })}
            readOnly={readOnly}
            size="xs"
          />
          {value.rating > 0 ? (
            <IntensityLegend value={value.rating} variant="selected" />
          ) : !readOnly ? (
            <p className="text-[10px] text-muted-foreground/80 leading-snug">
              Kliknij gwiazdki — 1 spokój, 5 bardzo mocno
            </p>
          ) : null}
        </div>
      ) : null}

      {(readOnly ? value.tags.length > 0 : true) && (
        <div className={cn("flex flex-wrap", compact ? "gap-1" : "gap-1")}>
          {stage.options.map((opt) => (
            <EmotionTag
              key={opt.label}
              emoji={opt.emoji}
              label={opt.label}
              active={value.tags.includes(opt.label)}
              readOnly={readOnly}
              compact
              onClick={() => toggleTag(opt.label)}
            />
          ))}
        </div>
      )}

      <div>
        {(compact || !readOnly) && (
          <p className="text-[10px] font-medium text-muted-foreground mb-0.5">
            Komentarz
          </p>
        )}
        {readOnly ? (
          value.comment.trim() ? (
            <AutoGrowTextarea
              value={value.comment}
              readOnly
              className="text-[12px] leading-snug"
            />
          ) : null
        ) : (
          <AutoGrowTextarea
            value={value.comment}
            onChange={(next) => onChange({ ...value, comment: next })}
            placeholder={stage.placeholder}
            minRows={1}
            className="text-[12px] py-1 min-h-[28px] border-border/70 bg-muted/25 dark:bg-white/[0.03]"
          />
        )}
      </div>
    </div>
  );
}

/** Editable / readonly emotion journal content + setup confidence at top */
export function EmotionsPanelContent({
  value,
  onChange,
  setupConfidence = 0,
  onSetupConfidenceChange,
  setupConfidenceComment = "",
  onSetupConfidenceCommentChange,
  readOnly = false,
  showSetupConfidence = true,
  compact = false,
}) {
  const { t } = useLanguage();
  const emotions = normalizeEmotions(value);

  const updateStage = (key, next) => {
    onChange?.({ ...emotions, [key]: next });
  };

  const hasAnyStage = EMOTION_STAGES.some((stage) => {
    const st = emotions[stage.key];
    return st.rating > 0 || st.tags.length > 0 || st.comment.trim().length > 0;
  });
  const hasSetupData =
    Number(setupConfidence) > 0 || String(setupConfidenceComment || "").trim().length > 0;

  return (
    <div className={cn(
      "flex flex-col",
      compact ? "gap-1.5" : "gap-2"
    )}>
      {readOnly && !hasAnyStage && !hasSetupData && (
        <p className="text-[12px] text-muted-foreground text-center py-4">
          Brak wpisów w dzienniku emocji.
        </p>
      )}

      {!readOnly && (
        <IntensityLegend value={0} variant="full" />
      )}

      {showSetupConfidence && (
        <SetupConfidenceBlock
          setupConfidence={setupConfidence}
          onSetupConfidenceChange={onSetupConfidenceChange}
          setupConfidenceComment={setupConfidenceComment}
          onSetupConfidenceCommentChange={onSetupConfidenceCommentChange}
          readOnly={readOnly}
          compact={compact}
          t={t}
        />
      )}

      {EMOTION_STAGES.map((stage) => (
        <EmotionStage
          key={stage.key}
          stage={stage}
          value={emotions[stage.key]}
          onChange={(next) => updateStage(stage.key, next)}
          readOnly={readOnly}
          compact={compact}
        />
      ))}
    </div>
  );
}

/** Inline panel glued to the left side of a form / detail view */
export function EmotionsInlinePanel({
  value,
  onChange,
  setupConfidence = 0,
  onSetupConfidenceChange,
  setupConfidenceComment = "",
  onSetupConfidenceCommentChange,
  readOnly = false,
  showSetupConfidence = true,
  onClose,
  className,
  compact = true,
}) {
  return (
    <div
      className={cn(
        "shrink-0 flex flex-col h-fit self-start w-full lg:w-[260px] text-[12px]",
        "border border-border/70",
        "bg-background dark:bg-card",
        "rounded-xl lg:rounded-r-none lg:rounded-l-xl",
        "shadow-md shadow-slate-900/5 dark:shadow-black/20",
        className
      )}
    >
      <div className="bg-muted/50 border-b border-border flex items-center justify-between shrink-0 px-2.5 py-1.5">
        <div className="min-w-0">
          <h3 className="font-semibold text-[12px] leading-tight">Dziennik emocji</h3>
          <p className="text-[10px] text-muted-foreground leading-tight">
            przed · w trakcie · po
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted p-1 rounded-md transition shrink-0"
            aria-label="Zamknij panel emocji"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-2">
        <EmotionsPanelContent
          value={value}
          onChange={onChange}
          setupConfidence={setupConfidence}
          onSetupConfidenceChange={onSetupConfidenceChange}
          setupConfidenceComment={setupConfidenceComment}
          onSetupConfidenceCommentChange={onSetupConfidenceCommentChange}
          readOnly={readOnly}
          showSetupConfidence={showSetupConfidence}
          compact
        />
      </div>
    </div>
  );
}

/** @deprecated Use EmotionsInlinePanel attached to form instead */
export default function EmotionsPanel({ open, onOpenChange, value, onChange }) {
  const emotions = normalizeEmotions(value);

  const updateStage = (key, next) => {
    onChange({ ...emotions, [key]: next });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto bg-card">
        <SheetHeader>
          <SheetTitle>Dziennik emocji</SheetTitle>
          <SheetDescription>
            Zapisz swoje emocje przed, w trakcie i po transakcji.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4 pb-6">
          {EMOTION_STAGES.map((stage) => (
            <EmotionStage
              key={stage.key}
              stage={stage}
              value={emotions[stage.key]}
              onChange={(next) => updateStage(stage.key, next)}
            />
          ))}
          <Button type="button" className="w-full" onClick={() => onOpenChange(false)}>
            Gotowe
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
