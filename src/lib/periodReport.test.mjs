// Run: node --test src/lib/periodReport.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis.window || { self: {}, top: {} };

const bundled = await build({
  entryPoints: [path.join(srcDir, "lib/periodReport.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  alias: { "@": srcDir },
  logLevel: "silent",
});
const r = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const trade = (id, date, pl, extra = {}) => ({
  id, date, status: "Closed", profit_loss: pl, account_id: "a1",
  outcome: pl > 0 ? "Win" : pl < 0 ? "Loss" : "Breakeven", ...extra,
});

test("granice okresów i przesuwanie", () => {
  const d = new Date(2026, 9, 30); // czw. 30.10.2026
  assert.deepEqual(r.periodRange("week", d), { kind: "week", year: 2026, index: 44, start: "2026-10-26", end: "2026-11-01" });
  assert.deepEqual(r.periodRange("month", d), { kind: "month", year: 2026, index: 10, start: "2026-10-01", end: "2026-10-31" });
  assert.deepEqual(r.periodRange("quarter", d), { kind: "quarter", year: 2026, index: 4, start: "2026-10-01", end: "2026-12-31" });
  assert.deepEqual(r.periodRange("year", d), { kind: "year", year: 2026, index: 1, start: "2026-01-01", end: "2026-12-31" });
  assert.equal(r.shiftPeriod(r.periodRange("month", d), -1).start, "2026-09-01");
  assert.equal(r.shiftPeriod(r.periodRange("week", d), 1).start, "2026-11-02");
  assert.equal(r.shiftPeriod(r.periodRange("quarter", d), -1).index, 3);
  // tydzień przełomu roku: 1.01.2027 (pt) należy do tygodnia 53 roku 2026
  const edge = r.periodRange("week", new Date(2027, 0, 1));
  assert.equal(edge.year, 2026);
  assert.equal(edge.index, 53);
  assert.equal(edge.start, "2026-12-28");
});

test("raport: brak transakcji = puste listy i null dla dni", () => {
  const rep = r.buildPeriodReport([], r.periodRange("month", new Date(2026, 9, 1)));
  assert.equal(rep.trades, 0);
  assert.equal(rep.bestDay, null);
  assert.equal(rep.worstDay, null);
  assert.deepEqual(rep.equity, []);
  assert.deepEqual(rep.byStrategy, []);
  assert.equal(rep.kpis.winRate, 0);
});

test("raport miesiąca: tylko zamknięte w okresie, dni, strategie, sesje", () => {
  const trades = [
    trade(1, "2026-09-30", 999), // poza okresem
    trade(2, "2026-10-02", 200, { strategy_id: "s1", at: "2026-10-02T14:00:00Z" }),
    trade(3, "2026-10-02", -50, { strategy_id: "s1", at: "2026-10-02T10:00:00Z" }),
    trade(4, "2026-10-05", -120, { at: null }),
    trade(5, "2026-10-06", 70, { status: "Open" }), // otwarta
  ];
  const rep = r.buildPeriodReport(trades, r.periodRange("month", new Date(2026, 9, 15)), {
    getInstant: (t) => (t.at ? new Date(t.at) : null),
    strategies: [{ id: "s1", name: "Breakout" }],
    startBalance: 10000,
  });
  assert.equal(rep.trades, 3);
  assert.equal(rep.tradingDays, 2);
  assert.equal(rep.kpis.netPL, 30);
  assert.deepEqual(rep.bestDay, { key: "2026-10-02", pl: 150 });
  assert.deepEqual(rep.worstDay, { key: "2026-10-05", pl: -120 });
  assert.deepEqual(rep.equity.map((p) => p.equity), [150, 30]);
  const s1 = rep.byStrategy.find((row) => row.key === "s1");
  assert.equal(s1.name, "Breakout");
  assert.equal(s1.netPL, 150);
  const none = rep.byStrategy.find((row) => row.key === "none");
  assert.equal(none.name, null);
  assert.deepEqual(rep.bySession.map((row) => row.key).sort(), ["london", "ny"]);
});

test("etykiety okresów", () => {
  const d = new Date(2026, 9, 30);
  assert.equal(r.periodLabel(r.periodRange("week", d)), "Tydzień 44 · 26.10–01.11.2026");
  assert.equal(r.periodLabel(r.periodRange("month", d), { months: ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"] }), "Paź 2026");
  assert.equal(r.periodLabel(r.periodRange("quarter", d)), "Q4 2026");
  assert.equal(r.periodLabel(r.periodRange("year", d)), "2026");
  assert.equal(r.periodIncludesFuture(r.periodRange("month", d), d), true);
  assert.equal(r.periodIncludesFuture(r.periodRange("month", new Date(2026, 8, 3)), d), false);
});

test("notatka okresu: pola zgodne ze starym modułem, wyszukiwanie dokumentu", () => {
  const month = r.periodRange("month", new Date(2026, 9, 30));
  assert.deepEqual(r.periodNotePayload(month, { note: "Dobry miesiąc", conclusions: "Mniej transakcji w piątki" }), {
    report_type: "monthly", year: 2026, month: 10, period_start: "2026-10-01", period_end: "2026-10-31", sort_date: "2026-10-01",
    reflection: "Dobry miesiąc", key_lesson: "Mniej transakcji w piątki",
  });
  const week = r.periodRange("week", new Date(2026, 9, 30));
  assert.equal(r.reportPeriodFields(week).week_number, 44);
  assert.equal(r.reportPeriodFields(week).report_type, "weekly");
  const reports = [
    { id: "x", report_type: "weekly", period_start: "2026-10-01" },
    { id: "y", report_type: "monthly", period_start: "2026-10-01", reflection: "stara" },
  ];
  assert.equal(r.findPeriodReport(reports, month)?.id, "y");
  assert.equal(r.findPeriodReport(reports, week), null);
  assert.equal(r.findPeriodReport([], month), null);
});
