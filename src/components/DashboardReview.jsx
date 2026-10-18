import { lazy, Suspense } from "react";
import { format, isSameMonth, isToday } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { directionLabel, getTradeMoneyRisk, getTradeRealizedPL, tradeRealizedR } from "@/lib/utils";
import { formatTradeClock } from "@/lib/userSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { createPageUrl } from "@/utils";
import {
  AsideHeading,
  DayFindings,
  JournalPreview,
  DayShell,
  DayStatsSection,
  DayStripRow,
  DaySummary,
  INK,
  LINE,
  MUTED,
  NEST_BG,
  NestPanel,
  ReviewAside,
  TradesSection,
  buildTagFindings,
  dayEquityValues,
  disciplineColumns,
  sessionDisciplineMetric,
  sessionRows,
  tagEntries,
  tone,
  tradeCountLabel as countLabel,
} from "@/components/DayReview";

const DashboardEquitySpark = lazy(() => import("@/components/DashboardEquitySpark"));

const RANGES = [
  { id: "7d", pl: "7 dni", en: "7 days" },
  { id: "30d", pl: "30 dni", en: "30 days" },
  { id: "90d", pl: "90 dni", en: "90 days" },
  { id: "all", pl: "Wszystko", en: "All" },
];

function sumPl(trades) {
  return trades.reduce((sum, trade) => sum + (getTradeRealizedPL(trade) ?? 0), 0);
}

