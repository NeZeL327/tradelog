// Run: node --test src/lib/calendarAggregates.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis.window || { self: {}, top: {} };

const bundled = await build({
  entryPoints: [path.join(srcDir, "lib/calendarAggregates.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  alias: { "@": srcDir },
  logLevel: "silent",
});
const agg = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const trade = (id, date, pl, extra = {}) => ({
  id,
  date,
  status: "Closed",
  profit_loss: pl,
  outcome: pl > 0 ? "Win" : pl < 0 ? "Loss" : "Breakeven",
  account_id: "a1",
  ...extra,
});

// 2026-09-30 (Wed) shares a grid week with October; it must not leak into October totals.
const trades = [
  trade(1, "2026-09-30", 500),
  trade(2, "2026-10-01", 100, { direction: "Long", mistakes: ["FOMO"] }),
  trade(3, "2026-10-01", -40, { direction: "Short", mistakes: ["FOMO", "Late entry"] }),
  trade(4, "2026-10-07", -60, { direction: "Long", session: "Londyn" }),
  trade(5, "2026-10-14", 30, { direction: "Long", account_id: "a2" }),
  trade(6, "2026-10-15T09:30:00", -20, { direction: "Short" }),
];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !== ${b}`);

test("month total equals the sum of weeks and of day cells, excluding out-of-month days", () => {
  const month = agg.buildMonth(agg.buildDayIndex(trades), new Date(2026, 9, 1));
  const cells = month.weeks.flatMap((week) => week.cells);
  close(month.bucket.pl, 10);
  close(month.weeks.reduce((sum, week) => sum + week.bucket.pl, 0), month.bucket.pl);
  close(cells.reduce((sum, cell) => sum + (cell.bucket?.pl || 0), 0), month.bucket.pl);
  assert.equal(month.bucket.trades.length, 5);
  assert.equal(month.tradingDays, 4);
  assert.equal(month.best.key, "2026-10-01");
  assert.equal(month.worst.key, "2026-10-07");
  assert.deepEqual(month.equity, [60, 0, 30, 10]);
});

test("win rate and profit factor follow the Dashboard definitions", () => {
  const month = agg.buildMonth(agg.buildDayIndex(trades), new Date(2026, 9, 1));
  close(agg.winRate(month.bucket), 40);
  close(agg.profitFactor(month.bucket), 130 / 120);
  assert.equal(agg.profitFactor(agg.emptyBucket()), null);
});

test("filters change every aggregate consistently", () => {
  const filters = { account: "all", strategy: "all", session: "all", side: "Long", tag: "all" };
  const filtered = trades.filter((item) => agg.matchesFilters(item, filters, () => ""));
  const month = agg.buildMonth(agg.buildDayIndex(filtered), new Date(2026, 9, 1));
  close(month.bucket.pl, 70);
  close(month.weeks.reduce((sum, week) => sum + week.bucket.pl, 0), 70);
  const byTag = trades.filter((item) => agg.matchesFilters(item, { ...filters, side: "all", tag: "FOMO" }, () => ""));
  assert.deepEqual(byTag.map((item) => item.id), [2, 3]);
});

test("insights use only real data and streaks stop at a sign change", () => {
  const days = agg.buildDayIndex(trades);
  const insights = agg.buildInsights(days, agg.buildMonth(days, new Date(2026, 9, 1)));
  assert.deepEqual(insights.topMistake, { tag: "FOMO", count: 2 });
  assert.equal(insights.streak.sign, -1);
  assert.equal(insights.streak.count, 1);
  assert.equal(insights.bestWeekday.weekday, 4);
  const empty = agg.buildInsights(new Map(), agg.buildMonth(new Map(), new Date(2026, 9, 1)));
  assert.equal(empty.bestWeekday, null);
  assert.equal(empty.streak, null);
  assert.equal(empty.topMistake, null);
});

test("year heatmap covers the whole year with in-year flags", () => {
  const year = agg.buildYear(agg.buildDayIndex(trades), 2026);
  const inYear = year.columns.flat().filter((cell) => cell.inYear);
  assert.equal(inYear.length, 365);
  close(year.bucket.pl, 510);
  assert.equal(year.tradingDays, 5);
});
