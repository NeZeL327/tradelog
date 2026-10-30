// Statystyki strategii (Playbook). Czyste funkcje, tylko odczyt. Brak danych = null (UI pokazuje "—").
import { getTradeRealizedPL } from "@/lib/utils";

const plOf = (trade) => getTradeRealizedPL(trade) ?? 0;
const round2 = (n) => Math.round(n * 100) / 100;

/** Podsumowanie grupy transakcji: wynik, win rate (rozstrzygnięte), expectancy, profit factor. */
export function summarizeTrades(trades) {
  const list = trades || [];
  let net = 0;
  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  for (const trade of list) {
    const pl = plOf(trade);
    net += pl;
    if (pl > 0) grossProfit += pl;
    else if (pl < 0) grossLoss += -pl;
    if (trade?.outcome === "Win") wins += 1;
    else if (trade?.outcome === "Loss") losses += 1;
  }
  return {
    trades: list.length,
    netPL: round2(net),
    winRate: wins + losses > 0 ? Number(((wins / (wins + losses)) * 100).toFixed(1)) : null,
    expectancy: list.length ? round2(net / list.length) : null,
    // null = brak strat (PF nieskończony) albo brak danych; UI rozróżnia przez grossProfit.
    profitFactor: grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : null,
    grossProfit: round2(grossProfit),
  };
}

/** Godzina wejścia z najlepszym wynikiem (min. `minTrades` transakcji w godzinie); null gdy brak. */
export function bestEntryHour(trades, getMinutes, minTrades = 2) {
  const hours = new Map();
  for (const trade of trades || []) {
    const minutes = getMinutes(trade);
    if (minutes == null) continue;
    const hour = Math.floor(minutes / 60);
    const row = hours.get(hour) || { hour, pl: 0, trades: 0 };
    row.pl += plOf(trade);
    row.trades += 1;
    hours.set(hour, row);
  }
  let best = null;
  for (const row of hours.values()) {
    if (row.trades < minTrades) continue;
    if (!best || row.pl > best.pl) best = row;
  }
  return best ? { hour: best.hour, pl: round2(best.pl), trades: best.trades } : null;
}

/** Wiersze tabeli porównania strategii (transakcje już przefiltrowane: zamknięte, aktywne konta). */
export function strategyComparison(strategies, trades, getMinutes) {
  return (strategies || []).map((strategy) => {
    const own = (trades || []).filter((trade) => String(trade?.strategy_id) === String(strategy.id));
    return {
      id: strategy.id,
      name: strategy.name || "—",
      color: strategy.color || null,
      ...summarizeTrades(own),
      bestHour: bestEntryHour(own, getMinutes),
    };
  });
}

/** Sortowanie wierszy; wartości null zawsze na końcu, niezależnie od kierunku. */
export function sortRows(rows, key, dir = "desc") {
  const pick = (row) => (key === "bestHour" ? row.bestHour?.hour ?? null : row[key]);
  return [...(rows || [])].sort((a, b) => {
    const va = pick(a);
    const vb = pick(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const cmp = typeof va === "string" ? va.localeCompare(vb, "pl") : va - vb;
    return dir === "asc" ? cmp : -cmp;
  });
}

/** Reguły z pola tekstowego strategii: jedna reguła na linię, bez punktorów i numeracji. */
export function rulesFromText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•–]|\d+[.)]|\[[ xX]?\])\s*/, "").trim())
    .filter(Boolean);
}

/** Wyniki wg klucza (np. symbol, sesja); klucz null pomijany. Wiersze malejąco po liczbie transakcji. */
export function groupSummary(trades, keyOf) {
  const groups = new Map();
  for (const trade of trades || []) {
    const key = keyOf(trade);
    if (key == null || key === "") continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trade);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({ key, ...summarizeTrades(list) }))
    .sort((a, b) => b.trades - a.trades || b.netPL - a.netPL);
}

/** Krzywa kapitału strategii po transakcjach (chronologicznie po dacie i godzinie wejścia). */
export function strategyEquity(trades) {
  const key = (trade) => `${String(trade?.date || "").slice(0, 10)}T${String(trade?.entry_time || trade?.open_time || "00:00").padStart(5, "0")}`;
  let running = 0;
  return [...(trades || [])]
    .sort((a, b) => key(a).localeCompare(key(b)))
    .map((trade, index) => ({ n: index + 1, date: String(trade?.date || "").slice(0, 10), equity: round2((running += plOf(trade))) }));
}
