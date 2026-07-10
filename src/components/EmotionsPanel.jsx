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
    size === "xs" ? "w-3.5 h-3.5" : size === "sm" ? "w-4 h-4" : "w-6 h-6";
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
          aria-label={`Ocena ${n}`}
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

function EmotionTag({ active, emoji, label, onClick, readOnly = false, compact = false }) {
  if (readOnly) {
    if (!active) return null;
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded-full border bg-blue-600/10 border-blue-500/30 text-slate-800 dark:text-slate-100",
        compact ? "px-1.5 py-0 text-[10px] gap-0.5" : "px-3 py-1.5 text-sm gap-1.5"
      )}>
        <span className={cn("leading-none", compact ? "text-xs" : "text-base")}>{emoji}</span>
        <span>{label}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center rounded-full border transition",
        compact ? "gap-0.5 px-1.5 py-0 text-[10px]" : "gap-1.5 px-3 py-1.5 text-sm",
        active
          ? "bg-blue-600 border-blue-600 text-white shadow-sm"
          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-blue-400"
      )}
    >
      <span className={cn("leading-none", compact ? "text-xs" : "text-base")}>{emoji}</span>
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
      "rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40",
      compact ? "space-y-1.5 p-2" : "space-y-3 p-4"
    )}>
      <h3 className={cn(
        "font-semibold text-slate-900 dark:text-slate-100 shrink-0",
        compact ? "text-[10px] leading-tight" : "text-sm"
      )}>{stage.title}</h3>

      {value.rating > 0 || !readOnly ? (
        <div className="shrink-0">
          <StarRating
            value={value.rating}
            onChange={(rating) => onChange({ ...value, rating })}
            readOnly={readOnly}
            size={compact ? "xs" : "md"}
          />
        </div>
      ) : null}

      {(readOnly ? value.tags.length > 0 : true) && (
        <div className={cn("flex flex-wrap", compact ? "gap-1" : "gap-2")}>
          {stage.options.map((opt) => (
            <EmotionTag
              key={opt.label}
              emoji={opt.emoji}
              label={opt.label}
              active={value.tags.includes(opt.label)}
              readOnly={readOnly}
              compact={compact}
              onClick={() => toggleTag(opt.label)}
            />
          ))}
        </div>
      )}

      <div>
        {(compact || !readOnly) && (
          <p className={cn(
            "font-medium text-slate-500 dark:text-slate-400",
            compact ? "text-[10px] mb-0.5" : "text-xs mb-1"
          )}>
            Komentarz
          </p>
        )}
        {readOnly ? (
          value.comment.trim() ? (
            <AutoGrowTextarea
              value={value.comment}
              readOnly
              className={compact ? "text-[11px] leading-snug" : "text-sm"}
            />
          ) : null
        ) : (
          <AutoGrowTextarea
            value={value.comment}
            onChange={(next) => onChange({ ...value, comment: next })}
            placeholder={stage.placeholder}
            minRows={1}
            className={compact ? "text-[11px] py-1" : "text-sm"}
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
      compact ? "gap-1.5" : "space-y-3"
    )}>
      {readOnly && !hasAnyStage && !hasSetupData && (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
          Brak wpisów w dzienniku emocji.
        </p>
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
  compact = false,
}) {
  return (
    <div
      className={cn(
        "shrink-0 flex flex-col w-full lg:w-[290px]",
        "border border-slate-200/80 dark:border-slate-700",
        "bg-white dark:bg-card",
        "rounded-xl lg:rounded-r-none lg:rounded-l-xl",
        "shadow-lg shadow-slate-900/5 dark:shadow-black/20",
        className
      )}
    >
      <div className={cn(
        "bg-gradient-to-r from-purple-900 via-violet-900 to-purple-900 text-white border-b border-slate-700/80 flex items-center justify-between shrink-0",
        compact ? "px-3 py-1.5" : "px-4 py-3"
      )}>
        <div>
          <h3 className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>Dziennik emocji</h3>
          <p className={cn("text-violet-200/80", compact ? "text-[10px]" : "text-[11px]")}>
            Setup · przed · w trakcie · po
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-violet-200 hover:bg-white/10 p-1 rounded-lg transition"
            aria-label="Zamknij panel emocji"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className={cn(compact ? "p-2" : "p-3 sm:p-4")}>
        <EmotionsPanelContent
          value={value}
          onChange={onChange}
          setupConfidence={setupConfidence}
          onSetupConfidenceChange={onSetupConfidenceChange}
          setupConfidenceComment={setupConfidenceComment}
          onSetupConfidenceCommentChange={onSetupConfidenceCommentChange}
          readOnly={readOnly}
          showSetupConfidence={showSetupConfidence}
          compact={compact}
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
      <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto bg-white dark:bg-card">
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
