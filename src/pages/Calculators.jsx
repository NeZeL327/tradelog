import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Calculator,
  RotateCcw,
  ListChecks,
  Clock3,
  Droplets,
  MapPin,
  TrendingUp,
  Crosshair,
} from "lucide-react";
import {
  APLUS_SCORE_GROUPS,
  APLUS_SUM_TIERS,
  evaluateAPlusSum,
  formatPoints,
  loadAPlusSelection,
  saveAPlusSelection,
  sumAPlusPoints,
  toggleAPlusOption,
  emptyAPlusSelection,
} from "@/lib/aPlusConfigScore";
import {
  M1_MASTERY_OPTIONS,
  formatM1Points,
  loadM1Selection,
  saveM1Selection,
  sumM1Points,
  toggleM1Option,
  emptyM1Selection,
} from "@/lib/m1MasteryScore";

const GROUP_ICONS = {
  poi: MapPin,
  liquidity: Droplets,
  price_delivery: TrendingUp,
  time: Clock3,
};

const TAB_STORAGE_KEY = "aikeeptrade_calculators_tab_v1";

function loadActiveTab() {
  try {
    const v = localStorage.getItem(TAB_STORAGE_KEY);
    if (v === "m1" || v === "aplus") return v;
  } catch {
    /* ignore */
  }
  return "aplus";
}

function saveActiveTab(tab) {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    /* ignore */
  }
}

function totalClass(total) {
  if (total > 0) return "text-emerald-600 dark:text-emerald-400";
  if (total < 0) return "text-rose-600 dark:text-rose-400";
  return "text-slate-700 dark:text-slate-200";
}

const VERDICT_STYLES = {
  rose: {
    box: "border-rose-300/80 bg-rose-500/10 text-rose-800 dark:border-rose-700/60 dark:bg-rose-950/40 dark:text-rose-200",
    sum: "border-rose-300/70 dark:border-rose-700/60 bg-rose-50/70 dark:bg-rose-950/30",
    label: "text-rose-700 dark:text-rose-300",
  },
  amber: {
    box: "border-amber-300/80 bg-amber-500/10 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200",
    sum: "border-amber-300/70 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30",
    label: "text-amber-700 dark:text-amber-300",
  },
  emerald: {
    box: "border-emerald-300/80 bg-emerald-500/10 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200",
    sum: "border-emerald-300/70 dark:border-emerald-700/60 bg-emerald-50/70 dark:bg-emerald-950/30",
    label: "text-emerald-700 dark:text-emerald-300",
  },
  orange: {
    box: "border-orange-300/80 bg-orange-500/15 text-orange-900 dark:border-orange-700/60 dark:bg-orange-950/40 dark:text-orange-200",
    sum: "border-orange-300/70 dark:border-orange-700/60 bg-orange-50/70 dark:bg-orange-950/30",
    label: "text-orange-700 dark:text-orange-300",
  },
};

function formatTierRange(tier) {
  if (!Number.isFinite(tier.min) || tier.min === -Infinity) {
    return `0–${tier.max}`;
  }
  if (!Number.isFinite(tier.max) || tier.max === Infinity) {
    return `${tier.min}+`;
  }
  return `${tier.min}–${tier.max}`;
}

