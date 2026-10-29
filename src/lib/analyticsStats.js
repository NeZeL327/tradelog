// Czyste funkcje dla strony Analytics. Tylko czytają transakcje — nic nie zapisują.
import { getTradeRealizedPL } from "@/lib/utils";

const plOf = (trade) => getTradeRealizedPL(trade) ?? 0;

/** Klucz sortowania: data + godzina wejścia (HH:MM:SS z zerami). */
export const tradeChronoKey = (trade) => {
  const date = String(trade?.date || "").slice(0, 10);
  const raw = String(trade?.entry_time || trade?.open_time || trade?.time || "00:00:00");
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const hh = m ? String(Number(m[1])).padStart(2, "0") : "00";
  const mm = m ? m[2] : "00";
  const ss = m?.[3] || "00";
  return `${date}T${hh}:${mm}:${ss}`;
};

export const sortTradesChronoAsc = (list) =>
  [...(list || [])].sort((a, b) => tradeChronoKey(a).localeCompare(tradeChronoKey(b)));

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Najdłuższe serie wg pola outcome (Win / Loss). Breakeven przerywa obie serie.
 * Transakcje muszą być posortowane chronologicznie.
 */
export function longestStreaks(sortedTrades) {
  let win = 0;
  let loss = 0;
  let maxWin = 0;
  let maxLoss = 0;
  for (const trade of sortedTrades || []) {
    if (trade?.outcome === "Win") {
      win += 1;
      loss = 0;
    } else if (trade?.outcome === "Loss") {
      loss += 1;
      win = 0;
    } else {
      win = 0;
      loss = 0;
    }
    maxWin = Math.max(maxWin, win);
    maxLoss = Math.max(maxLoss, loss);
  }
  return { maxWinStreak: maxWin, maxLossStreak: maxLoss };
}

/**
 * Krzywa kapitału i obsunięcia. Punkt 0 to start (P&L = 0).
 * startBalance > 0 pozwala liczyć obsunięcie w % od szczytu salda.
 */
export function buildEquitySeries(sortedTrades, startBalance = 0) {
  const base = Number.isFinite(startBalance) && startBalance > 0 ? startBalance : 0;
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;
  const points = [{ trade: 0, date: "", equity: 0, drawdown: 0, drawdownPct: 0 }];
  (sortedTrades || []).forEach((trade, index) => {
    equity += plOf(trade);
    if (equity > peak) peak = equity;
    const drawdown = equity - peak;
    const peakBalance = base + peak;
    const drawdownPct = base > 0 && peakBalance > 0 ? (drawdown / peakBalance) * 100 : 0;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    if (drawdownPct < maxDrawdownPct) maxDrawdownPct = drawdownPct;
    points.push({
      trade: index + 1,
      date: String(trade?.date || "").slice(0, 10),
      equity: round2(equity),
      drawdown: round2(drawdown),
      drawdownPct: round2(drawdownPct),
    });
  });
  return {
    points,
    maxDrawdown: round2(maxDrawdown),
    maxDrawdownPct: base > 0 ? round2(maxDrawdownPct) : null,
  };
}

/**
 * Wskaźniki paska KPI. Win rate z rozstrzygniętych (Win / Loss) jak w reszcie Analytics.
 * Średnia wygrana / strata, profit factor i payoff liczone ze znaku P&L.
 */
export function computeAnalyticsKpis(trades, { startBalance = 0 } = {}) {
  const list = trades || [];
  const sorted = sortTradesChronoAsc(list);
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let winCount = 0;
  let lossCount = 0;
  let net = 0;

  for (const trade of list) {
    if (trade?.outcome === "Win") wins += 1;
    else if (trade?.outcome === "Loss") losses += 1;
    else if (trade?.outcome === "Breakeven") breakeven += 1;
    const pl = plOf(trade);
    net += pl;
    if (pl > 0) {
      grossProfit += pl;
      winCount += 1;
    } else if (pl < 0) {
      grossLoss += Math.abs(pl);
      lossCount += 1;
    }
  }

  const decided = wins + losses;
  const avgWin = winCount > 0 ? grossProfit / winCount : 0;
  const avgLoss = lossCount > 0 ? -grossLoss / lossCount : 0;
  const equity = buildEquitySeries(sorted, startBalance);

  return {
    trades: list.length,
    wins,
    losses,
    breakeven,
    netPL: round2(net),
    winRate: decided > 0 ? Number(((wins / decided) * 100).toFixed(1)) : 0,
    grossProfit: round2(grossProfit),
    grossLoss: round2(grossLoss),
    // null = brak strat (nieskończony PF) przy zyskach; 0 = brak danych.
    profitFactor: grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? null : 0,
    avgWin: round2(avgWin),
    avgLoss: round2(avgLoss),
    payoff: avgLoss < 0 && avgWin > 0 ? Number((avgWin / Math.abs(avgLoss)).toFixed(2)) : null,
    expectancy: list.length > 0 ? round2(net / list.length) : 0,
    maxDrawdown: equity.maxDrawdown,
    maxDrawdownPct: equity.maxDrawdownPct,
    ...longestStreaks(sorted),
  };
}

