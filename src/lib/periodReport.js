// Raport okresowy (tydzień / miesiąc / kwartał / rok) liczony wyłącznie z zapisanych transakcji.
// Tylko odczyt; korzysta z istniejących funkcji (granice okresów z reports.js, wskaźniki z analyticsStats).
import { getIsoWeek, getIsoWeekRange, monthBounds, quarterBounds, tradesInPeriod, yearBounds } from "@/lib/reports";
import { computeAnalyticsKpis, sessionOfInstant } from "@/lib/analyticsStats";
import { dailyResults } from "@/lib/propRules";
import { groupSummary } from "@/lib/strategyStats";

export const PERIOD_KINDS = ["week", "month", "quarter", "year"];

const pad2 = (n) => String(n).padStart(2, "0");
const keyOf = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** Okres zawierający datę `anchor`: { kind, start, end, year, index } (start/end YYYY-MM-DD, włącznie). */
export function periodRange(kind, anchor = new Date()) {
  const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const year = date.getFullYear();
  if (kind === "week") {
    const week = getIsoWeek(date);
    // Tydzień ISO może należeć do sąsiedniego roku (np. 1.01 w tygodniu 53).
    const isoYear = week >= 52 && date.getMonth() === 0 ? year - 1 : week === 1 && date.getMonth() === 11 ? year + 1 : year;
    return { kind, year: isoYear, index: week, ...getIsoWeekRange(isoYear, week) };
  }
  if (kind === "quarter") {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return { kind, year, index: quarter, ...quarterBounds(year, quarter) };
  }
  if (kind === "year") return { kind, year, index: 1, ...yearBounds(year) };
  const month = date.getMonth() + 1;
  return { kind: "month", year, index: month, ...monthBounds(year, month) };
}

/** Okres poprzedni (dir = -1) albo następny (dir = 1) względem okresu `range`. */
export function shiftPeriod(range, dir) {
  const [y, m, d] = (dir < 0 ? range.start : range.end).split("-").map(Number);
  const edge = new Date(y, m - 1, d);
  edge.setDate(edge.getDate() + (dir < 0 ? -1 : 1));
  return periodRange(range.kind, edge);
}

/**
 * Raport za okres. trades: wszystkie transakcje (filtr: zamknięte w [start, end]).
 * getInstant(trade) → Date wejścia (do sesji); strategies: [{id, name}]; startBalance do % obsunięcia.
 * Brak transakcji: kpis z zerami, ale pola "best/worst" = null — UI pokazuje "—".
 */
export function buildPeriodReport(trades, range, { getInstant = () => null, strategies = [], startBalance = 0 } = {}) {
  const list = tradesInPeriod(trades, range.start, range.end);
  const kpis = computeAnalyticsKpis(list, { startBalance });
  const days = dailyResults(list);
  let running = 0;
  const equity = days.map((day) => ({ key: day.key, pl: day.pl, equity: Math.round((running += day.pl) * 100) / 100 }));
  const best = days.reduce((top, day) => (top == null || day.pl > top.pl ? day : top), null);
  const worst = days.reduce((low, day) => (low == null || day.pl < low.pl ? day : low), null);
  const names = new Map((strategies || []).map((strategy) => [String(strategy.id), strategy.name]));
  const byStrategy = groupSummary(list, (trade) => (trade?.strategy_id ? String(trade.strategy_id) : "none"))
    .map((row) => ({ ...row, name: row.key === "none" ? null : names.get(row.key) || null }));
  const bySession = groupSummary(list, (trade) => sessionOfInstant(getInstant(trade)));
  return {
    range,
    trades: list.length,
    tradingDays: days.length,
    kpis,
    equity,
    bestDay: best && best.pl > 0 ? best : null,
    worstDay: worst && worst.pl < 0 ? worst : null,
    byStrategy,
    bySession,
  };
}

/** Etykieta okresu: "Tydzień 44 · 26.10–01.11.2026", "Październik 2026", "Q4 2026", "2026". */
export function periodLabel(range, { months = [], weekWord = "Tydzień" } = {}) {
  const dm = (key) => key.slice(8, 10) + "." + key.slice(5, 7);
  if (range.kind === "week") return `${weekWord} ${range.index} · ${dm(range.start)}–${dm(range.end)}.${range.end.slice(0, 4)}`;
  if (range.kind === "quarter") return `Q${range.index} ${range.year}`;
  if (range.kind === "year") return String(range.year);
  return `${months[range.index - 1] || pad2(range.index)} ${range.year}`;
}

/** Czy okres kończy się w przyszłości względem `today` (do blokady strzałki "dalej"). */
export const periodIncludesFuture = (range, today = new Date()) => range.end > keyOf(today);
