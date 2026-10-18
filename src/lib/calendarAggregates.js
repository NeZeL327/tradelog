// Read-only aggregation for the Calendar page. Values come only from existing helpers
// (getTradeRealizedPL, tradeRealizedR) and are never written back.
import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, endOfYear, format, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import { getTradeRealizedPL, normalizeDirection, tradeRealizedR } from "@/lib/utils";

const WEEK = { weekStartsOn: 1 };

// Same day grouping as the Dashboard: stored "YYYY-MM-DD" wins, otherwise local date.
export function tradeDayKey(value) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : format(parsed, "yyyy-MM-dd");
}

export const dayKeyOf = (date) => format(date, "yyyy-MM-dd");
export const dateOfKey = (key) => new Date(`${key}T12:00:00`);

const asList = (value) => (Array.isArray(value) ? value : []);
export const tradeMistakes = (trade) => asList(trade?.mistakes).map((tag) => String(tag || "").trim()).filter(Boolean);
export const tradeTags = (trade) => [...tradeMistakes(trade), ...asList(trade?.psychology_tags).map((tag) => String(tag || "").trim()).filter(Boolean)];

export function emptyBucket() {
  return { trades: [], pl: 0, r: 0, rCount: 0, wins: 0, losses: 0, winPl: 0, lossPl: 0 };
}

function addTrade(bucket, trade) {
  const pl = getTradeRealizedPL(trade) ?? 0;
  const r = tradeRealizedR(trade);
  bucket.trades.push(trade);
  bucket.pl += pl;
  if (r != null && Number.isFinite(r)) {
    bucket.r += r;
    bucket.rCount += 1;
  }
  if (trade?.outcome === "Win") {
    bucket.wins += 1;
    bucket.winPl += pl;
  } else if (trade?.outcome === "Loss") {
    bucket.losses += 1;
    bucket.lossPl += pl;
  }
}

export function mergeBuckets(buckets) {
  return buckets.reduce((acc, bucket) => {
    if (!bucket) return acc;
    acc.trades.push(...bucket.trades);
    acc.pl += bucket.pl;
    acc.r += bucket.r;
    acc.rCount += bucket.rCount;
    acc.wins += bucket.wins;
    acc.losses += bucket.losses;
    acc.winPl += bucket.winPl;
    acc.lossPl += bucket.lossPl;
    return acc;
  }, emptyBucket());
}

// Same definitions as the Dashboard: win rate over decided trades, PF from Win/Loss sums.
export function winRate(bucket) {
  const decided = bucket.wins + bucket.losses;
  return decided ? (bucket.wins / decided) * 100 : null;
}

export function profitFactor(bucket) {
  if (Math.abs(bucket.lossPl) > 0) return bucket.winPl / Math.abs(bucket.lossPl);
  return bucket.winPl > 0 ? Infinity : null;
}

// filters: { account, strategy, session, side, tag } with "all" meaning no filter.
export function matchesFilters(trade, filters, strategyOf) {
  if (filters.account !== "all" && String(trade?.account_id) !== filters.account) return false;
  if (filters.strategy !== "all" && strategyOf(trade) !== filters.strategy) return false;
  if (filters.session !== "all" && String(trade?.session || "").trim() !== filters.session) return false;
  if (filters.side !== "all" && normalizeDirection(trade?.direction) !== filters.side) return false;
  if (filters.tag !== "all" && !tradeTags(trade).includes(filters.tag)) return false;
  return true;
}

// The single pass over trades: Map<"YYYY-MM-DD", bucket>.
export function buildDayIndex(trades) {
  const days = new Map();
  (trades || []).forEach((trade) => {
    const key = tradeDayKey(trade?.date);
    if (!key) return;
    if (!days.has(key)) days.set(key, emptyBucket());
    addTrade(days.get(key), trade);
  });
  return days;
}

function extremeDay(entries, pick) {
  return entries.reduce((best, entry) => (best == null || pick(entry.bucket.pl, best.bucket.pl) ? entry : best), null);
}

