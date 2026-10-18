// Run: node --test src/lib/disciplineInsights.test.mjs
// esbuild (already installed with Vite) resolves the "@/" alias, so no test runner or config is needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis.window || { self: {}, top: {} };

const bundled = await build({
  entryPoints: [path.join(srcDir, "lib/disciplineInsights.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  alias: { "@": srcDir },
  logLevel: "silent",
});
const helper = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const { detectOvertradingAfterLoss, computeDisciplineScore, computeSessionDiscipline, DISCIPLINE_WEIGHTS } = helper;

const trade = (id, entry, exit, pl, extra = {}) => ({
  id,
  date: "2026-10-15",
  entry_time: entry,
  exit_time: exit,
  profit_loss: pl,
  ...extra,
});

test("flags entry within the window after a same-day loss", () => {
  const loss = trade("a", "10:00", "10:10", -50);
  const quick = trade("b", "10:20", "10:30", 20);
  const late = trade("c", "11:00", "11:10", 20);
  const flagged = detectOvertradingAfterLoss([loss, quick, late]);
  assert.deepEqual(flagged.get("b"), { lossTradeId: "a", minutesAfterLoss: 10 });
  assert.equal(flagged.has("c"), false);
  assert.equal(flagged.has("a"), false);
});

test("ignores losses on another day and trades without times", () => {
  const loss = trade("a", "10:00", "10:10", -50, { date: "2026-10-14" });
  const next = trade("b", "10:15", "10:30", 20);
  const noTime = trade("c", "", "", 20);
  const flagged = detectOvertradingAfterLoss([loss, next, noTime]);
  assert.equal(flagged.size, 0);
});

test("score is null when entry time is missing", () => {
  const result = computeDisciplineScore(trade("x", "", "", 10), []);
  assert.equal(result.score, null);
  assert.equal(result.reasons.length, 0);
});

test("clean trade scores 100 with no reasons", () => {
  const t = trade("x", "09:00", "09:10", 10);
  const result = computeDisciplineScore(t, [t]);
  assert.equal(result.score, 100);
  assert.deepEqual(result.reasons, []);
});

test("deductions are listed and capped", () => {
  const loss = trade("a", "10:00", "10:10", -50, { stop_loss_amount: 50 });
  const bad = trade("b", "10:12", "10:20", -80, {
    stop_loss_amount: 120,
    mistakes: ["FOMO", "Late entry", "No plan", "Revenge"],
  });
  const result = computeDisciplineScore(bad, [loss, bad]);
  const points = Object.fromEntries(result.reasons.map((r) => [r.code, r.points]));
  assert.equal(points.overtrading, -DISCIPLINE_WEIGHTS.overtradingAfterLoss);
  assert.equal(points.risk, -DISCIPLINE_WEIGHTS.riskAboveMedian);
  assert.equal(points.mistakes, -DISCIPLINE_WEIGHTS.maxMistakesPenalty);
  assert.equal(result.score, 100 - 25 - 15 - 30);
});

test("session summary averages scored trades only", () => {
  const loss = trade("a", "10:00", "10:10", -50);
  const quick = trade("b", "10:15", "10:30", 20);
  const noTime = trade("c", "", "", 5);
  const session = computeSessionDiscipline([loss, quick, noTime]);
  assert.deepEqual(session, { average: 88, min: 75, max: 100, scoredCount: 2, flaggedCount: 1 });
});

test("session summary is empty without scorable trades", () => {
  assert.deepEqual(computeSessionDiscipline([]), { average: null, min: null, max: null, scoredCount: 0, flaggedCount: 0 });
});
