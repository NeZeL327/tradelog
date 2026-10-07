import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Map,
  Pencil,
  Save,
  Target,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createPageUrl } from "@/utils";
import {
  formatSessionRange,
  getActiveTradingSession,
  isSessionOpenNow,
  TRADING_SESSIONS,
} from "@/lib/tradingSessions";
import {
  ASIA_PD_OPTIONS,
  BIAS_OPTIONS,
  FOCUS_PRINCIPLE,
  FOCUS_SCORE_OPTIONS,
  HORIZON_PROMPTS,
  HORIZON_TITLES,
  MAP_PAIR_OPTIONS,
  MOTIVATION_ITEMS,
  DEFAULT_DAY_PLAN_TAGS,
  PROCESS_TRADE_CRITERIA,
  TRADE_MODE_OPTIONS,
  dayPlanNextAction,
  focusStatusLabel,
  horizonCheckItems,
  horizonPromptProgress,
  isFocusComplete,
  isFocusReady,
  isHorizonSaved,
  isNoTradeDay,
  isTaggedNoteFilled,
  processBandForScore,
  processCriteriaScore,
  selectedPairs,
  tableCheckProgress,
  tipsForSession,
} from "@/lib/dayPlanModel";
import DayPlanTaggedNote from "@/components/DayPlanTaggedNote";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const HORIZONS = ["htf", "mtf", "ltf"];

function ChoiceChip({ active, onClick, title, subtitle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-left transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border/80 text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      <span className="block text-sm font-semibold text-foreground">{title}</span>
      {subtitle ? <span className="mt-0.5 block text-[11px] leading-snug">{subtitle}</span> : null}
    </button>
  );
}

