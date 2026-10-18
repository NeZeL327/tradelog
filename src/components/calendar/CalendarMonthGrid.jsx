import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TagPill, tagEntries, tradeCountLabel } from "@/components/DayReview";
import { winRate } from "@/lib/calendarAggregates";
import { GLASS, MICRO, capFirst, glowOf, heatBackground, percent, toneOf } from "@/components/calendar/calendarUi";

export const WEEKDAYS_PL = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];
export const WEEKDAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function dayAriaLabel(cell, fmt, plText, locale) {
  const date = format(cell.date, "EEEE, d MMMM yyyy", { locale });
  const bucket = cell.bucket;
  if (!bucket?.trades.length) return `${date}: ${plText ? "brak transakcji" : "no trades"}`;
  const wl = plText ? `wygrane: ${bucket.wins}, straty: ${bucket.losses}` : `wins: ${bucket.wins}, losses: ${bucket.losses}`;
  return `${date}: ${fmt.text(bucket)}, ${tradeCountLabel(bucket.trades.length, plText)}, ${wl}`;
}

export function DayTooltipBody({ cell, fmt, plText, locale }) {
  const bucket = cell.bucket;
  const tags = tagEntries(bucket.trades).slice(0, 3);
  const value = fmt.value(bucket);
  return (
    <div className="min-w-[180px] space-y-1.5 py-1">
      <p className="text-[11px] text-ds-text3">{capFirst(format(cell.date, "EEEE, d MMMM", { locale }))}</p>
      <p className="text-[16px] font-medium tabular-nums" style={{ color: toneOf(value), textShadow: glowOf(value) }}>{fmt.text(bucket)}</p>
      <p className="text-[12px] text-ds-text2">
        {tradeCountLabel(bucket.trades.length, plText)} · {bucket.wins}W / {bucket.losses}L
        {winRate(bucket) != null ? ` · ${percent(winRate(bucket))}` : ""}
      </p>
      {tags.length ? (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {tags.map((entry) => <TagPill key={entry.tag} tag={entry.tag} kind={entry.kind} />)}
        </div>
      ) : null}
    </div>
  );
}

