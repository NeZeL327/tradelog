import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

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

function CheckDot({ selected }) {
  return (
    <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-primary/40 bg-muted' : 'border-border bg-muted'}`}>
      {selected && (
        <svg className="h-3.5 w-3.5 text-primary" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
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
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center">{label}</span>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="relative h-10 w-full px-3 rounded-lg border border-border bg-card text-sm flex items-center justify-center hover:bg-muted"
        >
          <span className="truncate text-center w-full pr-5">{valueLabel || allLabel}</span>
          <ChevronDown className="absolute right-3 w-4 h-4 opacity-50" />
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border border-border bg-card p-1 shadow-none max-h-64 overflow-y-auto">
            <button
              onClick={() => toggle('all')}
              className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${allSelected ? 'bg-accent' : ''}`}
            >
              <span className="truncate">{allLabel}</span>
              <CheckDot selected={allSelected} />
            </button>
            {options.map((option) => {
              const isSelected = values.includes(String(option.value));
              return (
                <button
                  key={option.value}
                  onClick={() => toggle(option.value)}
                  className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? 'bg-accent' : ''}`}
                >
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
