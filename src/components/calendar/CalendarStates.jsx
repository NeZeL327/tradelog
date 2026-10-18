import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { TagPill, tagEntries, tradeCountLabel } from "@/components/DayReview";
import { GLASS, MICRO, glowOf, toneOf } from "@/components/calendar/calendarUi";
import { dayAriaLabel } from "@/components/calendar/CalendarMonthGrid";

// <768px: list of the month's trading days, newest first.
export function CalendarAgenda({ month, fmt, plText, locale, selectedKey, onSelect }) {
  const days = month.weeks.flatMap((week) => week.cells).filter((cell) => cell.bucket?.trades.length).reverse();
  return (
    <ul aria-label={plText ? "Dni z transakcjami" : "Days with trades"} className={`${GLASS} divide-y divide-[color:var(--ds-line)] overflow-hidden`}>
      {days.map((cell) => {
        const value = fmt.value(cell.bucket);
        const firstTag = tagEntries(cell.bucket.trades)[0];
        return (
          <li key={cell.key}>
            <button
              type="button"
              onClick={() => onSelect(cell.key)}
              aria-label={dayAriaLabel(cell, fmt, plText, locale)}
              aria-pressed={cell.key === selectedKey}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-ds-s3"
            >
              <span className="flex w-10 shrink-0 flex-col items-center">
                <span className={`capitalize ${MICRO}`}>{format(cell.date, "EEE", { locale })}</span>
                <span className="text-[18px] font-medium tabular-nums text-ds-text">{format(cell.date, "d")}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] text-ds-text2">
                  {tradeCountLabel(cell.bucket.trades.length, plText)} · {cell.bucket.wins}W · {cell.bucket.losses}L
                </span>
                {firstTag ? <TagPill tag={firstTag.tag} kind={firstTag.kind} className="mt-1" /> : null}
              </span>
              <span className="shrink-0 text-[15px] font-medium tabular-nums" style={{ color: toneOf(value), textShadow: glowOf(value) }}>
                {fmt.text(cell.bucket)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function CalendarSkeleton({ plText }) {
  return (
    <div role="status" aria-label={plText ? "Ładowanie kalendarza" : "Loading calendar"} className="space-y-3">
      <div className={`${GLASS} h-[132px] animate-pulse`} />
      <div className={`${GLASS} p-3`}>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr)) minmax(104px, 0.95fr)" }}>
          {Array.from({ length: 48 }, (_, index) => (
            <div key={index} className="h-[88px] rounded-[12px] bg-ds-skeleton animate-pulse" style={{ animationDelay: `${(index % 8) * 60}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CalendarEmpty({ plText, filtered, latestKey, locale, onJump, onClearFilters }) {
  return (
    <div className={`${GLASS} flex flex-col items-center gap-3 px-6 py-10 text-center`}>
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ds-line bg-ds-s3 text-ds-text2">
        <CalendarDays className="h-5 w-5" aria-hidden />
      </span>
      <p className="text-[15px] font-medium text-ds-text">
        {filtered
          ? (plText ? "Brak transakcji dla tych filtrów" : "No trades match these filters")
          : (plText ? "Brak transakcji w tym miesiącu" : "No trades this month")}
      </p>
      <p className="max-w-[360px] text-[12.5px] text-ds-text2">
        {plText ? "Dni z zamkniętymi transakcjami pojawią się tutaj z wynikiem i podsumowaniem tygodnia." : "Days with closed trades show up here with their result and weekly totals."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {filtered ? (
          <button type="button" onClick={onClearFilters} className="h-8 rounded-full border border-ds-line px-3.5 text-[12px] font-medium text-ds-text2 transition-colors duration-150 hover:bg-ds-s3 hover:text-ds-text">
            {plText ? "Wyczyść filtry" : "Clear filters"}
          </button>
        ) : null}
        {latestKey ? (
          <button type="button" onClick={onJump} className="h-8 rounded-full border border-ds-frame bg-ds-s3 px-3.5 text-[12px] font-medium text-ds-text transition-colors duration-150 hover:bg-ds-s2">
            {plText ? "Przejdź do ostatniej transakcji" : "Go to latest trade"} · {format(new Date(`${latestKey}T12:00:00`), "d MMM yyyy", { locale })}
          </button>
        ) : null}
      </div>
    </div>
  );
}
