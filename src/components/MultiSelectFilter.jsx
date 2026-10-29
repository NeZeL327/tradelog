import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/** Przełącza wartość w filtrze wielokrotnego wyboru; "all" czyści resztę, pusty wybór wraca do "all". */
export const toggleMultiFilterValue = (prev, value) => {
  if (value === "all") return ["all"];
  const normalizedValue = String(value);
  const withoutAll = prev.filter((item) => item !== "all");
  const exists = withoutAll.includes(normalizedValue);
  const next = exists
    ? withoutAll.filter((item) => item !== normalizedValue)
    : [...withoutAll, normalizedValue];
  return next.length ? next : ["all"];
};

// Klasy wspólne z SelectTrigger / SelectContent / SelectItem (src/components/ui/select.jsx).
export const FILTER_TRIGGER_CLASS =
  "relative flex h-9 w-full items-center justify-center whitespace-nowrap rounded-[10px] border border-ds-line bg-ds-s2 px-3 text-[13px] text-ds-text transition-colors duration-200 hover:bg-ds-s3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus)] data-[open=true]:bg-ds-s3";
export const FILTER_PANEL_CLASS =
  "absolute left-0 top-full z-50 mt-1 rounded-[12px] border border-ds-frame bg-ds-glass p-1 text-ds-text shadow-ds-pop backdrop-blur-xl";
export const filterItemClass = (selected) =>
  `flex w-full items-center justify-between gap-2 rounded-[8px] border px-2 py-1.5 text-left text-[13px] font-medium text-ds-text transition-colors ${selected ? 'border-[color:var(--ds-sel-line)] bg-ds-sel' : 'border-transparent hover:bg-ds-s3'}`;
export const FILTER_LABEL_CLASS = "type-section px-1";

function CheckDot({ selected }) {
  return (
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${selected ? 'border-ds-accent bg-ds-accent' : 'border-ds-frame bg-transparent'}`}>
      {selected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
    </span>
  );
}

/**
 * Dropdown filtra wielokrotnego wyboru (Analytics).
 * options: [{ value, label }]; values: tablica wybranych wartości (string) albo ["all"].
 */
export default function MultiSelectFilter({ label, allLabel, valueLabel, options, values, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggle = (value) => onChange(toggleMultiFilterValue(values, value));
  const allSelected = values.includes('all');

  return (
    <div className="flex flex-col gap-1">
      <span className={FILTER_LABEL_CLASS}>{label}</span>
      <div className="relative" ref={ref}>
        <button
          type="button"
          aria-expanded={open}
          data-open={open ? "true" : undefined}
          onClick={() => setOpen(!open)}
          className={FILTER_TRIGGER_CLASS}
        >
          <span className="truncate text-center w-full pr-5">{valueLabel || allLabel}</span>
          <ChevronDown className="absolute right-3 w-4 h-4 opacity-50" />
        </button>
        {open && (
          <div className={`${FILTER_PANEL_CLASS} w-full min-w-[12rem] max-h-72 overflow-y-auto space-y-0.5`}>
            <button type="button" onClick={() => toggle('all')} className={filterItemClass(allSelected)}>
              <span className="truncate">{allLabel}</span>
              <CheckDot selected={allSelected} />
            </button>
            {options.map((option) => {
              const isSelected = values.includes(String(option.value));
              return (
                <button key={option.value} type="button" onClick={() => toggle(option.value)} className={filterItemClass(isSelected)}>
                  <span className="truncate">{option.label}</span>
                  <CheckDot selected={isSelected} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