function formatR(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}R`;
}

// The full "compared to previous N days" text stays available as a tooltip.
function shortCompareLabel(fullLabel, selectedMonth, range, plText) {
  if (!fullLabel) return "";
  if (selectedMonth) return plText ? "vs poprz. miesiąc" : "vs prev. month";
  const days = { "7d": 7, "30d": 30, "90d": 90 }[range];
  if (!days) return plText ? "vs poprz. okres" : "vs prev. period";
  return plText ? `vs poprz. ${days} dni` : `vs prev. ${days}d`;
}

// Percent mode without an account balance formats to "—"; the line is hidden instead of showing "— / —".
function grossHint(pnl, winSum, lossSum, plText) {
  const win = pnl.formatAmount(winSum);
  const loss = pnl.formatAmount(lossSum);
  if (win === "—" || loss === "—") return "";
  return `${plText ? "Brutto" : "Gross"}: ${win} / ${loss}`;
}

function netR(trades) {
  const values = trades.map(tradeRealizedR).filter((value) => value != null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

export default function DashboardReview({
  language,
  t,
  pnl,
  range,
  onRange,
  months,
  selectedMonth,
  onMonth,
  onClearMonth,
  metrics,
  equity,
  calendarDate,
  selectedDate,
  calendarDays,
  tradesByDate,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
  closedTrades,
  setups,
  bestTrade,
  worstTrade,
  onOpenTrade,
}) {
  const locale = language === "pl" ? pl : enUS;
  const plText = language === "pl";
  const trades = closedTrades || [];
  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const dayTrades = selectedKey ? (tradesByDate?.[selectedKey] || []) : [];
  const dayPl = sumPl(dayTrades);
  const dayR = netR(dayTrades);
  const dayWins = dayTrades.filter((trade) => trade.outcome === "Win").length;
  const dayLosses = dayTrades.filter((trade) => trade.outcome === "Loss").length;
  const dayWinSum = dayTrades.reduce((sum, trade) => sum + Math.max(getTradeRealizedPL(trade) ?? 0, 0), 0);
  const dayLossSum = dayTrades.reduce((sum, trade) => sum + Math.min(getTradeRealizedPL(trade) ?? 0, 0), 0);
  const dayFactor = Math.abs(dayLossSum) > 0 ? (dayWinSum / Math.abs(dayLossSum)).toFixed(2) : (dayWinSum > 0 ? "∞" : "0");
  const dayRate = dayTrades.length ? Math.round((dayWins / dayTrades.length) * 100) : null;
  const tableRows = [...(selectedKey ? dayTrades : trades)].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const dayNotes = dayTrades
    .map((trade) => ({ id: trade.id, symbol: trade.symbol, notes: String(trade.notes || "").trim() }))
    .filter((row) => row.notes);
  const dayTags = tagEntries(dayTrades);
  const sessions = sessionRows(dayTrades, getTradeRealizedPL);

  const monthDays = (calendarDays || []).filter((day) => isSameMonth(day, calendarDate));
  const daySums = new Map(monthDays.map((day) => {
    const list = tradesByDate?.[format(day, "yyyy-MM-dd")] || [];
    return [day, list.length ? sumPl(list) : null];
  }));
  const maxAbsDay = Math.max(0, ...[...daySums.values()].filter((value) => value != null).map(Math.abs));
  const stripDays = monthDays.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const list = tradesByDate?.[key] || [];
    const tags = tagEntries(list);
    const setup = list.find((trade) => trade.setup || trade.strategyName);
    const sum = daySums.get(day);
    return {
      key,
      date: day,
      label: `${format(day, "d MMMM", { locale })}${isToday(day) ? (plText ? " · dziś" : " · today") : ""}`,
      valueText: list.length ? pnl.formatTrades(list) : "—",
      valueColor: list.length ? tone(sum) : MUTED,
      countText: list.length ? countLabel(list.length, plText) : "",
      tag: tags[0]?.tag || setup?.setup || setup?.strategyName || "",
      tagKind: tags[0]?.kind,
      tagExtra: Math.max(0, tags.length - 1),
      barRatio: sum && maxAbsDay ? Math.abs(sum) / maxAbsDay : 0,
      barColor: tone(sum),
    };
  });

  const dayMetrics = [
    {
      label: "P&L",
      value: dayTrades.length ? pnl.formatTrades(dayTrades) : "—",
      color: dayTrades.length ? tone(dayPl) : MUTED,
      hint: dayTrades.length ? grossHint(pnl, dayWinSum, dayLossSum, plText) : (plText ? "Brak transakcji" : "No trades"),
      spark: dayEquityValues(dayTrades, (trade) => formatTradeClock(trade)),
    },
    { label: "Net R", value: formatR(dayR), color: dayR == null ? MUTED : tone(dayR), hint: dayR == null ? "" : `${plText ? "Śr." : "Avg."} ${formatR(dayR / Math.max(dayTrades.length, 1))}` },
    { label: plText ? "Liczba transakcji" : "Number of trades", value: String(dayTrades.length), color: INK, hint: dayTrades.length ? `${plText ? "Wygrane" : "Wins"}: ${dayWins} · ${plText ? "Straty" : "Losses"}: ${dayLosses}` : "", wl: { wins: dayWins, losses: dayLosses, total: dayTrades.length } },
    { label: plText ? "Skuteczność" : "Win rate", value: dayRate == null ? "—" : `${dayRate}%`, color: dayRate == null ? MUTED : INK, hint: dayRate == null ? "" : shortCompareLabel(metrics.periodCompareLabel, selectedMonth, range, plText), hintTitle: metrics.periodCompareLabel || "", progress: dayRate },
    { label: "Profit factor", value: dayTrades.length ? String(dayFactor) : "—", color: dayTrades.length ? INK : MUTED, hint: "" },    sessionDisciplineMetric(dayTrades, plText),
  ];

  const columns = [
    { key: "time", label: plText ? "Czas" : "Time", muted: true, render: (trade) => formatTradeClock(trade) || "—", sortValue: (trade) => formatTradeClock(trade) || null },
    { key: "symbol", label: "Symbol", render: (trade) => trade.symbol || "—" },
    { key: "side", label: plText ? "Kierunek" : "Side", render: (trade) => directionLabel(trade.direction, t) },
    { key: "setup", label: "Setup", render: (trade) => trade.setup || trade.strategyName || "—" },
    { key: "prices", label: "Entry → exit", align: "right", muted: true, render: (trade) => `${trade.entry_price ?? "—"} → ${trade.exit_price ?? "—"}` },
    { key: "risk", label: plText ? "Ryzyko" : "Risk", align: "right", muted: true, render: (trade) => { const risk = getTradeMoneyRisk(trade); return risk ? pnl.formatAmount(risk) : "—"; } },
    {
      key: "result",
      label: plText ? "Wynik" : "Result",
      align: "right",
      render: (trade) => <span style={{ color: tone(getTradeRealizedPL(trade) ?? 0) }}>{pnl.formatTrade(trade)}</span>,
    },
  ];

  const findingItems = dayTrades.map((trade) => {
    const value = getTradeRealizedPL(trade);
    const r = tradeRealizedR(trade);
    const risk = getTradeMoneyRisk(trade);
    const firstTag = tagEntries([trade])[0];
    const rows = [
      { label: plText ? "Wynik" : "Result", value: pnl.formatTrade(trade), color: tone(value ?? 0) },
      r != null ? { label: "R", value: formatR(r), color: tone(r) } : null,
      risk ? { label: plText ? "Ryzyko" : "Risk", value: pnl.formatAmount(risk) } : null,
      { label: plText ? "Wejście → wyjście" : "Entry → exit", value: `${trade.entry_price ?? "—"} → ${trade.exit_price ?? "—"}` },
      trade.session ? { label: plText ? "Sesja" : "Session", value: trade.session } : null,
      { label: plText ? "Godzina" : "Time", value: formatTradeClock(trade) || "—" },
    ].filter(Boolean);
    return {
      id: trade.id,
      title: `${trade.symbol || "—"} · ${directionLabel(trade.direction, t)}`,
      badge: firstTag?.tag,
      badgeKind: firstTag?.kind,
      note: String(trade.notes || "").trim(),
      rows,
      onOpen: () => onOpenTrade(trade),
      openLabel: plText ? "Otwórz transakcję" : "Open trade",
    };
  });

  const summaryText = dayTrades.length
    ? [
      `${countLabel(dayTrades.length, plText)}: ${dayWins}W · ${dayLosses}L, ${pnl.formatTrades(dayTrades)}.`,
      sessions.length ? `${plText ? "Sesje" : "Sessions"}: ${sessions.map((row) => `${row.name} (${row.count})`).join(", ")}.` : "",
      dayTags.length ? `${plText ? "Tagi" : "Tags"}: ${dayTags.length}.` : "",
    ].filter(Boolean).join(" ")
    : (plText ? "Brak transakcji w wybranym dniu." : "No trades on the selected day.");

  const reviewTab = (
    <DayFindings
      summaryTitle={plText ? "Podsumowanie sesji" : "Session summary"}
      summary={summaryText}
      tagsTitle={plText ? "Wnioski" : "Findings"}
      findings={buildTagFindings(dayTrades, pnl, plText)}
      findingsTitle={plText ? "Transakcje dnia" : "Day trades"}
      items={findingItems}
      emptyText={plText ? "Wybierz dzień z transakcjami na pasku powyżej." : "Pick a day with trades in the strip above."}
    />
  );

  const rangeTab = (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((item) => {
            const active = !selectedMonth && range === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onRange(item.id)}
                className="rounded-full px-3 py-1.5 text-[12px] transition-colors duration-200 hover:bg-ds-s3"
                style={{ background: active ? "var(--ds-s3)" : NEST_BG, border: `1px solid ${active ? "var(--ds-frame)" : LINE}`, color: active ? INK : MUTED }}
              >
                {plText ? item.pl : item.en}
              </button>
            );
          })}
        </div>
        <select
          value={selectedMonth || ""}
          onChange={(event) => (event.target.value ? onMonth(event.target.value) : onClearMonth())}
          className="h-9 w-full rounded-[10px] px-3 text-[13px] outline-none"
          style={{ background: NEST_BG, border: `1px solid ${LINE}`, color: INK }}
          aria-label={plText ? "Miesiąc" : "Month"}
        >
          <option value="">{plText ? "Wszystkie miesiące" : "All months"}</option>
          {(months || []).map((ym) => (
            <option key={ym} value={ym}>{format(new Date(`${ym}-01T00:00:00`), "LLLL yyyy", { locale })}</option>
          ))}
        </select>
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <AsideHeading>{plText ? "Krzywa zakresu" : "Range curve"}</AsideHeading>
          <span className="text-[12px]" style={{ color: trades.length ? tone(metrics.totalPL) : MUTED }}>{trades.length ? pnl.formatTrades(trades) : "—"}</span>
        </div>
        <p className="mt-1 text-[11px]" style={{ color: MUTED }}>
          {trades.length ? `${metrics.totalTrades} ${plText ? "zamkniętych" : "closed"} · ${metrics.winRate}% · PF ${metrics.profitFactor}` : (plText ? "Brak zamkniętych transakcji." : "No closed trades.")}
        </p>
        <div className="mt-2 h-[96px]">
          {equity?.length > 1 ? (
            <Suspense fallback={<Skeleton className="h-full w-full rounded-ds-sm" />}>
              <DashboardEquitySpark equity={equity} />
            </Suspense>
          ) : (
            <p className="pt-8 text-center text-[12px]" style={{ color: MUTED }}>{plText ? "Za mało dni, żeby narysować krzywą." : "Not enough days to draw the curve."}</p>
          )}
        </div>
      </div>
      <div>
        <AsideHeading>{plText ? "Setupy" : "Setups"}</AsideHeading>
        <div className="mt-2 overflow-hidden rounded-[12px]" style={{ background: NEST_BG, border: `1px solid ${LINE}` }}>
          {(setups || []).length === 0 ? (
            <p className="px-3 py-2 text-[12px]" style={{ color: MUTED }}>{plText ? "Brak setupów." : "No setups."}</p>
          ) : setups.slice(0, 5).map((row, index) => (
            <div key={row.name} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]" style={{ borderTop: index ? `1px solid ${LINE}` : "none" }}>
              <span className="truncate" style={{ color: MUTED }}>{row.name}</span>
              <span style={{ color: tone(row.pl) }}>{pnl.formatAmount(row.pl)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Extreme label={plText ? "Najlepsza" : "Best"} trade={bestTrade} pnl={pnl} t={t} onOpen={onOpenTrade} />
        <Extreme label={plText ? "Najgorsza" : "Worst"} trade={worstTrade} pnl={pnl} t={t} onOpen={onOpenTrade} />
      </div>
    </div>
  );

  const monthTab = (
    <MonthGrid
      calendarDate={calendarDate}
      calendarDays={calendarDays}
      tradesByDate={tradesByDate}
      selectedKey={selectedKey}
      onSelectDay={onSelectDay}
      onPrevMonth={onPrevMonth}
      onNextMonth={onNextMonth}
      pnl={pnl}
      plText={plText}
      locale={locale}
    />
  );

  return (
    <div className="text-foreground" style={{ fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums" }}>
      <DayShell>
        <DayStripRow
          title={format(calendarDate, "LLLL yyyy", { locale })}
          onPrev={onPrevMonth}
          onNext={onNextMonth}
          prevLabel={plText ? "Poprzedni miesiąc" : "Previous month"}
          nextLabel={plText ? "Następny miesiąc" : "Next month"}
          days={stripDays}
          selectedKey={selectedKey}
          onSelect={(day) => onSelectDay(day.date)}
          emptyText={plText ? "Brak dni w tym miesiącu." : "No days in this month."}
        />
        <div className="grid flex-1 items-stretch lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col">
            <DayStatsSection
              dayKey={selectedKey}
              title={plText ? "Statystyki dnia" : "Day stats"}
              action={(
                <Link to={createPageUrl("Analytics")} className="text-[12px] hover:underline" style={{ color: MUTED }}>
                  {plText ? "Pełne statystyki ↗" : "Open full stats ↗"}
                </Link>
              )}
              metrics={dayMetrics}
            >
              <NestPanel title={plText ? "Podsumowanie" : "Summary"}>
                <DaySummary
                  notes={dayNotes}
                  scoreLabel={plText ? "Wynik dnia" : "Day result"}
                  scoreValue={dayTrades.length ? `${dayWins}W · ${dayLosses}L` : ""}
                  tags={dayTags}
                  emptyText={dayTrades.length
                    ? (plText ? "Brak notatek dla tego dnia." : "No notes for this day.")
                    : (plText ? "Brak transakcji tego dnia." : "No trades this day.")}
                />
              </NestPanel>
              <NestPanel title={plText ? "Podgląd dziennika" : "Journal preview"}>
                <JournalPreview
                  rows={tableRows}
                  onOpenTrade={onOpenTrade}
                  describe={(trade) => ({
                    title: trade.symbol || "—",
                    meta: [directionLabel(trade.direction, t), formatTradeClock(trade)].filter(Boolean).join(" • "),
                    result: pnl.formatTrade(trade),
                    resultColor: tone(getTradeRealizedPL(trade) ?? 0),
                  })}
                  emptyText={plText ? "Brak transakcji do podglądu." : "No trades to preview."}
                  noShotsText={plText ? "Brak zrzutów ekranu dla tych transakcji." : "No screenshots for these trades."}
                  shotLabel={plText ? "Zrzut ekranu" : "Screenshot"}
                />
              </NestPanel>
            </DayStatsSection>
            <TradesSection
              title={plText ? "Transakcje" : "Trades"}
              rows={tableRows}
              columns={[...columns, ...disciplineColumns(tableRows, plText)]}
              minWidth={760}
              onOpen={onOpenTrade}
              empty={selectedKey
                ? (plText ? "Brak transakcji w wybranym dniu." : "No trades on the selected day.")
                : (plText ? "Brak zamkniętych transakcji w tym zakresie." : "No closed trades in this range.")}
            />
          </div>
          <ReviewAside
            tabs={[
              { id: "review", label: plText ? "Przegląd dnia" : "Day review", content: reviewTab },
              { id: "range", label: plText ? "Zakres" : "Range", content: rangeTab },
              { id: "month", label: plText ? "Miesiąc" : "Month", content: monthTab },
            ]}
          />
        </div>
      </DayShell>
    </div>
  );
}

function MonthGrid({ calendarDate, calendarDays, tradesByDate, selectedKey, onSelectDay, onPrevMonth, onNextMonth, pnl, plText, locale }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <AsideHeading className="capitalize">{format(calendarDate, "LLLL yyyy", { locale })}</AsideHeading>
        <div className="flex gap-0.5">
          <button type="button" className="rounded-[8px] p-1 transition-colors duration-200 hover:bg-ds-s3" style={{ color: MUTED }} onClick={onPrevMonth} aria-label={plText ? "Poprzedni miesiąc" : "Previous month"}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="rounded-[8px] p-1 transition-colors duration-200 hover:bg-ds-s3" style={{ color: MUTED }} onClick={onNextMonth} aria-label={plText ? "Następny miesiąc" : "Next month"}>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-[0.06em]" style={{ color: MUTED }}>
        {(plText ? ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"] : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]).map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {(calendarDays || []).map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const list = tradesByDate?.[key] || [];
          const selected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(day)}
              title={list.length ? pnl.formatTrades(list) : undefined}
              className="flex h-[34px] flex-col items-center justify-center rounded-[6px]"
              style={{
                background: selected ? "var(--ds-s3)" : list.length ? NEST_BG : "transparent",
                border: selected ? "1px solid var(--ds-frame)" : "1px solid transparent",
                opacity: isSameMonth(day, calendarDate) ? 1 : 0.35,
              }}
            >
              <span className="text-[11px]" style={{ color: selected ? INK : MUTED }}>{format(day, "d")}</span>
              {list.length ? <span className="mt-0.5 h-1 w-1 rounded-full" style={{ background: tone(sumPl(list)) }} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Extreme({ label, trade, pnl, t, onOpen }) {
  if (!trade) return null;
  const value = getTradeRealizedPL(trade) ?? 0;
  return (
    <button type="button" onClick={() => onOpen(trade)} className="block w-full rounded-[12px] p-3 text-left transition-colors duration-200 hover:bg-ds-s3" style={{ background: NEST_BG, border: `1px solid ${LINE}` }}>
      <p className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: MUTED }}>{label}</p>
      <p className="mt-1 truncate text-[12px]" style={{ color: INK }}>{trade.symbol} · {directionLabel(trade.direction, t)}</p>
      <p className="mt-0.5 text-[13px] font-medium" style={{ color: tone(value) }}>{pnl.formatTrade(trade)}</p>
    </button>
  );
}
