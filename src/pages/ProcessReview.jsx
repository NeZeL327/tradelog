import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { getTrades, createReport } from "@/lib/localStorage";
import {
  getIsoWeek,
  getIsoWeekRange,
  monthBounds,
  quarterBounds,
  yearBounds,
} from "@/lib/reports";
import {
  buildProcessReview,
  buildLocalNarrative,
  toAiSafePayload,
} from "@/lib/processReview";
import {
  AI_PROVIDERS,
  clearAiByokSettings,
  generateProcessReviewAi,
  loadAiByokSettings,
  saveAiByokSettings,
} from "@/lib/aiByok";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import QuoteLine from "@/components/QuoteLine";
import { toast } from "sonner";
import {
  ChevronDown,
  FileDown,
  Loader2,
  Printer,
  Save,
} from "lucide-react";

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function displayRange(start, end) {
  if (!start || !end) return "—";
  const a = String(start).split("-").reverse().join(".");
  const b = String(end).split("-").reverse().join(".");
  return `${a} – ${b}`;
}

function presetRange(preset) {
  const now = new Date();
  const year = now.getFullYear();
  if (preset === "week") return getIsoWeekRange(year, getIsoWeek(now));
  if (preset === "month") return monthBounds(year, now.getMonth() + 1);
  if (preset === "quarter") {
    return quarterBounds(year, Math.floor(now.getMonth() / 3) + 1);
  }
  if (preset === "year") return yearBounds(year);
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  return { start: fmtDate(start), end: fmtDate(end) };
}

const PRESETS = [
  { id: "week", label: "Tydzień" },
  { id: "month", label: "Miesiąc" },
  { id: "quarter", label: "Kwartał" },
  { id: "year", label: "Rok" },
  { id: "custom", label: "Zakres" },
];

function Kpi({ label, value, hint, tone }) {
  return (
    <div className="min-w-0 px-1 py-1 sm:px-2">
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight",
          tone === "good" && "text-profit dark:text-profit",
          tone === "bad" && "text-loss dark:text-loss",
          !tone && "text-foreground"
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p> : null}
    </div>
  );
}

function RankBar({ label, meta, ratio, tone = "neutral", rank }) {
  const bar =
    tone === "good"
      ? "bg-profit/80"
      : tone === "bad"
        ? "bg-loss/75"
        : "bg-slate-400/70 dark:bg-slate-500/70";
  return (
    <div className="space-y-1.5 py-2.5 border-b border-border/50 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex items-baseline gap-2">
          {rank != null ? (
            <span className="text-[11px] tabular-nums text-muted-foreground w-4 shrink-0">
              {rank}
            </span>
          ) : null}
          <span className="text-sm font-medium truncate">{label}</span>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground shrink-0">{meta}</span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", bar)}
          style={{ width: `${Math.max(6, Math.min(100, ratio * 100))}%` }}
        />
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, className }) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/80 bg-card/80 overflow-hidden",
        className
      )}
    >
      <div className="px-4 sm:px-5 pt-4 pb-2 border-b border-border/60">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {subtitle ? (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      <div className="px-4 sm:px-5 py-2 sm:py-3">{children}</div>
    </section>
  );
}

