import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Calculator, Crosshair, RotateCcw } from "lucide-react";
import {
  APLUS_SCORE_GROUPS,
  APLUS_STORAGE_KEY,
  APLUS_SUM_TIERS,
  evaluateAPlusSum,
  formatPoints,
  pointsToneClass,
  sumToneClass,
  loadAPlusSelection,
  saveAPlusSelection,
  sumAPlusPoints,
  toggleAPlusOption,
  emptyAPlusSelection,
} from "@/lib/aPlusConfigScore";
import {
  M1_MASTERY_OPTIONS,
  M1_STORAGE_KEY,
  formatM1Points,
  loadM1Selection,
  saveM1Selection,
  sumM1Points,
  toggleM1Option,
  emptyM1Selection,
} from "@/lib/m1MasteryScore";

const VERDICT_BOX = {
  rose: "border-loss/30 bg-loss/10 text-loss dark:text-loss",
  amber: "border-amber-300/80 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  emerald: "border-profit/30 bg-profit/10 text-profit dark:text-profit",
  orange: "border-orange-300/80 bg-orange-500/15 text-orange-900 dark:text-orange-200",
};

/**
 * Dedicated popup window page — no app shell.
 * Stays open when you switch to TradingView (Brave / Chrome / Edge).
 */
export default function CalculatorPopup() {
  const [kind, setKind] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("kind");
      return q === "m1" ? "m1" : "aplus";
    } catch {
      return "aplus";
    }
  });

  useEffect(() => {
    document.title = kind === "m1" ? "M1 MASTERY · AiKeepTrade" : "Konfiguracja A+ · AiKeepTrade";
  }, [kind]);

  return (
    <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col overflow-hidden">
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 border-b border-border shrink-0",
          "bg-muted/40"
        )}
      >
        {kind === "m1" ? (
          <Crosshair className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <Calculator className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        <span className="text-[11px] font-semibold truncate flex-1">
          {kind === "m1" ? "M1 MASTERY" : "Konfiguracja A+"}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-medium",
              kind === "aplus" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
            )}
            onClick={() => setKind("aplus")}
          >
            A+
          </button>
          <button
            type="button"
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-medium",
              kind === "m1" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
            )}
            onClick={() => setKind("m1")}
          >
            M1
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {kind === "m1" ? <PopupM1Body /> : <PopupAPlusBody />}
      </div>
      <p className="text-[9px] text-muted-foreground px-2 py-1 border-t border-border shrink-0">
        Osobne okno — możesz przełączyć się na TradingView. Nie zamykaj tego okna.
      </p>
    </div>
  );
}

