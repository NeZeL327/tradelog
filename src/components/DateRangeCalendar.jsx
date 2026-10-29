import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS_PL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const DAYS_PL = ["Pn","Wt","Śr","Cz","Pt","Sb","Nd"];

/** Kalendarz wyboru zakresu dat (YYYY-MM-DD). Wspólny dla Dziennika i Analytics. */
export default function DateRangeCalendar({ from, to, onSelect }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [view, setView] = useState(() => {
    const base = from ? new Date(from + "T00:00:00") : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  const prevMonth = () => setView(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setView(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });

  const toStr = (d) => `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const firstDow = (() => { const d = new Date(view.year, view.month, 1).getDay(); return d === 0 ? 6 : d - 1; })();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const prevMonthDays = new Date(view.year, view.month, 0).getDate();
  const trailing = (7 - ((firstDow + daysInMonth) % 7)) % 7;
  const cells = [
    ...Array.from({ length: firstDow }, (_, i) => ({ d: prevMonthDays - firstDow + i + 1, inMonth: false })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ d: i + 1, inMonth: true })),
    ...Array.from({ length: trailing }, (_, i) => ({ d: i + 1, inMonth: false })),
  ];

  const handleDay = (d) => {
    if (!d) return;
    const s = toStr(d);
    if (!from || (from && to)) {
      onSelect(s, "");
    } else if (s < from) {
      onSelect(s, from);
    } else {
      onSelect(from, s);
    }
  };

  return (
    <div className="w-full select-none">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={prevMonth} className="journal-cal-nav" aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="flex-1 text-center text-sm font-semibold text-ds-text">
          {MONTHS_PL[view.month]} {view.year}
        </span>
        <button type="button" onClick={nextMonth} className="journal-cal-nav" aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7">
        {DAYS_PL.map(d => (
          <div key={d} className="py-1 text-center text-[11px] font-medium text-ds-text3">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const d = cell.inMonth ? cell.d : null;
          const s = cell.inMonth ? toStr(cell.d) : "";
          const isFrom = cell.inMonth && s === from;
          const isTo = cell.inMonth && s === to;
          const inRange = Boolean(cell.inMonth && from && to && s > from && s < to);
          const isNow = cell.inMonth && s === todayStr;
          return (
            <button
              key={i}
              type="button"
              disabled={!cell.inMonth}
              onClick={() => handleDay(d)}
              data-muted={cell.inMonth ? undefined : "true"}
              data-today={isNow ? "true" : undefined}
              data-in-range={inRange ? "true" : undefined}
              data-edge={isFrom || isTo ? "true" : undefined}
              data-range-start={isFrom ? "true" : undefined}
              data-range-end={isTo ? "true" : undefined}
              className="journal-cal-day"
            >
              {cell.d}
            </button>
          );
        })}
      </div>
    </div>
  );
}
