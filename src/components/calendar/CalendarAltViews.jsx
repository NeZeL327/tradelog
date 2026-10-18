import { format } from "date-fns";
import { tradeCountLabel } from "@/components/DayReview";
import { winRate } from "@/lib/calendarAggregates";
import { directionLabel, getTradeRealizedPL } from "@/lib/utils";
import { formatTradeClock } from "@/lib/userSettings";
import { GLASS, MICRO, capFirst, glowOf, heatBackground, percent, toneOf } from "@/components/calendar/calendarUi";
import { dayAriaLabel } from "@/components/calendar/CalendarMonthGrid";

const tradeClock = (trade) => formatTradeClock(trade, "entry") || trade.open_time || "";

function WeekTrade({ trade, fmt, t, onOpenTrade }) {
  const pl = getTradeRealizedPL(trade);
  return (
    <button
      type="button"
      onClick={() => onOpenTrade(trade)}
      className="block w-full rounded-[10px] border border-ds-line bg-ds-s2 px-2.5 py-2 text-left transition-colors duration-150 hover:border-ds-frame hover:bg-ds-s3"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[12px] font-medium text-ds-text">{trade.symbol || "—"}</span>
        <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: toneOf(pl) }}>{fmt.trade(trade)}</span>
      </span>
      <span className="mt-0.5 block truncate text-[10.5px] text-ds-text3">
        {[tradeClock(trade), directionLabel(trade.direction, t)].filter(Boolean).join(" · ") || "—"}
      </span>
    </button>
  );
}

