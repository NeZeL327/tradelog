// Run: node --test src/lib/analyticsStats.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis.window || { self: {}, top: {} };

const bundled = await build({
  entryPoints: [path.join(srcDir, "lib/analyticsStats.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  alias: { "@": srcDir },
  logLevel: "silent",
});
const s = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const trade = (id, date, pl, extra = {}) => ({
  id,
  date,
  status: "Closed",
  profit_loss: pl,
  outcome: pl > 0 ? "Win" : pl < 0 ? "Loss" : "Breakeven",
  account_id: "a1",
  ...extra,
});

// Kolejność w tablicy celowo pomieszana — liczenie ma iść po dacie i godzinie.
const trades = [
  trade(3, "2026-10-02", -50, { entry_time: "09:00" }),
  trade(1, "2026-10-01", 100, { entry_time: "10:00" }),
  trade(2, "2026-10-01", 200, { entry_time: "15:30" }),
  trade(4, "2026-10-02", -150, { entry_time: "11:00" }),
  trade(5, "2026-10-03", 0, { entry_time: "09:15" }),
  trade(6, "2026-10-05", 100, { entry_time: "9:05" }),
];

test("KPI: wynik, win rate, PF, średnie, payoff, expectancy", () => {
  const k = s.computeAnalyticsKpis(trades);
  assert.equal(k.trades, 6);
  assert.equal(k.wins, 3);
  assert.equal(k.losses, 2);
  assert.equal(k.breakeven, 1);
  assert.equal(k.netPL, 200);
  assert.equal(k.winRate, 60);
  assert.equal(k.grossProfit, 400);
  assert.equal(k.grossLoss, 200);
  assert.equal(k.profitFactor, 2);
  assert.equal(k.avgWin, 133.33);
  assert.equal(k.avgLoss, -100);
  assert.equal(k.payoff, 1.33);
  assert.equal(k.expectancy, 33.33);
});

test("KPI: obsunięcie liczone chronologicznie, % od szczytu salda", () => {
  // Kapitał: 100, 300 (szczyt), 250, 100, 100, 200 → max DD = -200.
  const k = s.computeAnalyticsKpis(trades, { startBalance: 1000 });
  assert.equal(k.maxDrawdown, -200);
  assert.equal(k.maxDrawdownPct, -15.38);
  assert.equal(s.computeAnalyticsKpis(trades).maxDrawdownPct, null);
});

test("KPI: serie, BE przerywa serię", () => {
  const k = s.computeAnalyticsKpis(trades);
  assert.equal(k.maxWinStreak, 2);
  assert.equal(k.maxLossStreak, 2);
  const streak = s.longestStreaks([{ outcome: "Win" }, { outcome: "Breakeven" }, { outcome: "Win" }]);
  assert.deepEqual(streak, { maxWinStreak: 1, maxLossStreak: 0 });
});

test("KPI: brak strat i brak danych", () => {
  const onlyWins = s.computeAnalyticsKpis([trade(1, "2026-10-01", 50)]);
  assert.equal(onlyWins.profitFactor, null);
  assert.equal(onlyWins.payoff, null);
  const empty = s.computeAnalyticsKpis([]);
  assert.equal(empty.profitFactor, 0);
  assert.equal(empty.winRate, 0);
  assert.equal(empty.expectancy, 0);
  assert.equal(empty.maxDrawdown, 0);
});

test("krzywa kapitału: punkt startowy i daty w punktach", () => {
  const eq = s.buildEquitySeries(s.sortTradesChronoAsc(trades));
  assert.equal(eq.points.length, 7);
  assert.deepEqual(eq.points[0], { trade: 0, date: "", equity: 0, drawdown: 0, drawdownPct: 0 });
  assert.equal(eq.points[2].equity, 300);
  assert.equal(eq.points[4].drawdown, -200);
  assert.equal(eq.points[4].date, "2026-10-02");
});

test("zakresy dat presetów", () => {
  const today = new Date(2026, 9, 29); // 29.10.2026
  assert.deepEqual(s.dateRangeForPreset("7d", today), { from: "2026-10-23", to: "2026-10-29" });
  assert.deepEqual(s.dateRangeForPreset("30d", today), { from: "2026-09-30", to: "2026-10-29" });
  assert.deepEqual(s.dateRangeForPreset("month", today), { from: "2026-10-01", to: "2026-10-29" });
  assert.deepEqual(s.dateRangeForPreset("quarter", today), { from: "2026-10-01", to: "2026-10-29" });
  assert.deepEqual(s.dateRangeForPreset("year", today), { from: "2026-01-01", to: "2026-10-29" });
  assert.deepEqual(s.dateRangeForPreset("all", today), { from: "", to: "" });
});

test("filtr zakresu dat (włącznie, datetime w polu date)", () => {
  const range = { from: "2026-10-02", to: "2026-10-03" };
  assert.equal(s.tradeInDateRange({ date: "2026-10-02T09:00:00" }, range), true);
  assert.equal(s.tradeInDateRange({ date: "2026-10-03" }, range), true);
  assert.equal(s.tradeInDateRange({ date: "2026-10-04" }, range), false);
  assert.equal(s.tradeInDateRange({ date: "" }, range), false);
  assert.equal(s.tradeInDateRange({ date: "" }, { from: "", to: "" }), true);
  assert.equal(s.tradeInDateRange({ date: "2026-12-01" }, { from: "2026-10-02", to: "" }), true);
});

test("dzień tygodnia i mapa godzina × dzień", () => {
  assert.equal(s.weekdayIndex("2026-10-05"), 0); // poniedziałek
  assert.equal(s.weekdayIndex("2026-10-04"), 6); // niedziela
  const days = s.weekdayStats(trades);
  assert.equal(days.length, 7);
  assert.equal(days[3].pl, 300); // czwartek 01.10
  assert.equal(days[4].pl, -200); // piątek 02.10
  assert.equal(days[0].winRate, 100);

  const minutes = (t) => {
    const m = String(t.entry_time || "").match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const map = s.hourWeekdayHeatmap(trades, minutes);
  assert.deepEqual(map.hours, [9, 10, 11, 12, 13, 14, 15]);
  const fri9 = map.cells.find((c) => c.day === 4 && c.hour === 9);
  assert.deepEqual(fri9, { day: 4, hour: 9, pl: -50, trades: 1 });
  assert.equal(map.maxAbs, 200);
});
