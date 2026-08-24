import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReportScreenshots from "./ReportScreenshots";
import {
  bestWorstMonths,
  bestWorstQuarters,
  bestWorstWeeks,
  computeBasicStats,
  getIsoWeekRange,
  monthBounds,
  quarterBounds,
  tradesInPeriod,
  yearBounds,
} from "@/lib/reports";

const emptyForm = (type) => ({
  report_type: type,
  status: "draft",
  year: new Date().getFullYear(),
  week_number: "",
  month: new Date().getMonth() + 1,
  quarter: Math.floor(new Date().getMonth() / 3) + 1,
  period_start: "",
  period_end: "",
  result_r: "",
  trades_count: "",
  wins_count: "",
  losses_count: "",
  win_rate: "",
  avg_r: "",
  best_week: "",
  worst_week: "",
  best_month: "",
  worst_month: "",
  best_quarter: "",
  worst_quarter: "",
  reflection: "",
  what_went_well: "",
  mistakes: "",
  mental: "",
  progress: "",
  trading_changes: "",
  key_lesson: "",
  improve_next: "",
  rating: 0,
  screenshots: [],
  sort_date: "",
});

const fieldClass =
  "h-9 rounded-lg border-border/70 bg-muted/35 dark:bg-white/[0.04] px-3 text-sm shadow-none " +
  "placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/40 " +
  "disabled:opacity-60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const areaClass =
  "min-h-[72px] rounded-lg border-border/70 bg-muted/30 dark:bg-white/[0.03] px-3 py-2 text-sm shadow-none " +
  "placeholder:text-muted-foreground/55 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary/40 resize-y";

const selectTriggerClass =
  "h-9 rounded-lg border-border/70 bg-muted/35 dark:bg-white/[0.04] shadow-none focus:ring-2 focus:ring-primary/25";

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** Custom number input with styled up/down steppers */
function NumberStepper({
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  placeholder = "0",
  disabled = false,
}) {
  const parsed = value === "" || value == null ? null : Number(value);

  const clamp = (n) => {
    let next = n;
    if (min != null && next < min) next = min;
    if (max != null && next > max) next = max;
    if (step < 1) {
      const decimals = String(step).split(".")[1]?.length || 1;
      next = Number(next.toFixed(decimals));
    }
    return next;
  };

  const bump = (dir) => {
    if (disabled) return;
    const base = Number.isFinite(parsed) ? parsed : 0;
    onChange(String(clamp(base + dir * step)));
  };

  return (
    <div
      className={`group flex h-9 items-stretch overflow-hidden rounded-lg border border-border/70 bg-muted/35 dark:bg-white/[0.04] transition-colors
        focus-within:ring-2 focus-within:ring-primary/25 focus-within:border-primary/40
        ${disabled ? "opacity-60" : ""}`}
    >
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.replace(",", ".");
          if (raw === "" || raw === "-" || /^-?\d*\.?\d*$/.test(raw)) {
            onChange(raw);
          }
        }}
        onBlur={() => {
          if (value === "" || value === "-" || value == null) return;
          const n = Number(value);
          if (Number.isFinite(n)) onChange(String(clamp(n)));
        }}
        className="min-w-0 flex-1 bg-transparent px-3 text-sm tabular-nums outline-none placeholder:text-muted-foreground/60"
      />
      {suffix ? (
        <span className="flex items-center pr-1 text-[11px] font-semibold text-muted-foreground">
          {suffix}
        </span>
      ) : null}
      <div className="flex w-8 flex-col border-l border-border/50 bg-muted/25 dark:bg-white/[0.03]">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || (max != null && Number.isFinite(parsed) && parsed >= max)}
          onClick={() => bump(1)}
          className="flex flex-1 items-center justify-center text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-30"
          aria-label="Zwiększ"
        >
          <ChevronUp className="h-3 w-3" strokeWidth={2.5} />
        </button>
        <div className="h-px bg-border/50" />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || (min != null && Number.isFinite(parsed) && parsed <= min)}
          onClick={() => bump(-1)}
          className="flex flex-1 items-center justify-center text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-30"
          aria-label="Zmniejsz"
        >
          <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function TextRow({ label, value, onChange, placeholder, highlight = false }) {
  return (
    <div className={`px-4 py-3 ${highlight ? "bg-primary/[0.04] dark:bg-primary/10" : ""}`}>
      <Label className={`text-[12px] font-semibold mb-1.5 block ${highlight ? "text-primary" : "text-foreground/80"}`}>
        {label}
      </Label>
      <Textarea
        rows={2}
        className={areaClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function RatingPicker({ value, onChange, label }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] font-semibold text-foreground/80 mr-1">{label}</span>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`h-8 w-8 rounded-md text-xs font-semibold transition-colors ${
            Number(value) === n
              ? "bg-primary text-primary-foreground"
              : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {n}
        </button>
      ))}
      <span className="text-xs text-muted-foreground ml-1">{value ? `${value}/10` : "—"}</span>
    </div>
  );
}

