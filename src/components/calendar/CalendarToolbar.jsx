import { useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/calendar/calendarUi";

const ICON_BTN = "inline-flex h-8 w-8 items-center justify-center rounded-full text-ds-text2 transition-colors duration-150 hover:bg-ds-s3 hover:text-ds-text";

function MonthPicker({ monthDate, locale, monthsWithData, onPick, plText, titleFormat }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(monthDate.getFullYear());
  const months = Array.from({ length: 12 }, (_, index) => new Date(year, index, 1));
  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setYear(monthDate.getFullYear()); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={plText ? "Wybierz miesiąc i rok" : "Pick month and year"}
          className="rounded-full px-2.5 py-1 text-[18px] font-semibold capitalize tracking-[-0.01em] text-ds-text transition-colors duration-150 hover:bg-ds-s3"
        >
          {format(monthDate, titleFormat, { locale })}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[264px] rounded-[14px] border-ds-frame bg-ds-glass p-3 shadow-ds-pop">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" className={ICON_BTN} onClick={() => setYear((value) => value - 1)} aria-label={plText ? "Poprzedni rok" : "Previous year"}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[13px] font-semibold tabular-nums text-ds-text">{year}</span>
          <button type="button" className={ICON_BTN} onClick={() => setYear((value) => value + 1)} aria-label={plText ? "Następny rok" : "Next year"}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {months.map((month) => {
            const key = format(month, "yyyy-MM");
            const active = key === format(monthDate, "yyyy-MM");
            return (
              <button
                key={key}
                type="button"
                aria-current={active ? "date" : undefined}
                onClick={() => { onPick(month); setOpen(false); }}
                className={`relative h-9 rounded-[10px] text-[12px] capitalize transition-colors duration-150 ${
                  active ? "bg-ds-s3 font-semibold text-ds-text" : "text-ds-text2 hover:bg-ds-s3 hover:text-ds-text"
                }`}
              >
                {format(month, "LLL", { locale })}
                {monthsWithData.has(key) ? <span aria-hidden className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-ds-accent" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function CalendarToolbar({
  plText, locale, monthDate, monthsWithData, onShift, onToday, onPickMonth,
  view, onView, unitValue, unitOptions, onUnit, density, onDensity, periodLabel,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
      <div className="flex min-w-0 items-center gap-1">
        <button type="button" className={ICON_BTN} onClick={() => onShift(-1)} aria-label={plText ? `Poprzedni ${periodLabel}` : `Previous ${periodLabel}`}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <MonthPicker monthDate={monthDate} locale={locale} monthsWithData={monthsWithData} onPick={onPickMonth} plText={plText} titleFormat={view === "year" ? "yyyy" : "LLLL yyyy"} />
        <button type="button" className={ICON_BTN} onClick={() => onShift(1)} aria-label={plText ? `Następny ${periodLabel}` : `Next ${periodLabel}`}>
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToday}
          className="ml-1 h-8 rounded-full border border-ds-line px-3 text-[12px] font-medium text-ds-text2 transition-colors duration-150 hover:bg-ds-s3 hover:text-ds-text"
        >
          {plText ? "Dziś" : "Today"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label={plText ? "Widok" : "View"}
          value={view}
          onChange={onView}
          options={[
            { id: "month", label: plText ? "Miesiąc" : "Month" },
            { id: "week", label: plText ? "Tydzień" : "Week" },
            { id: "year", label: plText ? "Rok" : "Year" },
          ]}
        />
        <Segmented label={plText ? "Jednostka" : "Unit"} value={unitValue} onChange={onUnit} options={unitOptions} />
        <Segmented
          label={plText ? "Gęstość" : "Density"}
          value={density}
          onChange={onDensity}
          options={[
            { id: "compact", label: plText ? "Zwarta" : "Compact" },
            { id: "comfortable", label: plText ? "Wygodna" : "Comfortable" },
          ]}
        />
      </div>
    </div>
  );
}