const pad2 = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const DATE_PRESETS = ["all", "7d", "30d", "month", "quarter", "year", "custom"];

/**
 * Zakres dat (YYYY-MM-DD, włącznie) dla presetu. "all" i "custom" zwracają pusty zakres;
 * dla "custom" zakres podaje użytkownik.
 */
export function dateRangeForPreset(preset, today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const to = toKey(d);
  if (preset === "7d" || preset === "30d") {
    const start = new Date(d);
    start.setDate(start.getDate() - (preset === "7d" ? 6 : 29));
    return { from: toKey(start), to };
  }
  if (preset === "month") return { from: toKey(new Date(d.getFullYear(), d.getMonth(), 1)), to };
  if (preset === "quarter") {
    return { from: toKey(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)), to };
  }
  if (preset === "year") return { from: toKey(new Date(d.getFullYear(), 0, 1)), to };
  return { from: "", to: "" };
}

/** Czy data transakcji mieści się w zakresie (puste granice = bez ograniczenia). */
export function tradeInDateRange(trade, range) {
  const from = range?.from || "";
  const to = range?.to || "";
  if (!from && !to) return true;
  const date = String(trade?.date || "").slice(0, 10);
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

/** Dzień tygodnia 0 = poniedziałek … 6 = niedziela, z daty YYYY-MM-DD (czas lokalny). */
export function weekdayIndex(dateStr) {
  const m = String(dateStr || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
  return (day + 6) % 7;
}

/** Wynik wg dnia tygodnia (pon–nd), zawsze 7 wierszy. */
export function weekdayStats(trades) {
  const rows = Array.from({ length: 7 }, (_, i) => ({ day: i, pl: 0, trades: 0, wins: 0, losses: 0 }));
  for (const trade of trades || []) {
    const i = weekdayIndex(trade?.date);
    if (i == null) continue;
    rows[i].pl += plOf(trade);
    rows[i].trades += 1;
    if (trade?.outcome === "Win") rows[i].wins += 1;
    if (trade?.outcome === "Loss") rows[i].losses += 1;
  }
  return rows.map((r) => ({
    ...r,
    pl: round2(r.pl),
    winRate: r.wins + r.losses > 0 ? Number(((r.wins / (r.wins + r.losses)) * 100).toFixed(1)) : 0,
  }));
}

/**
 * Mapa godzina × dzień tygodnia. getMinutes(trade) zwraca minutę dnia wejścia albo null
 * (strona podaje getTradeEntryMinutes, żeby godziny zgadzały się z wykresem godzinowym).
 */
export function hourWeekdayHeatmap(trades, getMinutes) {
  const cells = new Map();
  let maxAbs = 0;
  for (const trade of trades || []) {
    const day = weekdayIndex(trade?.date);
    const mins = getMinutes(trade);
    if (day == null || mins == null) continue;
    const hour = Math.floor(mins / 60);
    const key = `${day}-${hour}`;
    const cell = cells.get(key) || { day, hour, pl: 0, trades: 0 };
    cell.pl += plOf(trade);
    cell.trades += 1;
    cells.set(key, cell);
  }
  const list = [...cells.values()].map((c) => ({ ...c, pl: round2(c.pl) }));
  list.forEach((c) => { maxAbs = Math.max(maxAbs, Math.abs(c.pl)); });
  // Ciągły zakres godzin od pierwszej do ostatniej z danymi, żeby siatka nie miała dziur.
  const used = list.map((c) => c.hour);
  const hours = used.length
    ? Array.from({ length: Math.max(...used) - Math.min(...used) + 1 }, (_, i) => Math.min(...used) + i)
    : [];
  return { cells: list, hours, maxAbs };
}
