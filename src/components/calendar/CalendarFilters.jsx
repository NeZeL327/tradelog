import { X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { directionLabel, normalizeDirection } from "@/lib/utils";
import { tradeTags } from "@/lib/calendarAggregates";

export const EMPTY_FILTERS = { account: "all", strategy: "all", session: "all", side: "all", tag: "all" };

function distinct(trades, read) {
  const values = new Map();
  trades.forEach((trade) => [].concat(read(trade)).forEach((entry) => {
    if (entry?.value && !values.has(entry.value)) values.set(entry.value, entry.label || entry.value);
  }));
  return [...values.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

// Only filters that can actually narrow the current data are returned.
export function buildFilterDefs({ trades, accounts, strategyOf, plText, t }) {
  const accountName = (id) => accounts.find((account) => String(account.id) === id)?.name || id;
  const defs = [
    { id: "account", label: plText ? "Konto" : "Account", min: 2, options: distinct(trades, (trade) => (trade.account_id ? { value: String(trade.account_id), label: accountName(String(trade.account_id)) } : null)) },
    { id: "strategy", label: plText ? "Strategia" : "Strategy", min: 2, options: distinct(trades, (trade) => ({ value: strategyOf(trade) })) },
    { id: "session", label: plText ? "Sesja" : "Session", min: 2, options: distinct(trades, (trade) => ({ value: String(trade.session || "").trim() })) },
    { id: "side", label: plText ? "Kierunek" : "Side", min: 2, options: distinct(trades, (trade) => {
      const side = normalizeDirection(trade.direction);
      return side ? { value: side, label: directionLabel(side, t) } : null;
    }) },
    { id: "tag", label: plText ? "Tag" : "Tag", min: 1, options: distinct(trades, (trade) => tradeTags(trade).map((tag) => ({ value: tag }))) },
  ];
  return defs.filter((def) => def.options.length >= def.min);
}

export default function CalendarFilters({ defs, filters, onChange, plText }) {
  if (!defs.length) return null;
  const activeCount = Object.values(filters).filter((value) => value !== "all").length;
  return (
    <div role="group" aria-label={plText ? "Filtry" : "Filters"} className="flex flex-wrap items-center gap-2">
      {defs.map((def) => {
        const active = filters[def.id] !== "all";
        return (
          <Select key={def.id} value={filters[def.id]} onValueChange={(value) => onChange({ ...filters, [def.id]: value })}>
            <SelectTrigger
              aria-label={def.label}
              className={`h-8 w-auto min-w-[112px] max-w-[200px] rounded-full px-3.5 text-[12px] [&>span]:text-left ${
                active ? "border-ds-frame bg-ds-s3 text-ds-text" : "text-ds-text2"
              }`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{def.label}: {plText ? "wszystkie" : "all"}</SelectItem>
              {def.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
      {activeCount ? (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] text-ds-text2 transition-colors duration-150 hover:bg-ds-s3 hover:text-ds-text"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          {plText ? `Wyczyść (${activeCount})` : `Clear (${activeCount})`}
        </button>
      ) : null}
    </div>
  );
}
