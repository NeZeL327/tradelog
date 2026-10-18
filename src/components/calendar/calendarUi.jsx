import { useEffect, useState } from "react";
import { balanceForTrades } from "@/lib/pnlDisplay";
import { tradeRealizedR } from "@/lib/utils";

export const GLASS = "rounded-[16px] border border-ds-line bg-ds-s2 shadow-[var(--ds-inset)]";
export const MICRO = "text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ds-text3";

export function useMediaQuery(query) {
  const get = () => typeof window !== "undefined" && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setMatches(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

export function formatR(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}R`;
}

// unit "pnl" follows the app-wide $ / % toggle; "r" is a local Calendar option.
export function makeValueFormat(pnl, unit) {
  const hasData = (bucket) => Boolean(bucket?.trades.length);
  const value = (bucket) => {
    if (!hasData(bucket)) return null;
    if (unit === "r") return bucket.rCount ? bucket.r : null;
    return bucket.pl;
  };
  return {
    unit,
    value,
    text: (bucket) => {
      if (!hasData(bucket)) return "—";
      if (unit === "r") return bucket.rCount ? formatR(bucket.r) : "—";
      return pnl.formatTrades(bucket.trades);
    },
    trade: (trade) => (unit === "r" ? formatR(tradeRealizedR(trade)) : pnl.formatTrade(trade)),
    // Derived amounts (e.g. averages) in the active unit; trades give the % mode its balance.
    amount: (amountValue, trades) => {
      if (amountValue == null || !Number.isFinite(amountValue)) return "—";
      return unit === "r" ? formatR(amountValue) : pnl.formatAmount(amountValue, balanceForTrades(trades, pnl.accounts));
    },
    maxAbs: (buckets) => Math.max(0, ...buckets.map((bucket) => Math.abs(value(bucket) ?? 0))),
  };
}

export const POS_TEXT = "var(--cal-pos)";
export const NEG_TEXT = "var(--cal-neg)";

// Text tone; --cal-* darken the P&L colors in light theme so values on heat tints stay AA.
export function toneOf(value) {
  if (value == null || !Number.isFinite(value) || value === 0) return "var(--ds-text2)";
  return value > 0 ? POS_TEXT : NEG_TEXT;
}

export function glowOf(value) {
  if (!value) return undefined;
  return `0 0 18px color-mix(in srgb, ${toneOf(value)} 25%, transparent)`;
}

// Heat tint scaled by the period's largest absolute day (4%–24% of the raw tone token).
export function heatBackground(value, maxAbs) {
  if (!value || !maxAbs) return undefined;
  const level = Math.min(1, Math.abs(value) / maxAbs);
  return `color-mix(in srgb, ${value > 0 ? "var(--ds-pos)" : "var(--ds-neg)"} ${Math.round(4 + level * 20)}%, transparent)`;
}

// CSS `capitalize` would also capitalize Polish month genitives ("15 Października").
export function capFirst(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function percent(value) {
  return value == null ? "—" : `${Math.round(value)}%`;
}

export function Segmented({ label, value, options, onChange }) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-8 items-center gap-0.5 rounded-full border border-ds-line bg-ds-s2 p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          title={option.title}
          onClick={() => onChange(option.id)}
          className={`h-[26px] rounded-full px-3 text-[12px] font-medium transition-colors duration-150 ${
            value === option.id ? "bg-ds-s3 text-ds-text" : "text-ds-text3 hover:text-ds-text2"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
