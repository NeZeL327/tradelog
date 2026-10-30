import { cn } from "@/lib/utils";

/**
 * Komórka mapy cieplnej: kolor zysku/straty (tokeny --ds-pos/--ds-neg) o sile |value|/maxAbs.
 * Gdy count < minCount albo brak wartości — szara komórka bez koloru (za mało danych).
 */
export default function HeatCell({ value, count = 0, maxAbs = 0, minCount = 1, label, title, className, onClick }) {
  const enough = value != null && Number.isFinite(value) && count >= minCount;
  const strength = enough && maxAbs > 0 ? Math.round(15 + 70 * Math.min(1, Math.abs(value) / maxAbs)) : 0;
  const color = value > 0 ? "var(--ds-pos)" : "var(--ds-neg)";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "flex h-8 min-w-0 items-center justify-center rounded-md border border-ds-line text-[10px] font-medium tabular-nums",
        enough ? "text-ds-text" : "bg-ds-s2 text-ds-text3",
        className
      )}
      style={enough && strength ? { backgroundColor: `color-mix(in srgb, ${color} ${strength}%, transparent)` } : undefined}
    >
      {label}
    </Tag>
  );
}
