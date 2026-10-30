// Run: node --test src/lib/propRules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis.window || { self: {}, top: {} };

const bundled = await build({
  entryPoints: [path.join(srcDir, "lib/propRules.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  alias: { "@": srcDir },
  logLevel: "silent",
});
const p = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const account = {
  id: "a1",
  initial_balance: 10000,
  max_daily_loss_percent: 5,
  max_account_loss: 10,
  profit_target: 1000,
};
const trade = (id, date, pl, extra = {}) => ({ id, date, status: "Closed", profit_loss: pl, account_id: "a1", ...extra });
const today = new Date(2026, 9, 30, 12); // 30.10.2026

test("brak transakcji: limity są, zużycie 0, krzywa tylko ze startem, brak dni", () => {
  const s = p.computePropStatus(account, [], { today });
  assert.equal(s.tradingDays, 0);
  assert.equal(s.netPL, 0);
  assert.equal(s.daily.limit, 500);
  assert.equal(s.daily.todayUsed, 0);
  assert.equal(s.daily.worstDay, null);
  assert.equal(s.total.remaining, 1000);
  assert.equal(s.total.used, 0);
  assert.equal(s.target.progress, 0);
  assert.equal(s.consistency.share, null);
  assert.deepEqual(s.curve, [{ key: "start", equity: 10000 }]);
});

test("brak kapitału lub limitów: null zamiast 0, bez dzielenia przez zero", () => {
  const s = p.computePropStatus({ id: "a1", initial_balance: 0, max_daily_loss_percent: 5 }, [trade(1, "2026-10-30", -100)], { today });
  assert.equal(s.initial, null);
  assert.equal(s.daily, null);
  assert.equal(s.total, null);
  assert.equal(s.equity, null);
  assert.equal(s.hasLimits, false);
  const noLimits = p.computePropStatus({ id: "a1", initial_balance: 5000 }, [], { today });
  assert.equal(noLimits.daily, null);
  assert.equal(noLimits.target, null);
});

test("jedna transakcja dziś: zużycie dzisiaj i najgorszy dzień", () => {
  const s = p.computePropStatus(account, [trade(1, "2026-10-30T09:15:00", -200)], { today });
  assert.equal(s.daily.todayLoss, 200);
  assert.equal(s.daily.todayUsed, 0.4);
  assert.deepEqual(s.daily.worstDay, { key: "2026-10-30", pl: -200 });
  assert.equal(p.limitTone(s.daily.todayUsed), "ok");
  assert.equal(s.tradingDays, 1);
});

test("wiele dni: najgorszy dzień, bufor łączny, cel i spójność", () => {
  const trades = [
    trade(1, "2026-10-27", 600),
    trade(2, "2026-10-28", -450),
    trade(3, "2026-10-28", -30),
    trade(4, "2026-10-29", 300),
    trade(5, "2026-10-30", 100),
    trade(6, "2026-10-30", 0, { status: "Open" }), // otwarta — nie liczy się
  ];
  const s = p.computePropStatus(account, trades, { today });
  assert.equal(s.netPL, 520);
  assert.equal(s.equity, 10520);
  assert.deepEqual(s.daily.worstDay, { key: "2026-10-28", pl: -480 });
  assert.equal(s.daily.worstUsed, 0.96);
  assert.equal(p.limitTone(s.daily.worstUsed), "danger");
  assert.equal(s.daily.todayUsed, 0);
  assert.equal(s.total.floor, 9000);
  assert.equal(s.total.remaining, 1520);
  assert.equal(s.total.remainingPct, 15.2);
  assert.equal(s.total.used, 0);
  assert.equal(s.target.progress, 0.52);
  assert.equal(s.target.remaining, 480);
  assert.deepEqual(s.consistency.bestDay, { key: "2026-10-27", pl: 600 });
  assert.equal(Math.round(s.consistency.share * 1000) / 1000, 1.154);
  assert.equal(s.tradingDays, 4);
  assert.equal(s.curve.at(-1).equity, 10520);
});

test("ujemny kapitał: bufor ujemny, zużycie > 100%, cel 0%", () => {
  const s = p.computePropStatus(account, [trade(1, "2026-10-20", -12000)], { today });
  assert.equal(s.equity, -2000);
  assert.equal(s.total.remaining, -11000);
  assert.equal(s.total.used, 12);
  assert.equal(p.limitTone(s.total.used), "danger");
  assert.equal(s.target.progress, 0);
  assert.equal(s.consistency.share, null);
});

test("wiele kont: liczy tylko transakcje tego konta", () => {
  const trades = [trade(1, "2026-10-30", -100), trade(2, "2026-10-30", -400, { account_id: "a2" })];
  const s = p.computePropStatus(account, trades, { today });
  assert.equal(s.daily.todayLoss, 100);
  assert.equal(s.tradingDays, 1);
});

test("progi koloru i daty z Firestore", () => {
  assert.equal(p.limitTone(0.7), "ok");
  assert.equal(p.limitTone(0.71), "warn");
  assert.equal(p.limitTone(0.91), "danger");
  assert.equal(p.limitTone(null), null);
  const s = p.computePropStatus(
    { ...account, updatedAt: { seconds: 1761800000 } },
    [trade(1, "2026-10-30", 10, { createdAt: "2026-10-30T10:00:00Z" })],
    { today }
  );
  assert.equal(s.lastChange.toISOString(), "2026-10-30T10:00:00.000Z");
});