function APlusCalculator() {
  const [selection, setSelection] = useState(() => loadAPlusSelection());
  const { total, breakdown } = useMemo(() => sumAPlusPoints(selection), [selection]);
  const verdict = useMemo(() => evaluateAPlusSum(total), [total]);
  const verdictStyle = VERDICT_STYLES[verdict.tone] || VERDICT_STYLES.rose;

  const updateSelection = (groupId, optionId) => {
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
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={reset}>
          <RotateCcw className="w-3.5 h-3.5" />
          Reset punktów
        </Button>
      </div>

      <Card className="border-violet-200/60 dark:border-violet-800/50 bg-violet-50/40 dark:bg-violet-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-violet-600" />
            4. LTF Egzekucja (1min)
          </CardTitle>
          <CardDescription>
            Dokładnie przeanalizuj Price Delivery, krok po kroku.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1.5 list-disc pl-5">
            <li>Określ miejsce SL — policz wielkość pozycji</li>
            <li>Określ miejsce BE — bądź gotowy zabezpieczyć pozycję</li>
            <li>Określ miejsce TP — min +3RR</li>
            <li>Pro-trend → pełny take profit może być realnie większy niż +3R</li>
            <li>Counter-trend → pełny take profit +3R</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-md border-slate-200 dark:border-border overflow-hidden">
        <CardHeader className="border-b border-border bg-slate-50/80 dark:bg-muted/30">
          <CardTitle className="text-lg dark:text-white">Klasyfikacja Konfiguracji A+</CardTitle>
          <CardDescription>
            Multi-wybór w POI / Liquidity / Time. Price delivery — jeden wariant. „Non” wyłącza pozostałe w grupie.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {APLUS_SCORE_GROUPS.map((group) => {
              const Icon = GROUP_ICONS[group.id] || ListChecks;
              const selected = selection[group.id] || [];
              return (
                <div
                  key={group.id}
                  className="rounded-xl border border-border/70 bg-background/60 p-3.5 space-y-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-300">
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold uppercase tracking-wide text-slate-900 dark:text-slate-100">
                        {group.title}
                      </p>
                      {group.subtitle ? (
                        <p className="text-[11px] text-muted-foreground">{group.subtitle}</p>
                      ) : null}
                    </div>
                  </div>

                  <ul className="space-y-1.5">
                    {group.options.map((opt) => {
                      const checked = selected.includes(opt.id);
                      const negative = opt.points < 0;
                      return (
                        <li key={opt.id}>
                          <label
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 cursor-pointer transition",
                              checked
                                ? negative
                                  ? "border-rose-400/70 bg-rose-500/10"
                                  : "border-violet-400/60 bg-violet-500/10"
                                : "border-transparent hover:bg-muted/50"
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => updateSelection(group.id, opt.id)}
                              aria-label={opt.label}
                            />
                            <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">{opt.label}</span>
                            <span
                              className={cn(
                                "text-xs font-semibold tabular-nums shrink-0",
                                negative
                                  ? "text-rose-600 dark:text-rose-400"
                                  : opt.points > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-muted-foreground"
                              )}
                            >
                              {formatPoints(opt.points)} pkt
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(220px,280px)] gap-4">
            <div
              className={cn(
                "rounded-2xl border-2 border-dashed px-4 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors",
                verdictStyle.sum
              )}
            >
              <div className="min-w-0 space-y-2">
                <p className={cn("text-[11px] font-semibold uppercase tracking-wider", verdictStyle.label)}>
                  Suma punktów
                </p>
                <div
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold",
                    verdictStyle.box
                  )}
                >
                  <span className="text-base leading-none">{verdict.emoji}</span>
                  <span>{verdict.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {breakdown.length
                    ? `${breakdown.length} zaznaczonych warunków`
                    : "Zaznacz warunki powyżej"}
                </p>
              </div>
              <p className={cn("text-4xl sm:text-5xl font-bold tabular-nums leading-none", totalClass(total))}>
                {total}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/80 p-3.5 space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
                Suma — legenda
              </p>
              <ul className="space-y-1.5">
                {APLUS_SUM_TIERS.map((tier) => {
                  const active = verdict.id === tier.id;
                  const style = VERDICT_STYLES[tier.tone] || VERDICT_STYLES.rose;
                  return (
                    <li
                      key={tier.id}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition",
                        active ? style.box : "border-transparent text-slate-600 dark:text-slate-300"
                      )}
                    >
                      <span className="tabular-nums text-xs text-muted-foreground shrink-0">
                        {formatTierRange(tier)}
                      </span>
                      <span className="font-medium text-right">
                        {tier.emoji} {tier.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {breakdown.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Rozbicie
              </p>
              <div className="flex flex-wrap gap-1.5">
                {breakdown.map((row) => (
                  <span
                    key={`${row.groupId}-${row.optionId}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
                      row.points < 0
                        ? "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                        : "border-border bg-background text-slate-700 dark:text-slate-300"
                    )}
                  >
                    {row.label}
                    <strong className="tabular-nums">{formatPoints(row.points)}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function M1MasteryCalculator() {
  const [selection, setSelection] = useState(() => loadM1Selection());
  const { total, breakdown } = useMemo(() => sumM1Points(selection), [selection]);
  const verdict = useMemo(() => evaluateAPlusSum(total), [total]);
  const verdictStyle = VERDICT_STYLES[verdict.tone] || VERDICT_STYLES.rose;

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
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={reset}>
          <RotateCcw className="w-3.5 h-3.5" />
          Reset punktów
        </Button>
      </div>

      <Card className="shadow-md border-slate-200 dark:border-border overflow-hidden max-w-4xl mx-auto">
        <CardHeader className="border-b border-border bg-cyan-50/60 dark:bg-cyan-950/20">
          <CardTitle className="text-lg italic dark:text-white flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-cyan-600 dark:text-cyan-400 not-italic" />
            M1 MASTERY
          </CardTitle>
          <CardDescription>Ekstra Confluences / Entry model (1min)</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-5">
          <ul className="space-y-1.5 max-w-2xl">
            {M1_MASTERY_OPTIONS.map((opt) => {
              const checked = selection.includes(opt.id);
              return (
                <li key={opt.id}>
                  <label
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-2.5 py-2.5 cursor-pointer transition",
                      checked
                        ? "border-cyan-400/70 bg-cyan-500/10"
                        : "border-transparent hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => update(opt.id)}
                      aria-label={`${opt.code} ${opt.label}`}
                    />
                    <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">
                      <span className="font-semibold text-cyan-700 dark:text-cyan-300">{opt.code}</span>
                      {" — "}
                      {opt.label}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                      {formatM1Points(opt.points)} pkt
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(220px,280px)] gap-4">
            <div
              className={cn(
                "rounded-2xl border-2 border-dashed px-4 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors",
                verdictStyle.sum
              )}
            >
              <div className="min-w-0 space-y-2">
                <p className={cn("text-[11px] font-semibold uppercase tracking-wider", verdictStyle.label)}>
                  Suma punktów
                </p>
                <div
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold",
                    verdictStyle.box
                  )}
                >
                  <span className="text-base leading-none">{verdict.emoji}</span>
                  <span>{verdict.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {breakdown.length
                    ? `${breakdown.length} zaznaczonych EM`
                    : "Zaznacz entry modele powyżej"}
                </p>
              </div>
              <p className={cn("text-4xl sm:text-5xl font-bold tabular-nums leading-none", totalClass(total))}>
                {total}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/80 p-3.5 space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-500" />
                Suma — legenda
              </p>
              <ul className="space-y-1.5">
                {APLUS_SUM_TIERS.map((tier) => {
                  const active = verdict.id === tier.id;
                  const style = VERDICT_STYLES[tier.tone] || VERDICT_STYLES.rose;
                  return (
                    <li
                      key={tier.id}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition",
                        active ? style.box : "border-transparent text-slate-600 dark:text-slate-300"
                      )}
                    >
                      <span className="tabular-nums text-xs text-muted-foreground shrink-0">
                        {formatTierRange(tier)}
                      </span>
                      <span className="font-medium text-right">
                        {tier.emoji} {tier.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {breakdown.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Rozbicie
              </p>
              <div className="flex flex-wrap gap-1.5">
                {breakdown.map((row) => (
                  <span
                    key={row.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-slate-700 dark:text-slate-300"
                  >
                    <span className="font-semibold text-cyan-700 dark:text-cyan-300">{row.code}</span>
                    {row.label}
                    <strong className="tabular-nums">{formatM1Points(row.points)}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Calculators() {
  const [tab, setTab] = useState(() => loadActiveTab());

  const onTabChange = (value) => {
    setTab(value);
    saveActiveTab(value);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Calculator className="w-7 h-7 text-violet-500" />
          Kalkulatory
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Wybierz kalkulator — zaznacz warunki, suma liczy się automatycznie.
        </p>
      </div>

      <Tabs value={tab} onValueChange={onTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-auto p-1 bg-muted/60">
          <TabsTrigger value="aplus" className="text-xs sm:text-sm py-2.5 data-[state=active]:shadow-sm">
            Konfiguracja A+
          </TabsTrigger>
          <TabsTrigger value="m1" className="text-xs sm:text-sm py-2.5 data-[state=active]:shadow-sm">
            M1 MASTERY
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aplus" className="mt-0 focus-visible:outline-none">
          <APlusCalculator />
        </TabsContent>
        <TabsContent value="m1" className="mt-0 focus-visible:outline-none">
          <M1MasteryCalculator />
        </TabsContent>
      </Tabs>
    </div>
  );
}
