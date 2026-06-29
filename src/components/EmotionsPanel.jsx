import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";

// Predefiniowane emocje dla kazdej fazy trade'u (zgodnie z dziennikiem psychologii)
const EMOTION_STAGES = [
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

// Normalizuje dane z trade'u (moga byc niepelne) do pelnej struktury
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

// Liczba wypelnionych sekcji (rating lub tagi lub komentarz) — do badge na przycisku
export const countFilledEmotionStages = (emotions) => {
  const data = normalizeEmotions(emotions);
  return Object.values(data).filter(
    (s) => s.rating > 0 || s.tags.length > 0 || s.comment.trim().length > 0
  ).length;
};

function StarRating({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? 0 : n)}
          className="p-0.5 transition-transform hover:scale-110"
          aria-label={`Ocena ${n}`}
        >
          <Star
            className={`w-6 h-6 ${
              n <= value
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-slate-300 dark:text-slate-600"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function EmotionTag({ active, emoji, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition ${
        active
          ? "bg-blue-600 border-blue-600 text-white shadow-sm"
          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-blue-400"
      }`}
    >
      <span className="text-base leading-none">{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

function EmotionStage({ stage, value, onChange }) {
  const toggleTag = (label) => {
    const tags = value.tags.includes(label)
      ? value.tags.filter((t) => t !== label)
      : [...value.tags, label];
    onChange({ ...value, tags });
  };

  return (
    <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{stage.title}</h3>

      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Ocena (1–5)</p>
        <StarRating value={value.rating} onChange={(rating) => onChange({ ...value, rating })} />
      </div>

      <div className="flex flex-wrap gap-2">
        {stage.options.map((opt) => (
          <EmotionTag
            key={opt.label}
            emoji={opt.emoji}
            label={opt.label}
            active={value.tags.includes(opt.label)}
            onClick={() => toggleTag(opt.label)}
          />
        ))}
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Komentarz (opcjonalnie)</p>
        <Textarea
          value={value.comment}
          onChange={(e) => onChange({ ...value, comment: e.target.value })}
          placeholder={stage.placeholder}
          rows={2}
        />
      </div>
    </div>
  );
}

export default function EmotionsPanel({ open, onOpenChange, value, onChange }) {
  const emotions = normalizeEmotions(value);

  const updateStage = (key, next) => {
    onChange({ ...emotions, [key]: next });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-full sm:max-w-md overflow-y-auto bg-white dark:bg-card"
      >
        <SheetHeader>
          <SheetTitle>Dziennik emocji</SheetTitle>
          <SheetDescription>
            Zapisz swoje emocje przed, w trakcie i po transakcji. Pomaga to wychwycić powtarzalne błędy.
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
