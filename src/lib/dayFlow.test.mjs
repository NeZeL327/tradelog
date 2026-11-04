// Run: node --test src/lib/dayFlow.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis.window || { self: {}, top: {} };

async function load(entry) {
  const bundled = await build({
    entryPoints: [path.join(srcDir, entry)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    alias: { "@": srcDir },
    logLevel: "silent",
  });
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
}

const s = await load("lib/daySessions.js");
const d = await load("lib/dayFlow.js");

test("sesje w czasie polskim — zima (listopad)", () => {
  const [asia, london, nyam, nypm] = s.sessionsForDate("2026-11-04");
  assert.equal(asia.label, "01:00 – 09:00");
  assert.equal(london.label, "09:00 – 17:30");
  assert.equal(nyam.label, "14:30 – 17:00");
  assert.equal(nypm.label, "19:30 – 22:00");
  assert.equal(london.hint, "Kill zone 08:00 – 11:00");
  assert.equal(nyam.hint, "Kill zone 13:00 – 16:00");
  assert.equal(nypm.hint, "Power hour 21:00 – 22:00");
});

test("sesje w czasie polskim — lato i okres przejściowy", () => {
  const [, london, nyam, nypm] = s.sessionsForDate("2026-07-01");
  assert.equal(london.label, "09:00 – 17:30");
  assert.equal(nyam.label, "14:30 – 17:00");
  assert.equal(nypm.label, "19:30 – 22:00");
  // USA już na czasie letnim, Europa jeszcze nie → NY w PL godzinę wcześniej (USA od 8.03, UE od 29.03).
  const [, , nyamMarch] = s.sessionsForDate("2026-03-20");
  assert.equal(nyamMarch.label, "13:30 – 16:00");
});

test("wybór kilku sesji: stare dni, podsumowanie, bieżąca sesja", () => {
  assert.deepEqual(s.selectedSessionIds({ mapping_session: "ny" }), ["nyam"]);
  assert.deepEqual(s.selectedSessionIds({ sessions: ["nypm", "london", "xx"] }), ["london", "nypm"]);
  assert.deepEqual(s.selectedSessionIds({}), []);
  assert.equal(s.legacyMappingSession(["nypm"]), "ny");
  const sessions = s.sessionsForDate("2026-11-04");
  const sum = s.sessionsSummary(sessions, ["london", "nypm"]);
  assert.equal(sum.names, "Londyn + NY PM");
  assert.equal(sum.minutes, 11 * 60);
  assert.equal(sum.killZones, 2);
  assert.deepEqual(sum.gaps.map((g) => [s.hhmmOf(g.from), s.hhmmOf(g.to)]), [["17:30", "19:30"]]);
  // Londyn i NY AM nachodzą na siebie — bez podwójnego liczenia: 09:00–17:30 = 8,5 h
  assert.equal(s.sessionsSummary(sessions, ["london", "nyam"]).minutes, 8.5 * 60);
  assert.equal(s.currentOrNextSession(sessions, ["london", "nypm"], 18 * 60).id, "nypm");
  assert.equal(s.sessionOfMinute(sessions, 20 * 60, ["london", "nypm"]).id, "nypm");
  assert.equal(s.sessionOfMinute(sessions, 18 * 60, ["london", "nypm"]), null);
});

test("zasada AUTO: handel tylko w wybranych sesjach", () => {
  const sessions = s.sessionsForDate("2026-11-04");
  const views = d.dayTradesFor([trade("a", 100, { entry_time: "09:30" }), trade("b", 100, { entry_time: "20:15" })], "a1", "2026-11-04");
  const rule = (doc) => d.tradeChecks({ doc, views, balance: 100000, sessions }).find((c) => c.key === "window");
  assert.equal(rule({ sessions: ["london", "nypm"] }).ok, true);
  assert.equal(rule({ sessions: ["london", "nypm"] }).title, "Handel tylko w Twoich sesjach");
  assert.equal(rule({ sessions: ["london"] }).ok, false);
});

const trade = (id, pl, extra = {}) => ({
  id, account_id: "a1", date: "2026-11-04", status: "Closed", profit_loss: pl,
  outcome: pl > 0 ? "Win" : pl < 0 ? "Loss" : "Breakeven", ...extra,
});

test("statystyki dnia i krzywa", () => {
  const views = d.dayTradesFor([
    trade("t2", -512, { entry_time: "10:58", exit_time: "11:20", commission: -12 }),
    trade("t1", 786, { entry_time: "09:42", exit_time: "10:05", commission: -14 }),
    trade("x", 100, { account_id: "other", entry_time: "09:00" }),
  ], "a1", "2026-11-04");
  assert.deepEqual(views.map((v) => v.time), ["09:42", "10:58"]);
  const st = d.statsOf(views);
  assert.equal(st.n, 2);
  assert.equal(st.net, 274);
  assert.equal(st.fee, -26);
  assert.equal(st.w, 1);
  assert.equal(st.l, 1);
  assert.equal(st.wr, 50);
  assert.deepEqual(d.curvePoints(views).map((p) => p.value), [0, 786, 274]);
});

test("limit spada do 1 przy złym nastroju", () => {
  const doc = { parameters: { trade_limit: 3 }, mood_v2: { level: 1 } };
  assert.equal(d.effectiveTradeLimit(doc), 1);
  assert.equal(d.isLimitLowered(doc), true);
  assert.equal(d.effectiveTradeLimit({ parameters: { trade_limit: 3 }, mood_v2: { level: 3 } }), 3);
});

test("zasady w trakcie handlu i wynik za dyscyplinę", () => {
  const sessions = s.sessionsForDate("2026-11-04");
  const doc = {
    parameters: { trade_limit: 2, max_risk_percent: 0.5 },
    limits: { daily_stop_percent: 2 },
    mapping_session: "london",
    session_notes: [{ text: "x" }],
    rules_manual: { prep: { htf_bias: true, liquidity: true } },
  };
  const views = d.dayTradesFor([
    trade("t1", -500, { entry_time: "09:00", exit_time: "09:10" }),
    trade("t2", 300, { entry_time: "09:20", exit_time: "09:40" }),
  ], "a1", "2026-11-04");
  const checks = d.tradeChecks({ doc, views, balance: 100000, sessions });
  const byKey = Object.fromEntries(checks.map((c) => [c.key, c.ok]));
  assert.deepEqual(byKey, { limit: true, risk: true, stop: true, window: true, break: false, notes: true });
  const disc = d.disciplineOf({ doc, views, balance: 100000, sessions });
  assert.equal(disc.total, 15);
  assert.equal(disc.prep.done, 2);
  assert.equal(disc.trade.done, 5);
  assert.equal(disc.refl.done, 1); // tylko "zaimportowane"
  assert.equal(disc.score, Math.round((8 / 15) * 100));
});

test("plan: brakujące elementy i następny krok", () => {
  const pairs = ["EURUSD"];
  const doc = { mood_v2: { level: 2 }, mapping_session: "ny", bias_levels: { EURUSD: { bias: "long" } }, rules_manual: { prep: {} } };
  assert.deepEqual(d.planMissing(doc, pairs), ["zasady 0/5"]);
  assert.equal(d.nextStep(doc, pairs, []).action, "plan");
  const full = { ...doc, rules_manual: { prep: Object.fromEntries(d.PREP_RULES.map((r) => [r.key, true])) } };
  assert.equal(d.nextStep(full, pairs, []).action, "go1");
  assert.equal(d.nextStep({ ...full, flow_phase: 2 }, pairs, []).action, "import");
  assert.equal(d.nextStep({ ...full, status: "closed" }, pairs, []).disabled, true);
});

test("status rynku: kill zone, news, poza sesją", () => {
  const sessions = s.sessionsForDate("2026-11-04");
  const kz = d.marketStatus({ minutes: 9 * 60, sessions });
  assert.equal(kz.tone, "live");
  assert.match(kz.parts.map((p) => p.text).join(""), /Kill zone Londynu trwa/);
  const news = d.newsOfDay([{ time: "14:30", cur: "USD", name: "CPI m/m", impact: "high" }]);
  const warn = d.marketStatus({ minutes: 14 * 60 + 10, sessions, news });
  assert.equal(warn.tone, "warn");
  assert.match(warn.parts[0].text, /USD CPI m\/m za 20 min/);
  const late = d.marketStatus({ minutes: 23 * 60, sessions });
  assert.equal(late.parts[0].text, "Sesje na dziś zakończone");
});

test("seria zamkniętych dni pomija weekendy", () => {
  const plans = ["2026-10-29", "2026-10-30", "2026-11-02", "2026-11-03"].map((date) => ({ date, status: "closed" }));
  const map = new Map(plans.map((p) => [p.date, p]));
  assert.equal(d.closedStreak(map, "2026-11-04"), 4); // dziś jeszcze niezamknięty
  map.set("2026-11-04", { date: "2026-11-04", status: "closed" });
  assert.equal(d.closedStreak(map, "2026-11-04"), 5);
  assert.equal(d.bestStreak([...map.values()]), 5);
});

test("mapa ciepła: 60 komórek, dziś i przyszłość", () => {
  const map = new Map([["2026-11-03", { status: "closed", discipline_day: { score: 90 } }]]);
  const cells = d.heatmap(map, "2026-11-04");
  assert.equal(cells.length, 60);
  assert.equal(cells.find((c) => c.dateIso === "2026-11-04").kind, "now");
  assert.equal(cells.find((c) => c.dateIso === "2026-11-03").level, 4);
  assert.equal(cells.find((c) => c.dateIso === "2026-11-06").kind, "fut");
});

test("odznaki liczone z danych", () => {
  const plans = [{ date: "2026-11-03", status: "closed", account_id: "a1", day_tags: [], parameters: { trade_limit: 2 } }];
  const trades = [trade("t1", 100, { date: "2026-11-03", entry_time: "08:30" })];
  const b = Object.fromEntries(d.badgeProgress({ plans, trades, accountId: "a1" }).map((x) => [x.key, x.count]));
  assert.equal(b.sniper, 1);
  assert.equal(b.noOvertrade, 1);
  assert.equal(b.slSafe, 1);
  assert.equal(b.streak5, 1);
});