export function WeekView({ week, fmt, plText, locale, t, todayKey, selectedKey, onSelect, onOpenTrade, hideWeekends, stacked }) {
  const cells = hideWeekends ? week.cells.slice(0, 5) : week.cells;
  const maxAbs = fmt.maxAbs(cells.map((cell) => cell.bucket));
  const total = fmt.value(week.bucket);
  const rate = winRate(week.bucket);
  return (
    <section aria-label={plText ? "Widok tygodnia" : "Week view"} className={`${GLASS} p-3`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 px-1">
        <p className="text-[13px] text-ds-text2">
          {format(week.cells[0].date, "d MMM", { locale })} – {format(week.cells[6].date, "d MMM yyyy", { locale })}
        </p>
        <p className="text-[13px] tabular-nums text-ds-text2">
          <span className="font-medium" style={{ color: toneOf(total), textShadow: glowOf(total) }}>{fmt.text(week.bucket)}</span>
          {week.bucket.trades.length ? ` · ${tradeCountLabel(week.bucket.trades.length, plText)}${rate != null ? ` · ${percent(rate)}` : ""}` : ""}
        </p>
      </div>
      <div key={week.key} className="cal-slide grid gap-2" data-dir="none" style={{ gridTemplateColumns: stacked ? "minmax(0, 1fr)" : `repeat(${cells.length}, minmax(0, 1fr))` }}>
        {cells.map((cell) => {
          const has = Boolean(cell.bucket?.trades.length);
          const value = fmt.value(cell.bucket);
          const trades = has ? [...cell.bucket.trades].sort((a, b) => tradeClock(a).localeCompare(tradeClock(b))) : [];
          return (
            <div key={cell.key} className="flex min-w-0 flex-col gap-1.5">
              <button
                type="button"
                onClick={() => onSelect(cell.key)}
                aria-label={dayAriaLabel(cell, fmt, plText, locale)}
                aria-pressed={cell.key === selectedKey}
                className={`rounded-[12px] border px-2.5 py-2 text-left transition-colors duration-150 ${
                  cell.key === selectedKey ? "border-ds-frame bg-ds-sel" : "border-transparent hover:border-ds-line hover:bg-ds-s3"
                }`}
                style={{ background: cell.key !== selectedKey && has ? heatBackground(value, maxAbs) : undefined }}
              >
                <span className={`block truncate capitalize ${MICRO}`}>{format(cell.date, "EEE", { locale })}</span>
                <span className={`mt-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] tabular-nums ${cell.key === todayKey ? "font-semibold text-ds-text ring-1 ring-[color:var(--ds-accent)]" : "text-ds-text"}`}>
                  {format(cell.date, "d")}
                </span>
                <span className="mt-1 block truncate text-[14px] font-medium tabular-nums" style={{ color: toneOf(value), textShadow: glowOf(value) }}>{fmt.text(cell.bucket)}</span>
                <span className="block truncate text-[10.5px] text-ds-text3">{has ? `${cell.bucket.wins}W · ${cell.bucket.losses}L` : "\u00a0"}</span>
              </button>
              {trades.map((trade) => <WeekTrade key={trade.id} trade={trade} fmt={fmt} t={t} onOpenTrade={onOpenTrade} />)}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function yearCellColor(value, maxAbs, hasTrades) {
  if (!hasTrades) return "var(--ds-s3)";
  if (!value || !maxAbs) return "color-mix(in srgb, var(--ds-text3) 45%, var(--ds-s2))";
  const level = Math.min(1, Math.abs(value) / maxAbs);
  return `color-mix(in srgb, ${toneOf(value)} ${Math.round(28 + level * 72)}%, var(--ds-s2))`;
}

function YearCell({ cell, fmt, maxAbs, plText, locale, todayKey, selectedKey, onPick }) {
  if (!cell.inYear) return <span className="h-3 w-3" />;
  const has = Boolean(cell.bucket?.trades.length);
  const style = { background: yearCellColor(fmt.value(cell.bucket), maxAbs, has) };
  const ring = cell.key === selectedKey ? "ring-1 ring-[color:var(--ds-text)]" : cell.key === todayKey ? "ring-1 ring-[color:var(--ds-accent)]" : "";
  if (!has) return <span className={`h-3 w-3 rounded-[3px] ${ring}`} style={style} title={format(cell.date, "d MMM yyyy", { locale })} />;
  return (
    <button
      type="button"
      onClick={() => onPick(cell.key)}
      aria-label={dayAriaLabel(cell, fmt, plText, locale)}
      title={`${format(cell.date, "d MMM yyyy", { locale })} · ${fmt.text(cell.bucket)} · ${tradeCountLabel(cell.bucket.trades.length, plText)}`}
      className={`h-3 w-3 rounded-[3px] transition-transform duration-150 hover:scale-125 ${ring}`}
      style={style}
    />
  );
}

export function YearHeatmap({ year, yearNumber, fmt, plText, locale, todayKey, selectedKey, onPick }) {
  const cells = year.columns.flat();
  const maxAbs = fmt.maxAbs(cells.map((cell) => cell.bucket));
  const total = fmt.value(year.bucket);
  const rate = winRate(year.bucket);
  const weekdayLabels = plText ? ["Pn", "", "Śr", "", "Pt", "", "Nd"] : ["Mon", "", "Wed", "", "Fri", "", "Sun"];
  return (
    <section aria-label={plText ? `Mapa roku ${yearNumber}` : `Year heatmap ${yearNumber}`} className={`${GLASS} p-4`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] text-ds-text2">
          <span className="text-[18px] font-medium tabular-nums" style={{ color: toneOf(total), textShadow: glowOf(total) }}>{fmt.text(year.bucket)}</span>
          {year.tradingDays ? ` · ${year.tradingDays} ${plText ? "dni handlowych" : "trading days"}${rate != null ? ` · win rate ${percent(rate)}` : ""}` : ""}
        </p>
        <div className="flex items-center gap-1.5 text-[10.5px] text-ds-text3" aria-hidden>
          <span>− {plText ? "strata" : "loss"}</span>
          {[1, 0.5].map((level) => <span key={`n${level}`} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: yearCellColor(-level, 1, true) }} />)}
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--ds-s3)" }} />
          {[0.5, 1].map((level) => <span key={`p${level}`} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: yearCellColor(level, 1, true) }} />)}
          <span>{plText ? "zysk" : "profit"} +</span>
        </div>
      </div>
      <div className="overflow-x-auto pb-1">
        {/* Column-major flow keeps DOM (and Tab) order chronological. */}
        <div className="inline-grid gap-[3px]" style={{ gridTemplateRows: "16px repeat(7, 12px)", gridAutoFlow: "column", gridAutoColumns: "12px", gridTemplateColumns: "28px" }}>
          <span />
          {weekdayLabels.map((label, row) => (
            <span key={`r${row}`} className="pr-1 text-right text-[10px] leading-[12px] text-ds-text3">{label}</span>
          ))}
          {year.columns.map((column) => {
            const first = column.find((cell) => cell.inYear && cell.date.getDate() === 1);
            return [
              <span key={`m${column[0].key}`} className="h-4 overflow-visible whitespace-nowrap text-[10px] text-ds-text3">{first ? capFirst(format(first.date, "LLL", { locale })) : ""}</span>,
              ...column.map((cell) => <YearCell key={cell.key} cell={cell} fmt={fmt} maxAbs={maxAbs} plText={plText} locale={locale} todayKey={todayKey} selectedKey={selectedKey} onPick={onPick} />),
            ];
          })}
        </div>
      </div>
    </section>
  );
}
