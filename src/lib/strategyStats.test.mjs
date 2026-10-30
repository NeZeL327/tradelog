// Run: node --test src/lib/strategyStats.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis.window || { self: {}, top: {} };

const bundled = await build({
  entryPoints: [path.join(srcDir, "lib/strategyStats.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  alias: { "@": srcDir },
  logLevel: "silent",
});
const s = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const trade = (id, strategy, pl, time = "10:00", extra = {}) => ({
  id, strategy_id: strategy, date: "2026-10-01", entry_time: time, status: "Closed", profit_loss: pl,
  outcome: pl > 0 ? "Win" : pl < 0 ? "Loss" : "Breakeven", ...extra,
});
const minutes = (t) => {
  const m = String(t.entry_time || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

test("podsumowanie: brak danych = null, bez dzielenia przez zero", () => {
  const empty = s.summarizeTrades([]);
  assert.deepEqual(empty, { trades: 0, netPL: 0, winRate: null, expectancy: null, profitFactor: null, grossProfit: 0 });
  const one = s.summarizeTrades([trade(1, "a", 50)]);
  assert.equal(one.winRate, 100);
  assert.equal(one.expectancy, 50);
  assert.equal(one.profitFactor, null); // brak strat
  assert.equal(one.grossProfit, 50);
});

test("porównanie strategii, PF, najlepsza godzina (min. 2 transakcje)", () => {
  const trades = [
    trade(1, "a", 100, "09:10"),
    trade(2, "a", 50, "09:40"),
    trade(3, "a", -60, "14:00"),
    trade(4, "a", 300, "16:00"), // jedna transakcja o 16 — za mało do "najlepszej godziny"
    trade(5, "b", -20, "11:00"),
  ];
  const rows = s.strategyComparison([{ id: "a", name: "Breakout" }, { id: "b", name: "Pullback" }, { id: "c", name: "Pusta" }], trades, minutes);
  const a = rows.find((r) => r.id === "a");
  assert.equal(a.trades, 4);
  assert.equal(a.netPL, 390);
  assert.equal(a.winRate, 75);
  assert.equal(a.expectancy, 97.5);
  assert.equal(a.profitFactor, 7.5);
  assert.deepEqual(a.bestHour, { hour: 9, pl: 150, trades: 2 });
  const c = rows.find((r) => r.id === "c");
  assert.equal(c.trades, 0);
  assert.equal(c.bestHour, null);
  assert.equal(c.winRate, null);
});

test("sortowanie: null na końcu w obu kierunkach", () => {
  const rows = [{ name: "x", winRate: 50 }, { name: "y", winRate: null }, { name: "z", winRate: 70 }];
  assert.deepEqual(s.sortRows(rows, "winRate", "desc").map((r) => r.name), ["z", "x", "y"]);
  assert.deepEqual(s.sortRows(rows, "winRate", "asc").map((r) => r.name), ["x", "z", "y"]);
  assert.deepEqual(s.sortRows(rows, "name", "asc").map((r) => r.name), ["x", "y", "z"]);
});

test("reguły z tekstu: punktory, numeracja, puste linie", () => {
  assert.deepEqual(
    s.rulesFromText("- Trend na H4\n\n2) Wybicie z konsolidacji\n• SL za swing\n[ ] max 1% ryzyka\n   "),
    ["Trend na H4", "Wybicie z konsolidacji", "SL za swing", "max 1% ryzyka"]
  );
  assert.deepEqual(s.rulesFromText(""), []);
  assert.deepEqual(s.rulesFromText(null), []);
});

test("grupowanie wg symbolu i krzywa kapitału", () => {
  const trades = [
    trade(1, "a", 100, "10:00", { symbol: "EURUSD" }),
    trade(2, "a", -40, "09:00", { symbol: "EURUSD" }),
    trade(3, "a", 10, "11:00", { symbol: "XAUUSD" }),
    trade(4, "a", 5, "12:00", { symbol: "" }),
  ];
  const bySymbol = s.groupSummary(trades, (t) => t.symbol || null);
  assert.deepEqual(bySymbol.map((r) => [r.key, r.trades, r.netPL]), [["EURUSD", 2, 60], ["XAUUSD", 1, 10]]);
  const curve = s.strategyEquity(trades);
  assert.deepEqual(curve.map((p) => p.equity), [-40, 60, 70, 75]); // chronologicznie po godzinie
  assert.deepEqual(s.strategyEquity([]), []);
});
