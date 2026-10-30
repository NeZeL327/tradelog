import { cn } from "@/lib/utils";
import CountUpText from "@/components/CountUpText";

const TONE_CLASS = { profit: "text-ds-pos", loss: "text-ds-neg", warn: "text-ds-warn" };
const EMPTY = "—";

/**
 * Pasek kluczowych liczb: osobne szklane kafelki (16px, --ds-s2, --ds-line).
 * items: [{ key, label, value, hint?, tone?: "profit"|"loss"|"warn", title? }].
 * Brak wartości (null/undefined/"") wyświetla się jako "—", nigdy jako 0.
 * columns: klasy siatki; domyślnie 2 → 3 → 5 kolumn.
 */
export default function KpiStrip({ items, columns = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5", className }) {
  return (
    <div className={cn("grid gap-3", columns, className)}>
      {items.map((item) => {
        const value = item.value == null || item.value === "" ? EMPTY : String(item.value);
        return (
          <div
            key={item.key}
            className="min-w-0 rounded-[16px] border border-ds-line bg-ds-s2 px-4 py-3.5"
            title={item.title || [item.label, value, item.hint].filter(Boolean).join(" — ")}
          >
            <p className="type-section mb-2 break-words">{item.label}</p>
            <p className={cn("type-metric-sm font-semibold break-words", TONE_CLASS[item.tone] || "text-ds-text")}>
              <CountUpText text={value} />
            </p>
            {item.hint ? <p className="type-secondary mt-1.5 line-clamp-2">{item.hint}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