function useCrossWindowSync(kind, reload) {
  useEffect(() => {
    const onCustom = (e) => {
      if (e?.detail?.kind && e.detail.kind !== kind) return;
      reload();
    };
    const onStorage = (e) => {
      if (!e.key) return;
      if (kind === "aplus" && e.key === APLUS_STORAGE_KEY) reload();
      if (kind === "m1" && e.key === M1_STORAGE_KEY) reload();
    };
    window.addEventListener("aikeeptrade-calc-changed", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("aikeeptrade-calc-changed", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [kind, reload]);
}

function PopupAPlusBody() {
  const [selection, setSelection] = useState(() => loadAPlusSelection());
  const { total } = useMemo(() => sumAPlusPoints(selection), [selection]);
  const verdict = useMemo(() => evaluateAPlusSum(total), [total]);

  useCrossWindowSync("aplus", () => setSelection(loadAPlusSelection()));

  const update = (groupId, optionId) => {
    setSelection((prev) => {
      const next = toggleAPlusOption(prev, groupId, optionId);
      saveAPlusSelection(next);
      return next;
    });
  };

  const reset = () => {
    const empty = emptyAPlusSelection();
    saveAPlusSelection(empty);
    setSelection(empty);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border/60 shrink-0">
        <div className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", VERDICT_BOX[verdict.tone])}>
          <span>{verdict.emoji}</span>
          <span>{verdict.label}</span>
          <span className={cn("tabular-nums", sumToneClass(total))}>· {total}</span>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] gap-1" onClick={reset}>
          <RotateCcw className="w-3 h-3" />
          Reset
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5 space-y-2">
        {APLUS_SCORE_GROUPS.map((group) => {
          const selected = selection[group.id] || [];
          return (
            <div key={group.id} className="space-y-0.5">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground px-1">{group.title}</p>
              <ul>
                {group.options.map((opt) => {
                  const checked = selected.includes(opt.id);
                  return (
                    <li key={opt.id}>
                      <label className={cn("flex items-center gap-1.5 rounded-md px-1 py-0.5 cursor-pointer text-[11px] leading-tight", checked ? "bg-primary/10" : "hover:bg-muted/50")}>
                        <Checkbox checked={checked} onCheckedChange={() => update(group.id, opt.id)} className="h-3 w-3" />
                        <span className="flex-1 truncate">{opt.label}</span>
                        <span className={cn("tabular-nums text-[9px]", pointsToneClass(opt.points))}>{formatPoints(opt.points)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="shrink-0 border-t border-border/60 px-2.5 py-1.5 space-y-1 bg-muted/20">
        <div className="flex items-baseline justify-between">
          <span className="text-[9px] font-semibold uppercase text-muted-foreground">Suma</span>
          <span className={cn("text-xl font-bold tabular-nums", sumToneClass(total))}>{total}</span>
        </div>
        <div className="grid grid-cols-2 gap-0.5">
          {APLUS_SUM_TIERS.map((tier) => (
            <div key={tier.id} className={cn("rounded px-1 py-0.5 text-[9px] border", verdict.id === tier.id ? VERDICT_BOX[tier.tone] : "border-transparent text-muted-foreground")}>
              {tier.emoji} {tier.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PopupM1Body() {
  const [selection, setSelection] = useState(() => loadM1Selection());
  const { total } = useMemo(() => sumM1Points(selection), [selection]);
  const verdict = useMemo(() => evaluateAPlusSum(total), [total]);

  useCrossWindowSync("m1", () => setSelection(loadM1Selection()));

  const update = (optionId) => {
    setSelection((prev) => {
      const next = toggleM1Option(prev, optionId);
      saveM1Selection(next);
      return next;
    });
  };

  const reset = () => {
    const empty = emptyM1Selection();
    saveM1Selection(empty);
    setSelection(empty);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border/60 shrink-0">
        <div className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", VERDICT_BOX[verdict.tone])}>
          <span>{verdict.emoji}</span>
          <span>{verdict.label}</span>
          <span className={cn("tabular-nums", sumToneClass(total))}>· {total}</span>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] gap-1" onClick={reset}>
          <RotateCcw className="w-3 h-3" />
          Reset
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5 space-y-0">
        {M1_MASTERY_OPTIONS.map((opt) => {
          const checked = selection.includes(opt.id);
          return (
            <label key={opt.id} className={cn("flex items-center gap-1.5 rounded-md px-1 py-0.5 cursor-pointer text-[11px] leading-tight", checked ? "bg-primary/10" : "hover:bg-muted/50")}>
              <Checkbox checked={checked} onCheckedChange={() => update(opt.id)} className="h-3 w-3" />
              <span className="flex-1 min-w-0">
                <span className="font-semibold text-foreground">{opt.code}</span>
                {" — "}
                {opt.label}
              </span>
              <span className={cn("tabular-nums text-[9px]", pointsToneClass(opt.points))}>{formatM1Points(opt.points)}</span>
            </label>
          );
        })}
      </div>
      <div className="shrink-0 border-t border-border/60 px-2.5 py-1.5 space-y-1 bg-muted/20">
        <div className="flex items-baseline justify-between">
          <span className="text-[9px] font-semibold uppercase text-muted-foreground">Suma</span>
          <span className={cn("text-xl font-bold tabular-nums", sumToneClass(total))}>{total}</span>
        </div>
        <div className="grid grid-cols-2 gap-0.5">
          {APLUS_SUM_TIERS.map((tier) => (
            <div key={tier.id} className={cn("rounded px-1 py-0.5 text-[9px] border", verdict.id === tier.id ? VERDICT_BOX[tier.tone] : "border-transparent text-muted-foreground")}>
              {tier.emoji} {tier.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
