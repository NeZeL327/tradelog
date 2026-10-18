import { format } from "date-fns";
import Sparkline from "@/components/Sparkline";
import { tradeCountLabel } from "@/components/DayReview";
import { dateOfKey, profitFactor, winRate } from "@/lib/calendarAggregates";
import { GLASS, MICRO, NEG_TEXT, POS_TEXT, capFirst, glowOf, percent, toneOf } from "@/components/calendar/calendarUi";

const GLOW_COLORS = new Set([POS_TEXT, NEG_TEXT]);

function formatPf(value) {
  if (value == null) return "—";
  return Number.isFinite(value) ? value.toFixed(2) : "∞";
}

function Metric({ label, value, color, hint, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`min-w-0 px-4 py-3.5 text-left ${onClick ? "transition-colors duration-150 hover:bg-ds-s3" : ""}`}
      style={{ boxShadow: "-1px 0 0 var(--ds-line), 0 -1px 0 var(--ds-line)" }}
    >
      <p className={`truncate ${MICRO}`}>{label}</p>
      <p className="mt-2 truncate text-[18px] font-medium leading-none tabular-nums" style={{ color: color || "var(--ds-text)", textShadow: GLOW_COLORS.has(color) ? `0 0 18px color-mix(in srgb, ${color} 25%, transparent)` : undefined }}>
        {value}
      </p>
      <p className="mt-1.5 min-h-[15px] truncate text-[11px] text-ds-text3">{hint}</p>
    </Tag>
  );
}

// Day values in the active unit, in date order; days without a value (e.g. no R) are skipped.
function valuedDays(month, fmt) {
  return month.weeks.flatMap((week) => week.cells).filter((cell) => fmt.value(cell.bucket) != null);
}