function SessionTimeline({ sessionId, now, lang, onSelect, required }) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card/70 p-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
            1. Wybierz sesję
          </p>
          <p className="text-xs text-muted-foreground">
            Najpierw Azja, London albo NY — zalecenia i mapowanie dopasują się do wyboru.
          </p>
        </div>
        {required && !sessionId ? (
          <span className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
            Wymagane przed dalszym planem
          </span>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {TRADING_SESSIONS.map((session) => {
          const clockOpen = isSessionOpenNow(session, now);
          const selected = sessionId === session.id;
          const role = lang === "en" ? session.roleEn : session.rolePl;
          return (
            <button
              key={session.id}
              type="button"
              onClick={() => onSelect(session.id)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                  : "border-border/70 bg-card/40 hover:border-primary/35"
              )}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    selected ? "bg-primary" : clockOpen ? "bg-profit" : "bg-muted-foreground/50"
                  )}
                />
                {lang === "en" ? session.labelEn : session.labelPl}
                {role ? <span className="font-normal text-muted-foreground">• {role}</span> : null}
              </div>
              <p className="data-mono mt-1 text-[11px] text-muted-foreground">
                {formatSessionRange(session)}
                {clockOpen ? (
                  <span className="ml-2 text-profit">{lang === "en" ? "clock open" : "zegar otwarty"}</span>
                ) : null}
                {selected ? (
                  <span className="ml-2 text-primary">{lang === "en" ? "selected" : "wybrana"}</span>
                ) : null}
              </p>
            </button>
          );
        })}
      </div>
      {sessionId ? (
        <ul className="space-y-1 rounded-lg border border-border/60 bg-background/25 px-3 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Zalecenia dla sesji
          </p>
          {tipsForSession(sessionId, lang).map((tip) => (
            <li key={tip} className="text-[11px] leading-snug text-muted-foreground">
              • {tip}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FocusEditor({ plan, lang, patchPlan, onDone }) {
  const focus = plan.focus || {};
  const setFocus = (updater) =>
    patchPlan((prev) => ({
      ...prev,
      focus: typeof updater === "function" ? updater(prev.focus || {}) : { ...prev.focus, ...updater },
    }));

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/80 p-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">Skupienie</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Ocena</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {FOCUS_SCORE_OPTIONS.map((opt) => (
            <ChoiceChip
              key={opt.id}
              active={focus.score === opt.id}
              title={lang === "en" ? opt.en : opt.pl}
              subtitle={lang === "en" ? opt.hintEn : opt.hintPl}
              onClick={() => setFocus({ score: opt.id, completed: false })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Tryb handlu</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {TRADE_MODE_OPTIONS.map((opt) => (
            <ChoiceChip
              key={opt.id}
              active={focus.trade_mode === opt.id}
              title={opt.pl}
              subtitle={lang === "en" ? opt.descEn : opt.descPl}
              onClick={() => setFocus({ trade_mode: opt.id, completed: false })}
            />
          ))}
        </div>
        {focus.trade_mode === "mid" ? (
          <p className="text-[11px] text-muted-foreground">
            Kryteria A+ w kalkulatorze.{" "}
            <Link to={createPageUrl("Calculators")} className="text-primary hover:underline">
              Otwórz →
            </Link>
          </p>
        ) : null}
        {focus.trade_mode === "off" || isNoTradeDay(focus) ? (
          <p className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-[12px] text-sky-100">
            OFF = dziś bez transakcji. Możesz obserwować rynek i zapisać plan.
          </p>
        ) : null}
      </div>

      <label className="flex items-start gap-2 rounded-md border border-border/70 px-2.5 py-2 text-sm">
        <Checkbox
          checked={!!focus.accept_risk_process}
          onCheckedChange={(v) => setFocus({ accept_risk_process: !!v, completed: false })}
          className="mt-0.5"
        />
        <span>{lang === "en" ? FOCUS_PRINCIPLE.en : FOCUS_PRINCIPLE.pl}</span>
      </label>

      <p className="text-[11px] text-muted-foreground">
        Krótko: zarządzaj kapitałem odpowiedzialnie, akceptuj niepewność, stawiaj na jakość decyzji.
      </p>

      <details className="rounded-md border border-border/60 px-2.5 py-2">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          Pokaż zasady motywacyjne
        </summary>
        <div className="mt-2 space-y-1.5">
          {MOTIVATION_ITEMS.map((item) => (
            <label key={item.id} className="flex items-start gap-2 text-[12px]">
              <Checkbox
                checked={!!focus.motivation?.[item.id]}
                onCheckedChange={(v) =>
                  setFocus((f) => ({
                    ...f,
                    motivation: { ...f.motivation, [item.id]: !!v },
                  }))
                }
                className="mt-0.5"
              />
              <span>{lang === "en" ? item.en : item.pl}</span>
            </label>
          ))}
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="cyber-primary-btn"
          disabled={!isFocusReady(focus)}
          onClick={() => {
            setFocus({ completed: true });
            patchPlan((prev) => ({ ...prev, phase: "mapping" }));
            onDone?.();
          }}
        >
          Zapisz skupienie
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function FocusSummary({ plan, lang, onEdit }) {
  const focus = plan.focus || {};
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2">
        <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Skupienie: {focus.score ?? "—"}/2 • Tryb: {String(focus.trade_mode || "—").toUpperCase()}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Jedna decyzja na cały dzień. Zarządzaj ekspozycją zgodnie z trybem.
          </p>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={onEdit}>
        <Pencil className="mr-1 h-3.5 w-3.5" />
        {lang === "en" ? "Edit" : "Edytuj"}
      </Button>
    </div>
  );
}

function BiasDayControl({ bias, onChange }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2",
        bias === "long" && "border-profit/50 bg-profit/10",
        bias === "short" && "border-loss/50 bg-loss/10",
        !bias && "border-border/70 bg-background/40"
      )}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Bias dnia
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {BIAS_OPTIONS.map((opt) => {
          const active = bias === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(active ? null : opt.id)}
              className={cn(
                "rounded-md border px-2 py-2 text-center text-sm font-bold tracking-wide transition-colors",
                opt.id === "long" &&
                  (active
                    ? "border-profit bg-profit text-primary-foreground shadow-[0_0_0_1px_hsl(var(--profit)/0.5)]"
                    : "border-profit/35 text-profit hover:bg-profit/10"),
                opt.id === "short" &&
                  (active
                    ? "border-loss bg-loss text-primary-foreground shadow-[0_0_0_1px_hsl(var(--loss)/0.5)]"
                    : "border-loss/35 text-loss hover:bg-loss/10")
              )}
            >
              {opt.pl}
            </button>
          );
        })}
      </div>
      {bias ? (
        <p
          className={cn(
            "mt-1.5 text-center text-[11px] font-semibold",
            bias === "long" ? "text-profit" : "text-loss"
          )}
        >
          Aktywny: {bias === "long" ? "LONG" : "SHORT"}
        </p>
      ) : (
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">Wybierz LONG lub SHORT</p>
      )}
    </div>
  );
}

/** One mapping table: pair select on top, done checklist below. */
function PairMapTable({
  label,
  table,
  horizon,
  lang,
  otherSymbol,
  onSymbolChange,
  onCheckChange,
}) {
  const items = horizonCheckItems(horizon);
  const progress = tableCheckProgress(table, horizon);
  const symbol = table?.symbol || "";

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-background/30">
      {/* TOP: pair choice */}
      <div className="border-b border-border/70 bg-card/50 px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          {symbol ? (
            <span className="data-mono rounded border border-primary/35 bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
              {symbol}
            </span>
          ) : null}
        </div>
        <Label className="mb-1 block text-[11px] text-muted-foreground">Para walutowa</Label>
        <select
          value={symbol}
          onChange={(e) => onSymbolChange(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-[hsl(var(--window-bg))] px-2 text-sm font-medium text-foreground outline-none focus:border-primary/50"
        >
          <option value="">— wybierz parę —</option>
          {MAP_PAIR_OPTIONS.map((sym) => (
            <option key={sym} value={sym} disabled={!!otherSymbol && otherSymbol === sym && sym !== symbol}>
              {sym}
            </option>
          ))}
        </select>
      </div>

      {/* BOTTOM: checklist */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Zrobione
          </p>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {progress.done}/{progress.total}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-primary/15">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${progress.ratio * 100}%` }}
          />
        </div>
        {!symbol ? (
          <p className="py-4 text-center text-[11px] text-muted-foreground">
            Najpierw wybierz parę u góry.
          </p>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => {
              const done = !!table?.checks?.[item.id];
              return (
                <label
                  key={item.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-[12px] leading-snug transition-colors",
                    done
                      ? "border-profit/35 bg-profit/5 text-foreground"
                      : "border-border/60 text-foreground/90 hover:border-primary/30"
                  )}
                >
                  <Checkbox
                    checked={done}
                    onCheckedChange={(v) => onCheckChange(item.id, !!v)}
                    className="mt-0.5"
                  />
                  <span>{lang === "en" ? item.en : item.pl}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MappingPanel({ plan, lang, patchPlan, onSaveHorizon }) {
  const sessionId = plan.mapping_session || "london";
  const horizon = plan.mapping_step || "htf";
  const block = plan.mapping?.[sessionId]?.[horizon] || {};
  const title = HORIZON_TITLES[horizon];
  const prompts = HORIZON_PROMPTS[horizon] || [];
  const activePairs = selectedPairs(block);
  const tableA = block.tables?.a || { symbol: "", checks: {} };
  const tableB = block.tables?.b || { symbol: "", checks: {} };
  const dailyBias = plan.mapping?.daily_bias || null;
  const mappingTags = plan.tag_lists?.mapping || DEFAULT_DAY_PLAN_TAGS.mapping;
  const promptProgress = horizonPromptProgress(block, horizon);
  const hzIndex = HORIZONS.indexOf(horizon);
  const sessionIndex = TRADING_SESSIONS.findIndex((s) => s.id === sessionId);
  const sessionMeta = TRADING_SESSIONS.find((s) => s.id === sessionId);
  const sessionLabel = lang === "en" ? sessionMeta?.labelEn : sessionMeta?.labelPl;

  const patchMappingTags = (next) =>
    patchPlan((prev) => ({
      ...prev,
      tag_lists: { ...prev.tag_lists, mapping: next },
    }));

  const patchHorizon = (updater) =>
    patchPlan((prev) => {
      const cur = prev.mapping?.[sessionId]?.[horizon] || {};
      const next = typeof updater === "function" ? updater(cur) : { ...cur, ...updater };
      return {
        ...prev,
        mapping: {
          ...prev.mapping,
          [sessionId]: {
            ...prev.mapping?.[sessionId],
            [horizon]: next,
          },
        },
      };
    });

  const setDailyBias = (value) =>
    patchPlan((prev) => ({
      ...prev,
      mapping: {
        ...prev.mapping,
        daily_bias: value,
      },
    }));

  const patchTable = (slot, updater) =>
    patchHorizon((b) => {
      const cur = b.tables?.[slot] || { symbol: "", checks: {} };
      const next = typeof updater === "function" ? updater(cur) : { ...cur, ...updater };
      return {
        ...b,
        saved: false,
        tables: {
          ...(b.tables || { a: { symbol: "", checks: {} }, b: { symbol: "", checks: {} } }),
          [slot]: next,
        },
      };
    });

  const goHorizon = (nextHz) => patchPlan((prev) => ({ ...prev, mapping_step: nextHz }));
  const goSession = (nextSid) =>
    patchPlan((prev) => ({ ...prev, mapping_session: nextSid, mapping_step: "htf" }));

  const sessionTips = tipsForSession(sessionId, lang);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Map className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Mapowanie • {sessionLabel}</p>
            <p className="text-[11px] text-muted-foreground">
              Zalecenia i checklisty są dopasowane do wybranej sesji.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dailyBias ? (
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-bold tracking-wide",
                dailyBias === "long" && "border-profit/45 bg-profit/15 text-profit",
                dailyBias === "short" && "border-loss/45 bg-loss/15 text-loss"
              )}
            >
              BIAS DNIA · {dailyBias === "long" ? "LONG" : "SHORT"}
            </span>
          ) : null}
          <p className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Brak jasnego schematu = brak transakcji
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border">
        <div className="flex flex-wrap gap-1 pb-px">
          {HORIZONS.map((hz) => {
            const saved = isHorizonSaved(plan.mapping, sessionId, hz);
            const active = horizon === hz;
            return (
              <button
                key={hz}
                type="button"
                onClick={() => goHorizon(hz)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wide border-b-2 -mb-px",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {hz}
                {saved ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium normal-case tracking-normal text-profit">
                    <Check className="h-3 w-3" />
                    Zapisane
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {activePairs.length ? (
          <p className="mb-1.5 max-w-full truncate text-[11px] text-muted-foreground">
            Pary:{" "}
            <span className="font-medium text-foreground">{activePairs.join(" · ")}</span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        {/* Left: notes / prompts */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {lang === "en" ? title.en : title.pl}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {lang === "en" ? title.subEn : title.subPl} · kliknij tag ze schematu lub dopisz notatkę
              </p>
            </div>
            {promptProgress.total > 0 ? (
              <span className="rounded-md border border-border/70 px-2 py-1 text-[11px] tabular-nums text-muted-foreground">
                Schemat {promptProgress.done}/{promptProgress.total}
              </span>
            ) : null}
          </div>

          <details className="rounded-md border border-border/60 px-2.5 py-2">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground">
              Zalecenia · {sessionLabel} · {horizon.toUpperCase()}
              <ChevronDown className="h-3.5 w-3.5" />
            </summary>
            <ul className="mt-2 space-y-1">
              {sessionTips.map((tip) => (
                <li key={tip} className="text-[11px] text-muted-foreground">
                  • {tip}
                </li>
              ))}
            </ul>
          </details>

          <details className="rounded-lg border border-dashed border-border/70 px-2.5 py-2">
            <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
              Zarządzaj własnymi tagami mapowania
            </summary>
            <div className="mt-2">
              <DayPlanTaggedNote
                hint="Dodaj raz — potem klikasz je przy każdym punkcie schematu."
                text=""
                tags={[]}
                options={mappingTags}
                defaultOptions={DEFAULT_DAY_PLAN_TAGS.mapping}
                hideNote
                selectable={false}
                showVocabManager
                className="border-0 bg-transparent p-0"
                onTextChange={() => {}}
                onTagsChange={() => {}}
                onOptionsChange={patchMappingTags}
              />
            </div>
          </details>

          <div className="grid gap-2">
            {prompts.map((prompt, idx) => {
              const promptText = block.prompts?.[prompt.id] || "";
              const promptTags = block.prompt_tags?.[prompt.id] || [];
              const answered = isTaggedNoteFilled(promptText, promptTags);
              return (
                <div key={prompt.id} className="space-y-1.5">
                  <p className="flex items-start gap-2 text-[12px] font-medium text-foreground/90">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border/70 text-[10px] tabular-nums text-muted-foreground">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1">{lang === "en" ? prompt.en : prompt.pl}</span>
                    {answered ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-profit" />
                    ) : null}
                  </p>
                  <DayPlanTaggedNote
                    text={promptText}
                    tags={promptTags}
                    suggestTags={prompt.tags || []}
                    options={mappingTags}
                    defaultOptions={DEFAULT_DAY_PLAN_TAGS.mapping}
                    rows={2}
                    noteCollapsible
                    done={answered}
                    onTextChange={(value) =>
                      patchHorizon((b) => ({
                        ...b,
                        saved: false,
                        prompts: { ...b.prompts, [prompt.id]: value },
                      }))
                    }
                    onTagsChange={(tags) =>
                      patchHorizon((b) => ({
                        ...b,
                        saved: false,
                        prompt_tags: { ...b.prompt_tags, [prompt.id]: tags },
                      }))
                    }
                    onOptionsChange={patchMappingTags}
                  />
                </div>
              );
            })}
          </div>

          {(horizon === "mtf" || horizon === "ltf") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Charakter Azji (PD)</Label>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {ASIA_PD_OPTIONS.map((opt) => (
                  <ChoiceChip
                    key={opt.id}
                    active={block.asia_pd === opt.id}
                    title={opt.pl}
                    onClick={() => patchHorizon({ asia_pd: opt.id, saved: false })}
                  />
                ))}
              </div>
            </div>
          )}

          {horizon === "mtf" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <DayPlanTaggedNote
                label="Korelacja / FORMUŁA"
                text={block.correlation || block.scenarios || block.formula || ""}
                tags={block.correlation_tags || []}
                suggestTags={["Korelacja", "FORMUŁA", "Scenariusz A", "Scenariusz B"]}
                options={mappingTags}
                defaultOptions={DEFAULT_DAY_PLAN_TAGS.mapping}
                rows={2}
                noteCollapsible
                onTextChange={(value) =>
                  patchHorizon({
                    correlation: value,
                    scenarios: value,
                    formula: value,
                    saved: false,
                  })
                }
                onTagsChange={(tags) => patchHorizon({ correlation_tags: tags, saved: false })}
                onOptionsChange={patchMappingTags}
              />
              <div className="space-y-1">
                <BiasDayControl bias={dailyBias} onChange={setDailyBias} />
              </div>
            </div>
          )}

          {horizon !== "mtf" ? <BiasDayControl bias={dailyBias} onChange={setDailyBias} /> : null}

          {horizon === "ltf" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Godziny obserwacji</Label>
                <Input
                  value={block.watch_hours || ""}
                  onChange={(e) => patchHorizon({ watch_hours: e.target.value, saved: false })}
                  className="h-8 text-sm"
                  placeholder="np. 08:00–11:00"
                />
              </div>
              <div className="flex flex-col justify-end gap-1.5 pb-0.5">
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={!!block.not_inducable}
                    onCheckedChange={(v) => patchHorizon({ not_inducable: !!v, saved: false })}
                  />
                  NOT INDUCABLE
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={!!block.ny_alert}
                    onCheckedChange={(v) => patchHorizon({ ny_alert: !!v, saved: false })}
                  />
                  Alert na NY
                </label>
              </div>
            </div>
          )}

          <DayPlanTaggedNote
            label={`Notatki z mapowania (${horizon.toUpperCase()})`}
            text={block.notes || ""}
            tags={block.note_tags || []}
            suggestTags={["Wniosek", "Setup gotowy", "Tylko obserwacja", "Brak schematu"]}
            options={mappingTags}
            defaultOptions={DEFAULT_DAY_PLAN_TAGS.mapping}
            rows={3}
            maxLength={500}
            noteCollapsible
            onTextChange={(value) => patchHorizon({ notes: value, saved: false })}
            onTagsChange={(tags) => patchHorizon({ note_tags: tags, saved: false })}
            onOptionsChange={patchMappingTags}
          />
        </div>

        {/* Right: exactly two pair tables */}
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Dwie tabele · u góry para · na dole ptaszki za zrobione ({horizon.toUpperCase()} · {sessionLabel})
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <PairMapTable
              label="Tabela 1"
              table={tableA}
              horizon={horizon}
              lang={lang}
              otherSymbol={tableB.symbol}
              onSymbolChange={(sym) => patchTable("a", { symbol: sym })}
              onCheckChange={(id, checked) =>
                patchTable("a", (t) => ({
                  ...t,
                  checks: { ...t.checks, [id]: checked },
                }))
              }
            />
            <PairMapTable
              label="Tabela 2"
              table={tableB}
              horizon={horizon}
              lang={lang}
              otherSymbol={tableA.symbol}
              onSymbolChange={(sym) => patchTable("b", { symbol: sym })}
              onCheckChange={(id, checked) =>
                patchTable("b", (t) => ({
                  ...t,
                  checks: { ...t.checks, [id]: checked },
                }))
              }
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 justify-start text-xs"
          disabled={hzIndex <= 0 && sessionIndex <= 0}
          onClick={() => {
            if (hzIndex > 0) goHorizon(HORIZONS[hzIndex - 1]);
            else if (sessionIndex > 0) {
              goSession(TRADING_SESSIONS[sessionIndex - 1].id);
              goHorizon("ltf");
            }
          }}
        >
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
          {hzIndex > 0
            ? `Wróć do ${HORIZONS[hzIndex - 1].toUpperCase()}`
            : sessionIndex > 0
              ? `Wróć do ${TRADING_SESSIONS[sessionIndex - 1].labelPl}`
              : "Wstecz"}
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              patchHorizon({ saved: true });
              onSaveHorizon?.();
            }}
          >
            <Save className="mr-1 h-3.5 w-3.5" />
            Zapisz mapowanie
          </Button>
          <Button
            type="button"
            className="cyber-primary-btn h-8 text-xs"
            onClick={() => {
              patchHorizon({ saved: true });
              onSaveHorizon?.();
              if (hzIndex < HORIZONS.length - 1) {
                goHorizon(HORIZONS[hzIndex + 1]);
              } else if (sessionIndex < TRADING_SESSIONS.length - 1) {
                goSession(TRADING_SESSIONS[sessionIndex + 1].id);
              }
            }}
          >
            {hzIndex < HORIZONS.length - 1
              ? `Dalej · ${HORIZONS[hzIndex + 1].toUpperCase()}`
              : sessionIndex < TRADING_SESSIONS.length - 1
                ? `Dalej · ${TRADING_SESSIONS[sessionIndex + 1].labelPl}`
                : "Gotowe"}
            {promptProgress.total > 0 && promptProgress.done < promptProgress.total ? (
              <span className="ml-1 opacity-80">({promptProgress.done}/{promptProgress.total})</span>
            ) : (
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProcessCard({ plan, lang, patchPlan }) {
  const process = plan.post_session?.process || {};
  const pct = processCriteriaScore(process);
  const band = processBandForScore(pct);
  return (
    <details className="rounded-xl border border-border bg-card/50 px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
        Ocena procesu po transakcji · {pct}% · {lang === "en" ? band.en : band.pl}
      </summary>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {PROCESS_TRADE_CRITERIA.map((item) => (
          <label key={item.id} className="flex items-start gap-2 text-[12px]">
            <Checkbox
              checked={!!process[item.id]}
              onCheckedChange={(v) =>
                patchPlan((prev) => ({
                  ...prev,
                  post_session: {
                    ...prev.post_session,
                    process: { ...prev.post_session?.process, [item.id]: !!v },
                  },
                }))
              }
              className="mt-0.5"
            />
            <span>{lang === "en" ? item.en : item.pl}</span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">0–50% chaos · 50–75% średnio · 75–100% dobry proces</p>
    </details>
  );
}

export default function DayPlanGuidedFlow({
  plan,
  lang = "pl",
  patchPlan,
  onPersist,
  initialView,
  initialSession,
  initialHorizon,
}) {
  const [now, setNow] = useState(() => new Date());
  const [editingFocus, setEditingFocus] = useState(!isFocusComplete(plan?.focus));
  const focusDone = isFocusComplete(plan?.focus);
  const phase =
    plan?.phase === "mapping" && focusDone
      ? "mapping"
      : plan?.phase === "mapping" && !focusDone
        ? "focus"
        : plan?.phase || "focus";

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (initialSession && ["asia", "london", "ny"].includes(initialSession)) {
      patchPlan((prev) => ({
        ...prev,
        mapping_session: initialSession,
        mapping_step: initialHorizon || prev.mapping_step || "htf",
        phase: initialView === "mapping" && isFocusComplete(prev.focus) ? "mapping" : prev.phase || "focus",
      }));
      if (initialView === "mapping") setEditingFocus(false);
    } else if (initialView === "focus") {
      patchPlan((prev) => ({ ...prev, phase: "focus" }));
      setEditingFocus(true);
    } else if (initialView === "mapping" && focusDone && plan?.mapping_session) {
      patchPlan((prev) => ({ ...prev, phase: "mapping" }));
      setEditingFocus(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialView, initialSession, initialHorizon]);

  useEffect(() => {
    if (!focusDone) setEditingFocus(true);
  }, [focusDone]);

  const active = useMemo(() => getActiveTradingSession(now), [now]);
  const sessionPicked = ["asia", "london", "ny"].includes(plan?.mapping_session);
  const next = dayPlanNextAction(plan, plan?.mapping_session || active?.id, lang);

  const selectSession = (id) => {
    patchPlan((prev) => ({
      ...prev,
      mapping_session: id,
      mapping_step: "htf",
      phase: focusDone ? "mapping" : "focus",
    }));
    onPersist?.();
  };

  return (
    <div className="space-y-3">
      <SessionTimeline
        sessionId={sessionPicked ? plan.mapping_session : null}
        now={now}
        lang={lang}
        onSelect={selectSession}
        required
      />

      {!sessionPicked ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Wybierz sesję powyżej, żeby przejść do Skupienia i Mapowania z właściwymi zaleceniami.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 border-b border-border pb-px">
            {[
              { id: "focus", label: "Skupienie" },
              { id: "mapping", label: "Mapowanie", disabled: !focusDone },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                disabled={tab.disabled}
                onClick={() => {
                  if (tab.id === "focus") {
                    patchPlan((prev) => ({ ...prev, phase: "focus" }));
                    setEditingFocus(!focusDone);
                  } else {
                    patchPlan((prev) => ({
                      ...prev,
                      phase: "mapping",
                    }));
                    setEditingFocus(false);
                  }
                }}
                className={cn(
                  "px-3 py-2 text-sm font-medium border-b-2 -mb-px",
                  phase === tab.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                  tab.disabled && "opacity-45 cursor-not-allowed"
                )}
              >
                {tab.label}
              </button>
            ))}
            <span className="ml-auto self-center text-[11px] text-muted-foreground">
              {focusStatusLabel(plan.focus, lang)}
              {next?.label ? ` · ${next.label}` : ""}
            </span>
          </div>

          {phase === "focus" || editingFocus ? (
            editingFocus || !focusDone ? (
              <FocusEditor
                plan={plan}
                lang={lang}
                patchPlan={patchPlan}
                onDone={() => {
                  setEditingFocus(false);
                  onPersist?.();
                }}
              />
            ) : (
              <FocusSummary plan={plan} lang={lang} onEdit={() => setEditingFocus(true)} />
            )
          ) : null}

          {phase === "mapping" && focusDone ? (
            <>
              {!editingFocus ? <FocusSummary plan={plan} lang={lang} onEdit={() => setEditingFocus(true)} /> : null}
              <MappingPanel plan={plan} lang={lang} patchPlan={patchPlan} onSaveHorizon={() => onPersist?.()} />
            </>
          ) : null}

          <ProcessCard plan={plan} lang={lang} patchPlan={patchPlan} />
        </>
      )}
    </div>
  );
}