// Month grid: Mon–Sun weeks; out-of-month days carry no data so weeks add up to the month.
export function buildMonth(days, monthDate) {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const monthPrefix = format(start, "yyyy-MM");
  const weeks = [];
  let cursor = startOfWeek(start, WEEK);
  while (cursor <= end) {
    const cells = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(cursor, index);
      const key = dayKeyOf(date);
      const inMonth = key.startsWith(monthPrefix);
      return { key, date, inMonth, bucket: inMonth ? days.get(key) || null : null };
    });
    weeks.push({ key: cells[0].key, cells, bucket: mergeBuckets(cells.map((cell) => cell.bucket)) });
    cursor = addDays(cursor, 7);
  }
  const traded = weeks.flatMap((week) => week.cells).filter((cell) => cell.bucket?.trades.length);
  const bucket = mergeBuckets(traded.map((cell) => cell.bucket));
  let running = 0;
  return {
    key: monthPrefix,
    weeks,
    bucket,
    tradingDays: traded.length,
    best: traded.length ? extremeDay(traded, (a, b) => a > b) : null,
    worst: traded.length ? extremeDay(traded, (a, b) => a < b) : null,
    avgPerDay: traded.length ? bucket.pl / traded.length : null,
    equity: traded.map((cell) => (running += cell.bucket.pl)),
    maxAbsDay: Math.max(0, ...traded.map((cell) => Math.abs(cell.bucket.pl))),
    maxAbsWeek: Math.max(0, ...weeks.map((week) => Math.abs(week.bucket.pl))),
    weekendTrades: traded.some((cell) => [0, 6].includes(cell.date.getDay())),
  };
}

export function buildWeek(days, anchorDate) {
  const start = startOfWeek(anchorDate, WEEK);
  const cells = eachDayOfInterval({ start, end: endOfWeek(anchorDate, WEEK) }).map((date) => {
    const key = dayKeyOf(date);
    return { key, date, inMonth: true, bucket: days.get(key) || null };
  });
  return { key: cells[0].key, cells, bucket: mergeBuckets(cells.map((cell) => cell.bucket)) };
}

// Year heatmap: columns are Mon–Sun weeks covering the calendar year.
export function buildYear(days, year) {
  const first = startOfYear(new Date(year, 0, 1));
  const last = endOfYear(first);
  const columns = [];
  let cursor = startOfWeek(first, WEEK);
  while (cursor <= last) {
    columns.push(Array.from({ length: 7 }, (_, index) => {
      const date = addDays(cursor, index);
      const key = dayKeyOf(date);
      const inYear = date.getFullYear() === year;
      return { key, date, inYear, bucket: inYear ? days.get(key) || null : null };
    }));
    cursor = addDays(cursor, 7);
  }
  const traded = columns.flat().filter((cell) => cell.bucket?.trades.length);
  return {
    columns,
    bucket: mergeBuckets(traded.map((cell) => cell.bucket)),
    tradingDays: traded.length,
    maxAbsDay: Math.max(0, ...traded.map((cell) => Math.abs(cell.bucket.pl))),
  };
}

// Insights from real data only; each value is null when there is not enough data.
export function buildInsights(days, month) {
  const traded = month.weeks.flatMap((week) => week.cells).filter((cell) => cell.bucket?.trades.length);
  const byWeekday = new Map();
  traded.forEach((cell) => {
    const weekday = cell.date.getDay();
    byWeekday.set(weekday, mergeBuckets([byWeekday.get(weekday), cell.bucket]));
  });
  const weekdays = [...byWeekday.entries()].map(([weekday, bucket]) => ({ weekday, bucket }));
  const sorted = [...weekdays].sort((a, b) => b.bucket.pl - a.bucket.pl);

  const mistakeCounts = new Map();
  traded.forEach((cell) => cell.bucket.trades.forEach((trade) => {
    new Set(tradeMistakes(trade)).forEach((tag) => mistakeCounts.set(tag, (mistakeCounts.get(tag) || 0) + 1));
  }));
  const topMistake = [...mistakeCounts.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  return {
    bestWeekday: weekdays.length >= 2 ? sorted[0] : null,
    worstWeekday: weekdays.length >= 2 ? sorted[sorted.length - 1] : null,
    streak: currentDayStreak(days),
    topMistake: topMistake ? { tag: topMistake[0], count: topMistake[1] } : null,
  };
}

// Consecutive most recent trading days with the same P&L sign (a flat day ends the streak).
export function currentDayStreak(days) {
  const keys = [...days.keys()].filter((key) => days.get(key).trades.length).sort().reverse();
  const sign = keys.length ? Math.sign(days.get(keys[0]).pl) : 0;
  if (!sign) return null;
  let count = 0;
  for (const key of keys) {
    if (Math.sign(days.get(key).pl) !== sign) break;
    count += 1;
  }
  return { sign, count, since: keys[count - 1] };
}

// 0..1 heat strength relative to the period's largest absolute day.
export function heatLevel(value, maxAbs) {
  if (!value || !maxAbs) return 0;
  return Math.min(1, Math.abs(value) / maxAbs);
}