export default function ProcessReview() {
  const { user } = useAuth();
  const initial = useMemo(() => presetRange("week"), []);
  const [preset, setPreset] = useState("week");
  const [dateFrom, setDateFrom] = useState(initial.start);
  const [dateTo, setDateTo] = useState(initial.end);

  const [review, setReview] = useState(null);
  const [generatedRange, setGeneratedRange] = useState(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const [byok, setByok] = useState(() => loadAiByokSettings());
  const [showKey, setShowKey] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const { data: trades = [], isLoading } = useQuery({
    queryKey: ["trades", user?.id],
    queryFn: () => getTrades(user?.id),
    enabled: !!user?.id,
  });

  const narrative = useMemo(
    () => (review ? buildLocalNarrative(review) : null),
    [review]
  );

  const maxMistake = Math.max(1, ...(review?.topMistakes || []).map((r) => r.trades));
  const maxWrong = Math.max(1, ...(review?.wentWrong || []).map((r) => r.trades));
  const maxWell = Math.max(1, ...(review?.wentWell || []).map((r) => r.trades));
  const psyRows = [...(review?.psychology || []), ...(review?.emotions || [])].slice(0, 8);
  const maxPsy = Math.max(1, ...psyRows.map((r) => r.trades));
  const maxSes = Math.max(1, ...(review?.sessions || []).map((r) => r.trades));

  const applyPreset = (id) => {
    setPreset(id);
    if (id === "custom") return;
    const range = presetRange(id);
    setDateFrom(range.start);
    setDateTo(range.end);
  };

  const onGenerate = () => {
    const start = String(dateFrom || "").slice(0, 10);
    const end = String(dateTo || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      toast.error("Wybierz poprawne daty Od i Do.");
      return;
    }
    if (start > end) {
      toast.error("Data „Od” nie może być późniejsza niż „Do”.");
      return;
    }
    const next = buildProcessReview(trades, start, end);
    setReview(next);
    setGeneratedRange({ start, end });
    setHasGenerated(true);
    setAiText("");
    if (!next.stats.trades_count) {
      toast.message("Brak zamkniętych trejdów w tym zakresie.");
    } else {
      toast.success(`Analiza gotowa · ${next.stats.trades_count} trejdów`);
    }
  };

  const persistByok = (patch) => {
    setByok(saveAiByokSettings({ ...byok, ...patch }));
  };

  const onGenerateAi = async () => {
    if (!review) {
      toast.error("Najpierw wygeneruj analizę lokalną.");
      return;
    }
    setAiBusy(true);
    try {
      const { text } = await generateProcessReviewAi(toAiSafePayload(review), byok);
      setAiText(text);
      toast.success("Tekst AI dopisany.");
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Błąd AI.");
    } finally {
      setAiBusy(false);
    }
  };

  const onPrint = () => {
    if (!hasGenerated) {
      toast.error("Najpierw wygeneruj analizę.");
      return;
    }
    window.print();
  };

  const onSaveAsReport = async () => {
    if (!user?.id || !review || !narrative || !generatedRange) return;
    setSaveBusy(true);
    try {
      const y = Number(String(generatedRange.start).slice(0, 4));
      await createReport(user.id, {
        report_type: "weekly",
        status: "draft",
        year: y || new Date().getFullYear(),
        period_start: generatedRange.start,
        period_end: generatedRange.end,
        sort_date: generatedRange.end,
        trades_count: review.stats.trades_count,
        wins_count: review.stats.wins_count,
        losses_count: review.stats.losses_count,
        win_rate: review.stats.win_rate,
        what_went_well: narrative.well.join("\n") || "—",
        mistakes: narrative.mistakes.join("\n") || "—",
        mental: (review.psychology || [])
          .slice(0, 5)
          .map((r) => `${r.tag} (${r.trades}×)`)
          .join("\n"),
        key_lesson: narrative.focus,
        improve_next: (narrative.improve || []).join("\n") || narrative.focus,
        reflection: aiText
          ? `${narrative.summary}\n\n--- AI ---\n${aiText}`
          : narrative.summary,
        screenshots: [],
      });
      toast.success("Zapisano szkic w Raportach.");
    } catch (err) {
      console.error(err);
      toast.error("Nie udało się zapisać raportu.");
    } finally {
      setSaveBusy(false);
    }
  };

  return (
    <div className="w-full min-h-0 space-y-6 dashboard-surface pb-8">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #process-review-print, #process-review-print * { visibility: visible !important; }
          #process-review-print {
            position: absolute; left: 0; top: 0; width: 100%;
            padding: 12px; background: white; color: #0f172a;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="cyber-page-title">Przegląd procesu</h1>
          <p className="cyber-page-sub max-w-xl">
            Weekly review po tagach — co nie zagrało, co poprawić. Bez screenów i bez wycieku strategii.
          </p>
        </div>
        <QuoteLine className="hidden lg:flex shrink-0" />
      </div>

      {/* Control bar — TradeZella / Edgewonk style toolbar */}
      <div className="no-print rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-1 p-1.5 border-b border-border/70 bg-muted/30">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition",
                preset === p.id
                  ? "bg-background text-foreground shadow-sm border border-border/80"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="grid grid-cols-2 gap-3 flex-1">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium">Od</Label>
              <Input
                type="date"
                className="h-10 bg-background"
                value={dateFrom}
                onChange={(e) => {
                  setPreset("custom");
                  setDateFrom(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground font-medium">Do</Label>
              <Input
                type="date"
                className="h-10 bg-background"
                value={dateTo}
                onChange={(e) => {
                  setPreset("custom");
                  setDateTo(e.target.value);
                }}
              />
            </div>
          </div>
          <Button
            type="button"
            className="h-10 px-6 font-medium shrink-0"
            disabled={isLoading || !user?.id}
            onClick={onGenerate}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Generuj analizę
          </Button>
        </div>
      </div>

      {!hasGenerated ? (
        <div className="no-print rounded-xl border border-dashed border-border/80 bg-muted/15 px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">Wybierz okres i wygeneruj przegląd</p>
          <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
            Ranking błędów, psychologia, sesje i jeden konkretny fokus na kolejny okres — jak w
            profesjonalnym weekly review.
          </p>
        </div>
      ) : (
        <div id="process-review-print" className="space-y-5">
          {/* Period + actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground font-medium">
                Zakres analizy
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mt-0.5">
                {displayRange(generatedRange?.start, generatedRange?.end)}
              </h2>
            </div>
            <div className="no-print flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onPrint}>
                <Printer className="w-3.5 h-3.5" />
                Drukuj
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={saveBusy || !review?.stats?.trades_count}
                onClick={onSaveAsReport}
              >
                <Save className="w-3.5 h-3.5" />
                Zapisz szkic
              </Button>
            </div>
          </div>

          {/* KPI strip */}
          <div className="rounded-xl border border-border bg-card px-3 sm:px-5 py-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-2 lg:divide-x divide-border/70">
              <Kpi label="Trejdy" value={review.stats.trades_count} />
              <Kpi
                label="Win rate"
                value={`${review.stats.win_rate}%`}
                tone={review.stats.win_rate >= 50 ? "good" : review.stats.win_rate < 40 ? "bad" : undefined}
              />
              <Kpi
                label="Proces clean"
                value={`${review.stats.process_score}%`}
                hint="bez tagu błędu"
                tone={review.stats.process_score >= 70 ? "good" : "bad"}
              />
              <Kpi
                label="Z błędem"
                value={review.stats.with_mistakes}
                tone={review.stats.with_mistakes > 0 ? "bad" : "good"}
              />
            </div>
          </div>

          {/* Focus banner */}
          <div className="rounded-xl border border-border bg-card px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground pt-0.5 sm:w-28">
              Fokus
            </div>
            <p className="text-base sm:text-lg font-medium leading-snug text-foreground">
              {narrative?.focus}
            </p>
          </div>

          {/* Main two columns: problems + fixes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel
              title="Co nie zagrało"
              subtitle="Najsłabsze wzorce w tagach z wybranego zakresu"
            >
              {review.wentWrong.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">
                  Brak wyraźnych negatywnych wzorców — uzupełnij tagi przy trejdach.
                </p>
              ) : (
                review.wentWrong.map((r, i) => (
                  <RankBar
                    key={`w-${r.source}-${r.tag}`}
                    rank={i + 1}
                    label={`${r.tag}${r.source ? ` · ${r.source}` : ""}`}
                    meta={`${r.trades}× · ${r.winRate}% WR`}
                    ratio={r.trades / maxWrong}
                    tone="bad"
                  />
                ))
              )}
            </Panel>

            <Panel title="Co poprawić" subtitle="Konkretne punkty na kolejny okres">
              {(narrative?.improve || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">Brak rekomendacji.</p>
              ) : (
                <ol className="space-y-0 divide-y divide-border/50">
                  {narrative.improve.map((item, i) => (
                    <li key={item} className="flex gap-3 py-3 first:pt-1 last:pb-1">
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground w-5 shrink-0 pt-0.5">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm leading-relaxed text-foreground">{item}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>

          {/* Mistakes ranking */}
          <Panel title="Ranking błędów" subtitle="Najczęściej oznaczane błędy procesowe">
            {review.topMistakes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">
                Brak tagów błędów w zakresie.
              </p>
            ) : (
              review.topMistakes.map((r, i) => (
                <RankBar
                  key={`m-${r.tag}`}
                  rank={i + 1}
                  label={r.tag}
                  meta={`${r.trades}× · ${r.winRate}% WR`}
                  ratio={r.trades / maxMistake}
                  tone="bad"
                />
              ))
            )}
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel title="Co działało" subtitle="Pozytywne tagi">
              {review.wentWell.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Za mało powtórzeń.</p>
              ) : (
                review.wentWell.slice(0, 6).map((r, i) => (
                  <RankBar
                    key={`g-${r.source}-${r.tag}`}
                    rank={i + 1}
                    label={r.tag}
                    meta={`${r.trades}× · ${r.winRate}%`}
                    ratio={r.trades / maxWell}
                    tone="good"
                  />
                ))
              )}
            </Panel>

            <Panel title="Psychologia" subtitle="Mindset + emocje">
              {psyRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Brak tagów psychologii.</p>
              ) : (
                psyRows.map((r, i) => (
                  <RankBar
                    key={`p-${r.tag}`}
                    rank={i + 1}
                    label={r.tag}
                    meta={`${r.trades}× · ${r.winRate}%`}
                    ratio={r.trades / maxPsy}
                  />
                ))
              )}
            </Panel>

            <Panel title="Sesje" subtitle="Kiedy handlujesz">
              {(review.sessions || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Brak danych sesji.</p>
              ) : (
                review.sessions.map((r, i) => (
                  <RankBar
                    key={`s-${r.tag}`}
                    rank={i + 1}
                    label={r.tag}
                    meta={`${r.trades}× · ${r.winRate}%`}
                    ratio={r.trades / maxSes}
                  />
                ))
              )}
            </Panel>
          </div>

          {aiText ? (
            <Panel title="Notatka AI" subtitle="Edytowalna — możesz poprawić przed zapisem">
              <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground/90 py-2">
                {aiText}
              </pre>
            </Panel>
          ) : null}

          <p className="text-[11px] text-muted-foreground no-print">
            {narrative?.summary}
          </p>
        </div>
      )}

      {/* Advanced: BYOK — collapsed, not the hero */}
      <Collapsible open={aiOpen} onOpenChange={setAiOpen} className="no-print">
        <div className="rounded-xl border border-border/70 bg-muted/20">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm hover:bg-muted/40 transition rounded-xl"
            >
              <span className="font-medium text-foreground/90">
                Opcje zaawansowane · własne API AI
              </span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform",
                  aiOpen && "rotate-180"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Klucz tylko w tej przeglądarce. Na zewnątrz idą wyłącznie częstotliwości tagów —
                bez screenów, symboli i notatek strategii.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Dostawca</Label>
                  <Select
                    value={byok.provider}
                    onValueChange={(provider) => {
                      const p = AI_PROVIDERS.find((x) => x.id === provider);
                      persistByok({ provider, model: p?.defaultModel || byok.model });
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_PROVIDERS.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] text-muted-foreground">Klucz API</Label>
                  <div className="flex gap-2">
                    <Input
                      className="h-9 font-mono text-xs"
                      type={showKey ? "text" : "password"}
                      value={byok.apiKey}
                      placeholder="sk-…"
                      onChange={(e) => persistByok({ apiKey: e.target.value })}
                      autoComplete="off"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 shrink-0"
                      onClick={() => setShowKey((v) => !v)}
                    >
                      {showKey ? "Ukryj" : "Pokaż"}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] text-muted-foreground">Model</Label>
                  <Input
                    className="h-9"
                    value={byok.model}
                    onChange={(e) => persistByok({ model: e.target.value })}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9 w-full gap-1.5"
                    disabled={aiBusy || !hasGenerated || !review?.stats?.trades_count}
                    onClick={onGenerateAi}
                  >
                    {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                    Dopisz AI
                  </Button>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs h-8 px-2"
                onClick={() => {
                  clearAiByokSettings();
                  setByok(loadAiByokSettings());
                  toast.message("Usunięto klucz.");
                }}
              >
                Usuń klucz z przeglądarki
              </Button>
              {aiText ? (
                <Textarea
                  className="min-h-[140px] text-sm"
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                />
              ) : null}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