// stacked: the inline day panel takes width, so equity sits above the metrics.
export function MonthSummary({ month, fmt, plText, locale, onPickDay, stacked }) {
  const days = valuedDays(month, fmt);
  let running = 0;
  const equity = days.map((cell) => (running += fmt.value(cell.bucket)));
  const ranked = [...days].sort((a, b) => fmt.value(b.bucket) - fmt.value(a.bucket));
  const best = ranked[0] && fmt.value(ranked[0].bucket) > 0 ? ranked[0] : null;
  const worst = ranked.length && fmt.value(ranked[ranked.length - 1].bucket) < 0 ? ranked[ranked.length - 1] : null;
  const avgPerDay = days.length ? equity[equity.length - 1] / days.length : null;
  const total = fmt.value(month.bucket);
  const rate = winRate(month.bucket);
  const dayLabel = (cell) => format(cell.date, "EEE d MMM", { locale });

  return (
    <section aria-label={plText ? "Podsumowanie miesiąca" : "Month summary"} className={`${GLASS} grid overflow-hidden ${stacked ? "" : "lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]"}`}>
      <div className="relative flex min-h-[132px] flex-col justify-between px-5 py-4">
        <div>
          <p className={MICRO}>{plText ? "Wynik miesiąca" : "Month result"}</p>
          <p className="mt-2 text-[28px] font-medium leading-none tracking-[-0.01em] tabular-nums" style={{ color: toneOf(total), textShadow: glowOf(total) }}>
            {fmt.text(month.bucket)}
          </p>
          <p className="mt-2 text-[11px] text-ds-text3">
            {month.bucket.trades.length ? tradeCountLabel(month.bucket.trades.length, plText) : (plText ? "Brak transakcji" : "No trades")}
          </p>
        </div>
        {equity.length >= 2 ? (
          <div className="mt-3" title={plText ? "Krzywa kapitału (narastająco po dniach)" : "Equity curve (cumulative by day)"}>
            <Sparkline values={equity} width={300} height={44} fill glow={false} />
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3">
        <Metric
          label={plText ? "Dni handlowe" : "Trading days"}
          value={month.tradingDays ? String(month.tradingDays) : "—"}
          hint={month.tradingDays ? tradeCountLabel(month.bucket.trades.length, plText) : ""}
        />
        <Metric
          label="Win rate"
          value={percent(rate)}
          hint={month.bucket.wins + month.bucket.losses ? `${month.bucket.wins}W · ${month.bucket.losses}L` : ""}
        />
        <Metric
          label="Profit factor"
          value={formatPf(profitFactor(month.bucket))}
          hint={plText ? "Zyski / |straty|" : "Gross win / |loss|"}
        />
        <Metric
          label={plText ? "Najlepszy dzień" : "Best day"}
          value={best ? fmt.text(best.bucket) : "—"}
          color={best ? POS_TEXT : undefined}
          hint={best ? dayLabel(best) : ""}
          onClick={best ? () => onPickDay(best.key) : undefined}
        />
        <Metric
          label={plText ? "Najgorszy dzień" : "Worst day"}
          value={worst ? fmt.text(worst.bucket) : "—"}
          color={worst ? NEG_TEXT : undefined}
          hint={worst ? dayLabel(worst) : ""}
          onClick={worst ? () => onPickDay(worst.key) : undefined}
        />
        <Metric
          label={plText ? "Średnio na dzień" : "Average per day"}
          value={fmt.amount(avgPerDay, month.bucket.trades)}
          color={avgPerDay ? toneOf(avgPerDay) : undefined}
          hint={days.length ? (plText ? `z ${days.length} dni` : `over ${days.length} days`) : ""}
        />
      </div>
    </section>
  );
}

function weekdayName(weekday, locale) {
  return capFirst(format(new Date(2024, 0, 7 + weekday), "EEEE", { locale }));
}

function streakText(streak, plText) {
  const won = streak.sign > 0;
  if (!plText) return `${streak.count} ${won ? "green" : "red"} day${streak.count === 1 ? "" : "s"} in a row`;
  const days = streak.count === 1 ? "dzień" : "dni";
  return `${streak.count} ${days} ${won ? "na plusie" : "na minusie"} z rzędu`;
}

function Insight({ label, value, detail, color }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 rounded-full border border-ds-line bg-ds-s2 px-3.5 py-1.5">
      <span className={`shrink-0 ${MICRO}`}>{label}</span>
      <span className="truncate text-[12.5px] font-medium text-ds-text">{value}</span>
      {detail ? <span className="shrink-0 text-[12px] tabular-nums" style={{ color: color || "var(--ds-text2)" }}>{detail}</span> : null}
    </div>
  );
}

// Insights rank by realized P&L; hidden individually when the data does not support them.
export function InsightsRow({ insights, pnl, plText, locale }) {
  const { bestWeekday, worstWeekday, streak, topMistake } = insights;
  const items = [];
  if (bestWeekday && bestWeekday.bucket.pl > 0) {
    items.push(<Insight key="best" label={plText ? "Najlepszy dzień tyg." : "Best weekday"} value={weekdayName(bestWeekday.weekday, locale)} detail={pnl.formatTrades(bestWeekday.bucket.trades)} color={POS_TEXT} />);
  }
  if (worstWeekday && worstWeekday.bucket.pl < 0) {
    items.push(<Insight key="worst" label={plText ? "Najsłabszy dzień tyg." : "Worst weekday"} value={weekdayName(worstWeekday.weekday, locale)} detail={pnl.formatTrades(worstWeekday.bucket.trades)} color={NEG_TEXT} />);
  }
  if (streak) {
    const won = streak.sign > 0;
    items.push(<Insight key="streak" label={plText ? "Seria" : "Streak"} value={streakText(streak, plText)} detail={`${won ? "+" : "−"} ${plText ? "od" : "since"} ${format(dateOfKey(streak.since), "d MMM", { locale })}`} color={won ? POS_TEXT : NEG_TEXT} />);
  }
  if (topMistake) {
    items.push(<Insight key="mistake" label={plText ? "Częsty błąd" : "Top mistake"} value={topMistake.tag} detail={`× ${topMistake.count}`} color="var(--ds-warn)" />);
  }
  if (!items.length) return null;
  return <div aria-label={plText ? "Szybkie wnioski" : "Quick insights"} className="flex flex-wrap gap-2">{items}</div>;
}
