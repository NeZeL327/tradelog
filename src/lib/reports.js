import { getTradeRealizedPL, isClosedTrade } from "@/lib/utils";

/** ISO week number (1–53) for a Date */
export function getIsoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/** Monday–Sunday range for ISO week */
export function getIsoWeekRange(year, week) {
  const y = Number(year);
  const w = Number(week);
  if (!y || !w) return { start: "", end: "" };
  const simple = new Date(y, 0, 1 + (w - 1) * 7);
  const dow = simple.getDay();
  const monday = new Date(simple);
  const diff = dow <= 4 ? 1 - dow : 8 - dow;
  monday.setDate(simple.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };
  return { start: fmt(monday), end: fmt(sunday) };
}

export function monthBounds(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return { start: "", end: "" };
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end };
}

export function quarterBounds(year, quarter) {
  const q = Number(quarter);
  const y = Number(year);
  if (!y || !q || q < 1 || q > 4) return { start: "", end: "" };
  const startMonth = (q - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  return {
    start: monthBounds(y, startMonth).start,
    end: monthBounds(y, endMonth).end,
  };
}

export function yearBounds(year) {
  const y = Number(year);
  if (!y) return { start: "", end: "" };
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

function toDateKey(value) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return "";
}

/** Closed trades in [start, end] inclusive */
export function tradesInPeriod(trades, start, end) {
  const s = toDateKey(start);
  const e = toDateKey(end);
  if (!s || !e) return [];
  return (trades || []).filter((t) => {
    if (!isClosedTrade(t)) return false;
    const key = toDateKey(t.date);
    return key && key >= s && key <= e;
  });
}

export function computeBasicStats(trades) {
  const list = trades || [];
  const wins = list.filter((t) => t.outcome === "Win").length;
  const losses = list.filter((t) => t.outcome === "Loss").length;
  const decided = wins + losses;
  return {
    trades_count: list.length,
    wins_count: wins,
    losses_count: losses,
    win_rate: decided > 0 ? Number(((wins / decided) * 100).toFixed(1)) : 0,
  };
}

/** Best/worst ISO week labels by sum P&L within period */
export function bestWorstWeeks(trades, start, end) {
  const inRange = tradesInPeriod(trades, start, end);
  const byWeek = {};
  inRange.forEach((t) => {
    const key = toDateKey(t.date);
    if (!key) return;
    const [y, m, d] = key.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const week = getIsoWeek(dt);
    const year = dt.getFullYear();
    const id = `${year}-W${String(week).padStart(2, "0")}`;
    if (!byWeek[id]) byWeek[id] = 0;
    byWeek[id] += getTradeRealizedPL(t) ?? 0;
  });
  const entries = Object.entries(byWeek);
  if (!entries.length) return { best_week: "", worst_week: "" };
  entries.sort((a, b) => b[1] - a[1]);
  const fmt = (id, pl) => `${id} (${pl >= 0 ? "+" : ""}${pl.toFixed(1)})`;
  return {
    best_week: fmt(entries[0][0], entries[0][1]),
    worst_week: fmt(entries[entries.length - 1][0], entries[entries.length - 1][1]),
  };
}

const MONTH_NAMES_PL = [
  "", "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

export function bestWorstMonths(trades, start, end) {
  const inRange = tradesInPeriod(trades, start, end);
  const byMonth = {};
  inRange.forEach((t) => {
    const key = toDateKey(t.date);
    if (!key) return;
    const ym = key.slice(0, 7);
    if (!byMonth[ym]) byMonth[ym] = 0;
    byMonth[ym] += getTradeRealizedPL(t) ?? 0;
  });
  const entries = Object.entries(byMonth);
  if (!entries.length) return { best_month: "", worst_month: "" };
  entries.sort((a, b) => b[1] - a[1]);
  const label = (ym, pl) => {
    const [y, m] = ym.split("-").map(Number);
    return `${MONTH_NAMES_PL[m] || m} ${y} (${pl >= 0 ? "+" : ""}${pl.toFixed(1)})`;
  };
  return {
    best_month: label(entries[0][0], entries[0][1]),
    worst_month: label(entries[entries.length - 1][0], entries[entries.length - 1][1]),
  };
}

export function bestWorstQuarters(trades, year) {
  const y = Number(year);
  if (!y) return { best_quarter: "", worst_quarter: "" };
  const scores = [1, 2, 3, 4].map((q) => {
    const { start, end } = quarterBounds(y, q);
    const list = tradesInPeriod(trades, start, end);
    const pl = list.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0);
    return { q, pl };
  });
  const withTrades = scores.filter((_, i) => {
    const { start, end } = quarterBounds(y, i + 1);
    return tradesInPeriod(trades, start, end).length > 0;
  });
  if (!withTrades.length) return { best_quarter: "", worst_quarter: "" };
  withTrades.sort((a, b) => b.pl - a.pl);
  const fmt = (row) => `Q${row.q} (${row.pl >= 0 ? "+" : ""}${row.pl.toFixed(1)})`;
  return {
    best_quarter: fmt(withTrades[0]),
    worst_quarter: fmt(withTrades[withTrades.length - 1]),
  };
}

export function reportPeriodLabel(report, language = "pl") {
  if (!report) return "";
  const type = report.report_type;
  if (type === "weekly" && report.period_start && report.period_end) {
    const a = String(report.period_start).split("-").reverse().join(".");
    const b = String(report.period_end).split("-").reverse().join(".");
    return `${a} – ${b}`;
  }
  if (type === "monthly" && report.year && report.month) {
    const names = language === "en"
      ? ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
      : MONTH_NAMES_PL;
    return `${names[Number(report.month)] || report.month} ${report.year}`;
  }
  if (type === "quarterly" && report.year && report.quarter) {
    return `Q${report.quarter} ${report.year}`;
  }
  if (type === "yearly" && report.year) {
    return String(report.year);
  }
  return report.period_start || "";
}

export function reportTypeLabel(type, t) {
  const map = {
    weekly: t("reportWeekly") || "Tygodniowy",
    monthly: t("reportMonthly") || "Miesięczny",
    quarterly: t("reportQuarterly") || "Kwartalny",
    yearly: t("reportYearly") || "Roczny",
  };
  return map[type] || type;
}