function DayCell({ cell, index, fmt, maxAbs, isToday, isSelected, isFocusTarget, density, plText, locale, onSelect, onFocusKey }) {
  const bucket = cell.bucket;
  const has = Boolean(bucket?.trades.length);
  const value = fmt.value(bucket);
  const compact = density === "compact";
  const body = (
    <div
      role="gridcell"
      data-day={cell.key}
      tabIndex={isFocusTarget ? 0 : -1}
      aria-selected={isSelected}
      aria-current={isToday ? "date" : undefined}
      aria-label={dayAriaLabel(cell, fmt, plText, locale)}
      onClick={() => onSelect(cell.key)}
      onFocus={() => onFocusKey(cell.key)}
      className={`cal-cell group relative flex min-w-0 cursor-pointer flex-col rounded-[12px] border outline-none transition-[background-color,border-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus)] ${
        compact ? "min-h-[64px] gap-1 p-2" : "min-h-[104px] gap-1.5 p-2.5"
      } ${isSelected ? "border-ds-frame bg-ds-sel" : "border-transparent hover:border-ds-line hover:bg-ds-s3"} ${cell.inMonth ? "" : "opacity-35"}`}
      style={{ "--i": index, background: !isSelected && has ? heatBackground(value, maxAbs) : undefined }}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] tabular-nums ${
            isToday ? "font-semibold text-ds-text ring-1 ring-[color:var(--ds-accent)]" : has ? "font-medium text-ds-text" : "text-ds-text3"
          }`}
        >
          {format(cell.date, "d")}
        </span>
        {has ? (
          <span
            title={tradeCountLabel(bucket.trades.length, plText)}
            className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-ds-line px-1.5 text-[10.5px] tabular-nums text-ds-text2"
          >
            {bucket.trades.length}
          </span>
        ) : null}
      </div>
      {has ? (
        <>
          <p
            className={`mt-auto truncate font-medium leading-none tabular-nums ${compact ? "text-[12.5px]" : "text-[15px]"}`}
            style={{ color: toneOf(value), textShadow: glowOf(value) }}
          >
            {fmt.text(bucket)}
          </p>
          {!compact ? (
            <p className="truncate text-[10.5px] tabular-nums text-ds-text3">
              {bucket.wins}W · {bucket.losses}L
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
  if (!has) return body;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent side="top" className="rounded-[12px] px-3 py-2">
        <DayTooltipBody cell={cell} fmt={fmt} plText={plText} locale={locale} />
      </TooltipContent>
    </Tooltip>
  );
}

function WeekCell({ week, fmt, maxAbsWeek, plText, density }) {
  const bucket = week.bucket;
  const has = bucket.trades.length > 0;
  const value = fmt.value(bucket);
  const width = has && maxAbsWeek ? Math.max(4, (Math.abs(value ?? 0) / maxAbsWeek) * 100) : 0;
  const rate = winRate(bucket);
  return (
    <div
      role="gridcell"
      aria-label={has
        ? `${plText ? "Tydzień" : "Week"}: ${fmt.text(bucket)}, ${tradeCountLabel(bucket.trades.length, plText)}${rate != null ? `, win rate ${percent(rate)}` : ""}`
        : `${plText ? "Tydzień" : "Week"}: ${plText ? "brak transakcji" : "no trades"}`}
      className={`flex min-w-0 flex-col justify-center rounded-[12px] border border-ds-line bg-ds-s2 ${density === "compact" ? "min-h-[64px] gap-1 px-2.5 py-2" : "min-h-[104px] gap-1.5 px-3 py-2.5"}`}
    >
      {has ? (
        <>
          <p className="truncate text-[14px] font-medium leading-none tabular-nums" style={{ color: toneOf(value), textShadow: glowOf(value) }}>{fmt.text(bucket)}</p>
          <p className="text-[10.5px] leading-[14px] text-ds-text3">
            {tradeCountLabel(bucket.trades.length, plText)}{rate != null ? ` · ${percent(rate)}` : ""}
          </p>
          <div className="h-[3px] overflow-hidden rounded-full bg-ds-s3" aria-hidden>
            <div className="h-full rounded-full" style={{ width: `${width}%`, background: toneOf(value) }} />
          </div>
        </>
      ) : <p className="text-[12px] text-ds-text3">—</p>}
    </div>
  );
}

export default function CalendarMonthGrid({
  month, fmt, plText, locale, todayKey, selectedKey, focusKey, onFocusKey, onSelect, onKeyNav,
  hideWeekends, density, slideDir,
}) {
  const gridRef = useRef(null);
  const cells = month.weeks.flatMap((week) => week.cells);
  const maxAbs = fmt.maxAbs(cells.map((cell) => cell.bucket));
  const maxAbsWeek = fmt.maxAbs(month.weeks.map((week) => week.bucket));
  const weekdayIdx = hideWeekends ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6];
  const labels = plText ? WEEKDAYS_PL : WEEKDAYS_EN;
  // Weekends without trades stay visible but narrower, so weekdays get the room.
  const dayCols = hideWeekends
    ? "repeat(5, minmax(0, 1fr))"
    : month.weekendTrades ? "repeat(7, minmax(0, 1fr))" : "repeat(5, minmax(0, 1fr)) repeat(2, minmax(0, 0.6fr))";
  const template = { gridTemplateColumns: `${dayCols} minmax(104px, 0.95fr)` };

  // Move DOM focus only while the user is navigating inside the grid; the month body remounts
  // on a month change, so the keyboard flag carries focus across that remount.
  const keyboardNavRef = useRef(false);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !(keyboardNavRef.current || grid.contains(document.activeElement))) return;
    keyboardNavRef.current = false;
    grid.querySelector(`[data-day="${focusKey}"]`)?.focus({ preventScroll: false });
  }, [focusKey, month.key]);
  const handleKeyDown = (event) => {
    keyboardNavRef.current = true;
    onKeyNav(event);
    if (!event.defaultPrevented) keyboardNavRef.current = false;
  };

  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={100}>
      <div
        ref={gridRef}
        role="grid"
        aria-label={format(month.weeks[1]?.cells[0].date || new Date(), "LLLL yyyy", { locale })}
        aria-readonly="true"
        onKeyDown={handleKeyDown}
        className={`${GLASS} p-2 sm:p-3`}
      >
        <div role="row" className="grid gap-1.5 px-0.5 pb-2" style={template}>
          {weekdayIdx.map((index) => (
            <div key={labels[index]} role="columnheader" className={`px-1 text-center ${MICRO} ${index >= 5 ? "opacity-70" : ""}`}>{labels[index]}</div>
          ))}
          <div role="columnheader" className={`px-1 text-center ${MICRO}`}>{plText ? "Tydzień" : "Week"}</div>
        </div>
        <div key={month.key} className="cal-slide space-y-1.5" data-dir={slideDir}>
          {month.weeks.map((week, row) => (
            <div key={week.key} role="row" className="grid gap-1.5" style={template}>
              {weekdayIdx.map((index) => {
                const cell = week.cells[index];
                return (
                  <DayCell
                    key={cell.key}
                    cell={cell}
                    index={row * 7 + index}
                    fmt={fmt}
                    maxAbs={maxAbs}
                    isToday={cell.key === todayKey}
                    isSelected={cell.key === selectedKey}
                    isFocusTarget={cell.key === focusKey}
                    density={density}
                    plText={plText}
                    locale={locale}
                    onSelect={onSelect}
                    onFocusKey={onFocusKey}
                  />
                );
              })}
              <WeekCell week={week} fmt={fmt} maxAbsWeek={maxAbsWeek} plText={plText} density={density} />
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
