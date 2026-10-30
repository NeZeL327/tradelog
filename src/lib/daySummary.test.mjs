// Run: node --test src/lib/daySummary.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis.window || { self: {}, top: {} };

const bundled = await build({
  entryPoints: [path.join(srcDir, "lib/daySummary.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  alias: { "@": srcDir },
  logLevel: "silent",
});
const d = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const account = { id: "a1", initial_balance: 10000 };
const plan = {
  account_id: "a1",
  date: "2026-10-30",
  parameters: { trade_limit: 2, max_risk_percent: 1 },
  checklist: [{ done: true }, { done: true }, { done: false }],
};
const trade = (id, pl, extra = {}) => ({
  id, account_id: "a1", date: "2026-10-30", status: "Closed", profit_loss: pl,
  outcome: pl > 0 ? "Win" : pl < 0 ? "Loss" : "Breakeven", ...extra,
});

test("brak transakcji: wynik null, limit spełniony, checklista nie", () => {
  const s = d.daySessionSummary(plan, [], account);
  assert.equal(s.trades, 0);
  assert.equal(s.netPL, null);
  assert.equal(s.winRate, null);
  assert.equal(s.maxTakenRisk, null);
  assert.deepEqual(s.checks.map((c) => [c.id, c.ok]), [["tradeLimit", true], ["checklist", false]]);
  assert.equal(s.compliance, 0.5);
});

test("dzień z transakcjami: wynik, przekroczony limit i ryzyko", () => {
  const trades = [
    trade(1, 150, { stop_loss_amount: 100 }), // 1%
    trade(2, -80, { stop_loss_amount: 150 }), // 1.5% > 1%
    trade(3, 20, { stop_loss_amount: 50 }),
    trade(4, 999, { date: "2026-10-29" }), // inny dzień
    trade(5, 999, { account_id: "a2" }), // inne konto
  ];
  const s = d.daySessionSummary(plan, trades, account);
  assert.equal(s.trades, 3);
  assert.equal(s.netPL, 90);
  assert.equal(s.winRate, 66.7);
  assert.equal(s.maxTakenRisk, 1.5);
  assert.equal(s.overRiskCount, 1);
  const byId = Object.fromEntries(s.checks.map((c) => [c.id, c]));
  assert.equal(byId.tradeLimit.ok, false);
  assert.equal(byId.risk.ok, false);
  assert.equal(byId.checklist.value, 2);
  assert.equal(s.compliance, 0);
});

test("plan bez parametrów i konto bez kapitału: bez dzielenia przez zero", () => {
  const s = d.daySessionSummary({ account_id: "a1", date: "2026-10-30" }, [trade(1, 10, { stop_loss_amount: 100 })], { id: "a1" });
  assert.equal(s.tradeLimit, null);
  assert.equal(s.maxTakenRisk, null);
  assert.deepEqual(s.checks, []);
  assert.equal(s.compliance, null);
  assert.equal(s.netPL, 10);
  const none = d.daySessionSummary(null, null, null);
  assert.equal(none.trades, 0);
  assert.equal(none.compliance, null);
});