export default function ReportForm({
  reportType,
  report,
  trades = [],
  userId,
  onSubmit,
  onCancel,
  saving,
  t,
}) {
  const [form, setForm] = useState(() => {
    if (report) {
      return {
        ...emptyForm(report.report_type || reportType),
        ...report,
        screenshots: Array.isArray(report.screenshots) ? report.screenshots : [],
      };
    }
    return emptyForm(reportType);
  });

  const type = form.report_type || reportType;

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const periodRange = useMemo(() => {
    if (type === "weekly") {
      if (form.period_start && form.period_end) {
        return { start: form.period_start, end: form.period_end };
      }
      return getIsoWeekRange(form.year, form.week_number);
    }
    if (type === "monthly") return monthBounds(form.year, form.month);
    if (type === "quarterly") return quarterBounds(form.year, form.quarter);
    if (type === "yearly") return yearBounds(form.year);
    return { start: "", end: "" };
  }, [type, form.year, form.week_number, form.month, form.quarter, form.period_start, form.period_end]);

  // Auto week dates when year/week change
  useEffect(() => {
    if (type !== "weekly" || !form.year || !form.week_number) return;
    const { start, end } = getIsoWeekRange(form.year, form.week_number);
    if (!start) return;
    setForm((prev) => ({
      ...prev,
      period_start: start,
      period_end: end,
      sort_date: end,
    }));
  }, [type, form.year, form.week_number]);

  // Sync period bounds for month/quarter/year
  useEffect(() => {
    if (type === "weekly") return;
    const { start, end } = periodRange;
    if (!start) return;
    setForm((prev) => ({
      ...prev,
      period_start: start,
      period_end: end,
      sort_date: end,
    }));
  }, [type, periodRange.start, periodRange.end]);

  const applyTradeStats = () => {
    const { start, end } = periodRange;
    const list = tradesInPeriod(trades, start, end);
    const basic = computeBasicStats(list);
    const patch = {
      trades_count: basic.trades_count,
      wins_count: basic.wins_count,
      losses_count: basic.losses_count,
      win_rate: basic.win_rate,
    };
    if (type === "monthly" || type === "yearly") {
      Object.assign(patch, bestWorstWeeks(trades, start, end));
    }
    if (type === "quarterly" || type === "yearly") {
      Object.assign(patch, bestWorstMonths(trades, start, end));
    }
    if (type === "yearly") {
      Object.assign(patch, bestWorstQuarters(trades, form.year));
    }
    setForm((prev) => ({ ...prev, ...patch }));
  };

  // Auto win rate when wins/trades change manually
  useEffect(() => {
    const wins = Number(form.wins_count);
    const losses = Number(form.losses_count);
    if (Number.isFinite(wins) && Number.isFinite(losses) && wins + losses > 0) {
      const wr = Number(((wins / (wins + losses)) * 100).toFixed(1));
      if (String(form.win_rate) !== String(wr)) {
        setForm((prev) => ({ ...prev, win_rate: wr }));
      }
      return;
    }
    const total = Number(form.trades_count);
    if (Number.isFinite(wins) && Number.isFinite(total) && total > 0) {
      const wr = Number(((wins / total) * 100).toFixed(1));
      if (String(form.win_rate) !== String(wr)) {
        setForm((prev) => ({ ...prev, win_rate: wr }));
      }
    }
  }, [form.wins_count, form.losses_count, form.trades_count]);

  const buildPayload = (status) => {
    const num = (v) => (v === "" || v == null ? null : Number(v));
    return {
      report_type: type,
      status,
      year: num(form.year),
      week_number: type === "weekly" ? num(form.week_number) : null,
      month: type === "monthly" ? num(form.month) : null,
      quarter: type === "quarterly" ? num(form.quarter) : null,
      period_start: form.period_start || "",
      period_end: form.period_end || "",
      sort_date: form.sort_date || form.period_end || form.period_start || "",
      result_r: num(form.result_r),
      trades_count: num(form.trades_count),
      wins_count: num(form.wins_count),
      losses_count: num(form.losses_count),
      win_rate: num(form.win_rate),
      avg_r: num(form.avg_r),
      best_week: form.best_week || "",
      worst_week: form.worst_week || "",
      best_month: form.best_month || "",
      worst_month: form.worst_month || "",
      best_quarter: form.best_quarter || "",
      worst_quarter: form.worst_quarter || "",
      reflection: form.reflection || "",
      what_went_well: form.what_went_well || "",
      mistakes: form.mistakes || "",
      mental: form.mental || "",
      progress: form.progress || "",
      trading_changes: form.trading_changes || "",
      key_lesson: form.key_lesson || "",
      improve_next: form.improve_next || "",
      rating: num(form.rating) || 0,
      screenshots: Array.isArray(form.screenshots) ? form.screenshots : [],
    };
  };

  const ratingLabel =
    type === "weekly"
      ? t("reportWeekRating") || "Ocena tygodnia"
      : type === "monthly"
        ? t("reportMonthRating") || "Ocena miesiąca"
        : type === "quarterly"
          ? t("reportQuarterRating") || "Ocena kwartału"
          : t("reportYearRating") || "Ocena roku";

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Okres + wyniki — jeden zwarty panel */}
      <div className="rounded-xl border border-border/70 bg-card/80 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/60 flex items-center justify-between gap-3 bg-muted/20">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("reportPeriod") || "Okres"} · {t("reportResults") || "Wyniki"}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={applyTradeStats}
          >
            {t("reportFillFromTrades") || "Uzupełnij z dziennika"}
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Field label={t("year") || "Rok"}>
              <NumberStepper value={form.year} onChange={(v) => setField("year", v)} step={1} min={2000} max={2100} />
            </Field>
            {type === "weekly" && (
              <Field label={t("reportWeekNumber") || "Tydzień"}>
                <NumberStepper value={form.week_number} onChange={(v) => setField("week_number", v)} step={1} min={1} max={53} />
              </Field>
            )}
            {type === "monthly" && (
              <Field label={t("month") || "Miesiąc"}>
                <Select value={String(form.month)} onValueChange={(v) => setField("month", Number(v))}>
                  <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {type === "quarterly" && (
              <Field label={t("reportQuarter") || "Kwartał"}>
                <Select value={String(form.quarter)} onValueChange={(v) => setField("quarter", Number(v))}>
                  <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((q) => (
                      <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {(type === "weekly" || form.period_start) && (
              <>
                <Field label={t("reportStartDate") || "Od"}>
                  <Input type="date" className={fieldClass} value={form.period_start || ""} onChange={(e) => setField("period_start", e.target.value)} disabled={type !== "weekly"} />
                </Field>
                <Field label={t("reportEndDate") || "Do"}>
                  <Input type="date" className={fieldClass} value={form.period_end || ""} onChange={(e) => setField("period_end", e.target.value)} disabled={type !== "weekly"} />
                </Field>
              </>
            )}
          </div>

          <div className="h-px bg-border/60" />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Field label={t("reportResultR") || "Wynik R"}>
              <NumberStepper value={form.result_r} onChange={(v) => setField("result_r", v)} step={0.1} suffix="R" placeholder="0.0" />
            </Field>
            <Field label={t("reportTradesCount") || "Trejdy"}>
              <NumberStepper value={form.trades_count} onChange={(v) => setField("trades_count", v)} step={1} min={0} />
            </Field>
            {type === "weekly" && (
              <>
                <Field label={t("reportWins") || "W"}>
                  <NumberStepper value={form.wins_count} onChange={(v) => setField("wins_count", v)} step={1} min={0} />
                </Field>
                <Field label={t("reportLosses") || "L"}>
                  <NumberStepper value={form.losses_count} onChange={(v) => setField("losses_count", v)} step={1} min={0} />
                </Field>
              </>
            )}
            <Field label="WR">
              <NumberStepper value={form.win_rate} onChange={(v) => setField("win_rate", v)} step={0.1} min={0} max={100} suffix="%" placeholder="0" />
            </Field>
            {type === "weekly" && (
              <Field label={t("reportAvgR") || "Śr. R"}>
                <NumberStepper value={form.avg_r} onChange={(v) => setField("avg_r", v)} step={0.1} suffix="R" placeholder="0.0" />
              </Field>
            )}
          </div>

          {(type === "monthly" || type === "quarterly" || type === "yearly") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {(type === "monthly" || type === "yearly") && (
                <>
                  <Field label={t("reportBestWeek") || "Najlepszy tydzień"}>
                    <Input className={fieldClass} value={form.best_week} onChange={(e) => setField("best_week", e.target.value)} />
                  </Field>
                  <Field label={t("reportWorstWeek") || "Najgorszy tydzień"}>
                    <Input className={fieldClass} value={form.worst_week} onChange={(e) => setField("worst_week", e.target.value)} />
                  </Field>
                </>
              )}
              {(type === "quarterly" || type === "yearly") && (
                <>
                  <Field label={t("reportBestMonth") || "Najlepszy miesiąc"}>
                    <Input className={fieldClass} value={form.best_month} onChange={(e) => setField("best_month", e.target.value)} />
                  </Field>
                  <Field label={t("reportWorstMonth") || "Najgorszy miesiąc"}>
                    <Input className={fieldClass} value={form.worst_month} onChange={(e) => setField("worst_month", e.target.value)} />
                  </Field>
                </>
              )}
              {type === "yearly" && (
                <>
                  <Field label={t("reportBestQuarter") || "Najlepszy kwartał"}>
                    <Input className={fieldClass} value={form.best_quarter} onChange={(e) => setField("best_quarter", e.target.value)} />
                  </Field>
                  <Field label={t("reportWorstQuarter") || "Najgorszy kwartał"}>
                    <Input className={fieldClass} value={form.worst_quarter} onChange={(e) => setField("worst_quarter", e.target.value)} />
                  </Field>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Refleksje — jeden panel, rzędy zamiast wielu kart */}
      <div className="rounded-xl border border-border/70 bg-card/80 overflow-hidden divide-y divide-border/60">
        <div className="px-4 py-2 bg-muted/20">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("reportReflection") || "Refleksja"}
          </p>
        </div>
        <TextRow
          label={t("reportReflection") || "Jak oceniam swój trading?"}
          value={form.reflection}
          onChange={(v) => setField("reflection", v)}
          placeholder={t("reportReflectionPlaceholder") || "Twoje przemyślenia…"}
        />
        <TextRow
          label={t("reportWhatWentWell") || "Co zrobiłem dobrze?"}
          value={form.what_went_well}
          onChange={(v) => setField("what_went_well", v)}
        />
        <TextRow
          label={
            type === "monthly"
              ? (t("reportMonthMistakes") || "Największe błędy miesiąca")
              : type === "quarterly"
                ? (t("reportBiggestProblems") || "Największe problemy")
                : (t("reportMistakes") || "Jakie błędy popełniłem?")
          }
          value={form.mistakes}
          onChange={(v) => setField("mistakes", v)}
        />
        <TextRow
          label={type === "yearly" ? (t("reportMentalYear") || "Jak zmienił się mój mental?") : (t("reportMental") || "Mental")}
          value={form.mental}
          onChange={(v) => setField("mental", v)}
        />
        {(type === "monthly" || type === "quarterly" || type === "yearly") && (
          <TextRow
            label={t("reportProgress") || "Największy progres"}
            value={form.progress}
            onChange={(v) => setField("progress", v)}
          />
        )}
        {type === "yearly" && (
          <TextRow
            label={t("reportTradingChanges") || "Co zmieniło się w moim tradingu?"}
            value={form.trading_changes}
            onChange={(v) => setField("trading_changes", v)}
          />
        )}
        <TextRow
          label={`🎯 ${t("reportKeyLesson") || "Najważniejsza lekcja"}`}
          value={form.key_lesson}
          onChange={(v) => setField("key_lesson", v)}
          highlight
        />
        <TextRow
          label={t("reportImproveNext") || "Co poprawić w następnym okresie?"}
          value={form.improve_next}
          onChange={(v) => setField("improve_next", v)}
        />
        <div className="px-4 py-3">
          <RatingPicker value={form.rating} onChange={(n) => setField("rating", n)} label={ratingLabel} />
        </div>
        <div className="px-4 py-3 space-y-2">
          <p className="text-[12px] font-semibold text-foreground/80">
            {t("reportScreenshots") || "Screeny"}
          </p>
          <ReportScreenshots
            userId={userId}
            images={form.screenshots}
            onChange={(next) => setField("screenshots", next)}
            t={t}
          />
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pb-4">
        <Button type="button" variant="outline" className="rounded-lg h-10" onClick={onCancel} disabled={saving}>
          {t("cancel") || "Anuluj"}
        </Button>
        <Button type="button" variant="secondary" className="rounded-lg h-10" disabled={saving} onClick={() => onSubmit(buildPayload("draft"))}>
          {t("reportSaveDraft") || "Zapisz jako szkic"}
        </Button>
        <Button type="button" className="cyber-primary-btn rounded-lg h-10" disabled={saving} onClick={() => onSubmit(buildPayload("published"))}>
          {t("reportPublish") || "Opublikuj raport"}
        </Button>
      </div>
    </div>
  );
}
