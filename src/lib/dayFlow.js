// Logika nowej strony "Dzień" (przepływ Plan → Handel → Import → Przegląd).
// Tylko odczyt transakcji: P&L, R, wygrane/przegrane i overtrading liczone istniejącymi funkcjami
// (getTradeRealizedPL, tradeRealizedR, buildDayIndex, detectOvertradingAfterLoss).
// "Wynik dnia za dyscyplinę" to NOWA, osobna liczba dla dnia — nie zmienia ocen dyscypliny transakcji.
import { buildDayIndex, emptyBucket, mergeBuckets, profitFactor, tradeDayKey, winRate } from "@/lib/calendarAggregates";
import { detectOvertradingAfterLoss } from "@/lib/disciplineInsights";
import { getTradeRealizedPL, isClosedTrade, normalizeDirection, tradeRealizedR } from "@/lib/utils";
import { convertTradeDateTime } from "@/lib/userSettings";
import { sessionsForDate, tradingWindow, durationLabel, hhmmOf } from "@/lib/daySessions";

/* ------------------------------------------------------------------ słowniki */

export const MOODS = [
  { level: 0, label: "Bardzo źle", color: "#f2646a", mouth: "M9 16.5c1.6-1.6 4.4-1.6 6 0" },
  { level: 1, label: "Źle", color: "#f09a5b", mouth: "M9 16c1.8-1 4.2-1 6 0" },
  { level: 2, label: "Neutralnie", color: "#9aa3b8", mouth: "M9 15.5h6" },
  { level: 3, label: "Dobrze", color: "#9ccf6a", mouth: "M9 15c1.8 1 4.2 1 6 0" },
  { level: 4, label: "Świetnie", color: "#78d66a", mouth: "M8.5 14.5c1.9 2.2 5.1 2.2 7 0" },
];

export const PREP_RULES = [
  { key: "htf_bias", title: "HTF bias określony", hint: "Kierunek z D1 / H4" },
  { key: "liquidity", title: "Zaznaczona płynność", hint: "PDH / PDL, high i low Azji" },
  { key: "poi", title: "POI na H1 / M15", hint: "Order block lub FVG w kierunku biasu" },
  { key: "calendar", title: "Kalendarz sprawdzony", hint: "Brak czerwonych newsów w oknie wejścia" },
  { key: "head", title: "Głowa w porządku", hint: "Nie odrabiam wczorajszej straty" },
];

export const DAY_TAGS = [
  { label: "Wejście zgodne z planem", good: true },
  { label: "Czekałem na potwierdzenie", good: true },
  { label: "FOMO", good: false },
  { label: "Overtrading", good: false },
  { label: "Przesunięty SL", good: false },
  { label: "Za wczesne wyjście", good: false },
  { label: "Trade po stracie", good: false },
  { label: "Rozproszenie w pracy", good: false },
];

export const QUICK_NOTES = ["Sweep Asia low", "MSS na M5", "Czekam, brak setupu", "Telefon / przerwa", "Za szybko, odpuszczam"];

export const DEFAULT_BIAS_PAIRS = ["EURUSD", "GBPUSD", "XAUUSD"];

export const LIMIT_BOUNDS = {
  trade_limit: { min: 1, max: 10, step: 1 },
  max_risk_percent: { min: 0.25, max: 2, step: 0.25 },
  daily_stop_percent: { min: 0.5, max: 5, step: 0.5 },
};

export const DEFAULT_DAILY_STOP = 2;
export const BREAK_AFTER_LOSS_MIN = 15;

/* ------------------------------------------------------------------ pomocnicze */

const num = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};
const round2 = (n) => Math.round(n * 100) / 100;

export function moodLevel(doc) {
  const v = doc?.mood_v2?.level;
  return Number.isInteger(v) && v >= 0 && v <= 4 ? v : null;
}

export function dailyStopPercent(doc) {
  const v = num(doc?.limits?.daily_stop_percent);
  return v != null && v > 0 ? v : DEFAULT_DAILY_STOP;
}

export function baseTradeLimit(doc) {
  const v = num(doc?.parameters?.trade_limit);
  return v != null && v > 0 ? Math.round(v) : 3;
}

export function riskPercent(doc) {
  const v = num(doc?.parameters?.max_risk_percent);
  return v != null && v > 0 ? v : 1;
}

/** Przy nastroju "Bardzo źle" / "Źle" limit spada do 1. */
export function effectiveTradeLimit(doc) {
  const mood = moodLevel(doc);
  return mood != null && mood <= 1 ? 1 : baseTradeLimit(doc);
}

export function isLimitLowered(doc) {
  return effectiveTradeLimit(doc) < baseTradeLimit(doc);
}

function clockMinutes(date, time) {
  if (!time) return null;
  const converted = convertTradeDateTime(date || "", time, { timeFormat: "24h" });
  const match = String(converted?.time || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Opłaty (prowizja + swap) jako liczba ≤ 0 w walucie konta. */
export function tradeFees(trade) {
  let commission = num(trade?.commission) ?? 0;
  if (commission > 0) commission = -commission;
  const swap = num(trade?.swap) ?? 0;
  return round2(commission + swap);
}

/** Widok transakcji dla strony Dzień (bez modyfikacji samej transakcji). */
export function tradeView(trade) {
  const net = getTradeRealizedPL(trade);
  const fee = tradeFees(trade);
  const grossStored = num(trade?.profit_loss_gross);
  const entry = clockMinutes(trade?.date, trade?.entry_time || trade?.open_time || trade?.time);
  const exit = clockMinutes(trade?.close_date || trade?.date, trade?.exit_time);
  const rating = num(trade?.discipline_rating);
  return {
    id: trade?.id,
    trade,
    minutes: entry,
    exitMinutes: exit,
    time: entry == null ? "—" : hhmmOf(entry),
    symbol: String(trade?.symbol || "—").toUpperCase(),
    dir: normalizeDirection(trade?.direction) === "Short" ? "S" : "L",
    r: tradeRealizedR(trade),
    net,
    fee,
    gross: grossStored != null ? grossStored : net != null ? round2(net - fee) : null,
    strategyId: trade?.strategy_id ? String(trade.strategy_id) : "",
    rating: rating != null && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
    closed: isClosedTrade(trade),
  };
}

/** Transakcje konta z danego dnia, posortowane po godzinie otwarcia. */
export function dayTradesFor(trades, accountId, dateIso) {
  const acc = String(accountId || "");
  return (trades || [])
    .filter((t) => String(t?.account_id) === acc && tradeDayKey(t?.date) === dateIso)
    .map(tradeView)
    .sort((a, b) => (a.minutes ?? 9999) - (b.minutes ?? 9999));
}

/** Statystyki listy transakcji (z istniejących koszyków kalendarza). */
export function statsOf(views) {
  const list = views || [];
  const closedTrades = list.filter((v) => v.closed).map((v) => v.trade);
  const bucket = mergeBuckets([...buildDayIndex(closedTrades).values()]) || emptyBucket();
  const fee = round2(list.reduce((sum, v) => sum + (v.closed ? v.fee : 0), 0));
  const net = round2(bucket.pl);
  const gross = round2(list.reduce((sum, v) => sum + (v.closed ? v.gross ?? 0 : 0), 0));
  const wr = winRate(bucket);
  return {
    n: list.length,
    closed: closedTrades.length,
    net,
    gross,
    fee,
    r: round2(bucket.r),
    rCount: bucket.rCount,
    w: bucket.wins,
    l: bucket.losses,
    wr: wr == null ? null : Math.round(wr),
    pf: profitFactor(bucket),
  };
}

/** Punkty krzywej dnia: skumulowany wynik netto po każdej zamkniętej transakcji. */
export function curvePoints(views) {
  const pts = [{ label: "", value: 0 }];
  let sum = 0;
  (views || [])
    .filter((v) => v.closed && v.net != null)
    .forEach((v) => {
      sum += v.net;
      pts.push({ label: v.time, value: round2(sum) });
    });
  return pts;
}

/* ------------------------------------------------------------------ zasady */

function selectedSession(doc, sessions) {
  return sessions.find((s) => s.id === doc?.mapping_session) || null;
}

export function prepChecks(doc) {
  const state = doc?.rules_manual?.prep || {};
  return PREP_RULES.map((rule) => ({ ...rule, ok: !!state[rule.key], auto: false }));
}

/** Zasady "w trakcie handlu" — wszystkie sprawdzane automatycznie z danych. */
export function tradeChecks({ doc, views, balance, sessions }) {
  const st = statsOf(views);
  const limit = effectiveTradeLimit(doc);
  const risk = riskPercent(doc);
  const stop = dailyStopPercent(doc);
  const stopMoney = balance > 0 ? (balance * stop) / 100 : null;
  const session = selectedSession(doc, sessions);
  const win = tradingWindow(session);
  const timed = views.filter((v) => v.minutes != null);
  const inWindow = win
    ? timed.every((v) => v.minutes >= win.from && v.minutes < win.to)
    : timed.every((v) => sessions.some((s) => v.minutes >= tradingWindow(s).from && v.minutes < s.to));
  const flagged = detectOvertradingAfterLoss(views.map((v) => v.trade));
  const notes = Array.isArray(doc?.session_notes) ? doc.session_notes.length : 0;
  return [
    { key: "limit", auto: true, title: `Max ${limit} ${limit === 1 ? "transakcja" : "transakcje"}`, hint: `Dziś ${st.n}`, ok: st.n <= limit },
    {
      key: "risk",
      auto: true,
      title: `Ryzyko ≤ ${risk.toFixed(2)}% na transakcję`,
      hint: "Strata na trade nie większa niż 1R",
      ok: views.every((v) => v.r == null || v.r >= -1.05),
    },
    {
      key: "stop",
      auto: true,
      title: `Stop dzienny −${stop}% nie przekroczony`,
      hint: stopMoney == null ? "Brak kapitału konta — nie da się policzyć" : `Wynik ${fmtMoney(st.net)}`,
      ok: stopMoney == null ? true : st.net > -stopMoney,
    },
    {
      key: "window",
      auto: true,
      title: "Handel tylko w oknie sesji",
      hint: session ? `${session.name}, od kill zone do końca sesji` : "Dowolna sesja (nie wybrano)",
      ok: inWindow,
    },
    {
      key: "break",
      auto: true,
      title: `${BREAK_AFTER_LOSS_MIN} min przerwy po stracie`,
      hint: "Liczone z godzin transakcji",
      ok: flagged.size === 0,
    },
    { key: "notes", auto: true, title: "Notatki w trakcie sesji", hint: `${notes} ${notes === 1 ? "wpis" : "wpisów"}`, ok: notes > 0 },
  ];
}

export function hasConclusions(doc) {
  const post = doc?.post_session || {};
  return !!(String(post.went_well || "").trim() && String(post.improve_next || "").trim() && String(doc?.promise?.tomorrow_rule || "").trim());
}

export function isImportDone(doc, views) {
  return views.length > 0 || !!doc?.import_done_at;
}

export function reflChecks({ doc, views }) {
  const imported = isImportDone(doc, views);
  return [
    { key: "imported", auto: true, title: "Zaimportowane transakcje", hint: "Wszystkie pozycje z dnia są w dzienniku", ok: imported },
    {
      key: "setups",
      auto: true,
      title: "Setup przy każdej transakcji",
      hint: "Przypisany w kroku Import",
      ok: imported && views.every((v) => v.strategyId),
    },
    { key: "screens", auto: false, title: "Screeny wejść", hint: "Zrzut M15 i M5 przy każdej transakcji", ok: !!doc?.rules_manual?.screens },
    { key: "conclusions", auto: true, title: "Wnioski zapisane", hint: "Co dobrze, co poprawić, zasada na jutro", ok: hasConclusions(doc) },
  ];
}

/** Wynik dnia za dyscyplinę = % spełnionych zasad z trzech grup. */
export function disciplineOf(ctx) {
  const prep = prepChecks(ctx.doc);
  const trade = tradeChecks(ctx);
  const refl = reflChecks(ctx);
  const count = (list) => list.filter((c) => c.ok).length;
  const done = count(prep) + count(trade) + count(refl);
  const total = prep.length + trade.length + refl.length;
  return {
    prep: { done: count(prep), total: prep.length, list: prep },
    trade: { done: count(trade), total: trade.length, list: trade },
    refl: { done: count(refl), total: refl.length, list: refl },
    done,
    total,
    score: total ? Math.round((done / total) * 100) : 0,
  };
}

export function scoreTone(score) {
  if (score == null) return "mute";
  return score >= 80 ? "win" : score >= 50 ? "warn" : "loss";
}

export function scoreHeadline(score) {
  if (score >= 85) return "Świetnie trzymasz plan";
  if (score >= 60) return "Dobry kierunek";
  if (score >= 30) return "Jeszcze trochę";
  return "Zacznij od planu";
}

/* ------------------------------------------------------------------ plan */

export function hasAnyBias(doc, pairs) {
  return pairs.some((p) => !!doc?.bias_levels?.[p]?.bias);
}

export function planMissing(doc, pairs) {
  const missing = [];
  if (moodLevel(doc) == null) missing.push("nastrój");
  if (!doc?.mapping_session) missing.push("sesja");
  if (!hasAnyBias(doc, pairs)) missing.push("bias");
  const prep = prepChecks(doc);
  const done = prep.filter((c) => c.ok).length;
  if (done < prep.length) missing.push(`zasady ${done}/${prep.length}`);
  return missing;
}

export function isPlanComplete(doc, pairs = DEFAULT_BIAS_PAIRS) {
  return planMissing(doc, pairs).length === 0;
}

export function flowPhase(doc) {
  const p = Number(doc?.flow_phase);
  return Number.isInteger(p) && p >= 0 && p <= 3 ? p : 0;
}

export function isClosed(doc) {
  return doc?.status === "closed";
}

/** Następny krok w pasku "Dziś": { label, action, disabled }. */
export function nextStep(doc, pairs, views) {
  if (isClosed(doc)) return { label: "Dzień zamknięty", action: "", disabled: true };
  const phase = flowPhase(doc);
  const missing = planMissing(doc, pairs);
  if (phase === 0) return missing.length ? { label: `Dokończ plan · brakuje ${missing.length}`, action: "plan" } : { label: "Zacznij handel", action: "go1" };
  if (phase === 1) return { label: "Koniec handlu, import", action: "go2" };
  if (phase === 2) return isImportDone(doc, views) ? { label: "Przejdź do przeglądu", action: "go3" } : { label: "Importuj z MT5", action: "import" };
  return { label: "Zamknij dzień", action: "close" };
}

/* ------------------------------------------------------------------ status rynku */

export function minutesOf(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Newsy dnia: [{ time, cur, name, impact: "high" | "med" }] → z minutami, posortowane. */
export function newsOfDay(list) {
  return (Array.isArray(list) ? list : [])
    .map((n) => ({ ...n, minutes: minutesOf(n.time) }))
    .filter((n) => n.minutes != null && (n.impact === "high" || n.impact === "med"))
    .sort((a, b) => a.minutes - b.minutes);
}

/** Czerwony news w oknie 30 min przed – 15 min po. */
export function newsWarning(news, minutes) {
  return news.find((n) => n.impact === "high" && n.minutes - minutes <= 30 && minutes - n.minutes < 15) || null;
}

export function nextNews(news, minutes) {
  return news.find((n) => n.minutes > minutes) || null;
}

/** Status rynku w pasku "Dziś". */
export function marketStatus({ minutes, sessions, news = [], isToday = true }) {
  if (!isToday) return { tone: "off", parts: [{ text: "Podgląd innego dnia" }] };
  const warn = newsWarning(news, minutes);
  if (warn) {
    const d = warn.minutes - minutes;
    return {
      tone: "warn",
      parts: [
        { text: `${warn.cur} ${warn.name} ${d > 0 ? "za " + durationLabel(d) : "właśnie wyszedł"}`, strong: true },
        { text: " · bez nowych pozycji 15 min przed i po" },
      ],
    };
  }
  const kz = sessions.map((s) => s.killZone).filter(Boolean);
  const activeKz = kz.find((k) => minutes >= k.from && minutes < k.to);
  if (activeKz) return { tone: "live", parts: [{ text: `Kill zone ${activeKz.name} trwa · ` }, { text: `zostało ${durationLabel(activeKz.to - minutes)}`, strong: true }] };
  const open = sessions.filter((s) => minutes >= s.from && minutes < s.to);
  if (open.length) {
    const s = open[open.length - 1];
    const nk = kz.filter((k) => k.from > minutes).sort((a, b) => a.from - b.from)[0];
    return {
      tone: "live",
      parts: [{ text: s.name, strong: true }, { text: ` otwarty do ${hhmmOf(s.to)}${nk ? ` · kill zone ${nk.name} za ${durationLabel(nk.from - minutes)}` : ""}` }],
    };
  }
  const upcoming = [...kz.map((k) => ({ name: "kill zone " + k.name, at: k.from })), ...sessions.map((s) => ({ name: s.name, at: s.from }))]
    .filter((x) => x.at > minutes)
    .sort((a, b) => a.at - b.at)[0];
  return upcoming
    ? { tone: "off", parts: [{ text: "Rynek spokojny · " }, { text: upcoming.name, strong: true }, { text: ` za ${durationLabel(upcoming.at - minutes)}` }] }
    : { tone: "off", parts: [{ text: "Sesje na dziś zakończone" }] };
}

/** Licznik w Trybie w pracy: do końca kill zone, sesji albo bieżąca godzina. */
export function workClock({ minutes, sessions }) {
  const kz = sessions.map((s) => s.killZone).filter(Boolean).find((k) => minutes >= k.from && minutes < k.to);
  const fmt = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  if (kz) return { big: fmt(kz.to - minutes), sub: `do końca kill zone ${kz.name}` };
  const open = sessions.filter((s) => minutes >= s.from && minutes < s.to).pop();
  if (open) return { big: fmt(open.to - minutes), sub: `do końca sesji: ${open.name}` };
  return { big: hhmmOf(minutes), sub: "Poza sesją" };
}

/* ------------------------------------------------------------------ historia dni */

function weekday(dateIso) {
  const [y, m, d] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function shiftDays(dateIso, days) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function prevWeekday(dateIso) {
  let cur = shiftDays(dateIso, -1);
  while ([0, 6].includes(weekday(cur))) cur = shiftDays(cur, -1);
  return cur;
}

/** Seria zamkniętych dni handlowych (Pn–Pt). Dziś liczy się, gdy już zamknięty. */
export function closedStreak(plansByDate, todayIso) {
  const closed = (iso) => plansByDate.get(iso)?.status === "closed";
  let cur = closed(todayIso) ? todayIso : prevWeekday(todayIso);
  let n = 0;
  while (closed(cur)) {
    n += 1;
    cur = prevWeekday(cur);
  }
  return n;
}

export function bestStreak(plans) {
  const dates = plans.filter((p) => p.status === "closed").map((p) => p.date).sort();
  let best = 0;
  let run = 0;
  let last = null;
  for (const d of dates) {
    run = last && prevWeekday(d) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = d;
  }
  return best;
}

export function heatLevel(score) {
  if (score == null) return 0;
  return score >= 85 ? 4 : score >= 60 ? 3 : score >= 30 ? 2 : 1;
}

/** Mapa ciepła 12 tygodni × Pn–Pt: [{ dateIso, kind: "past" | "now" | "fut", level }] po kolumnach. */
export function heatmap(plansByDate, todayIso, weeks = 12) {
  const dow = (weekday(todayIso) + 6) % 7; // 0 = Pn
  const monday = shiftDays(todayIso, -dow);
  const firstMonday = shiftDays(monday, -7 * (weeks - 1));
  const cells = [];
  for (let w = 0; w < weeks; w += 1) {
    for (let d = 0; d < 5; d += 1) {
      const iso = shiftDays(firstMonday, w * 7 + d);
      const plan = plansByDate.get(iso);
      const level = plan?.status === "closed" ? heatLevel(num(plan?.discipline_day?.score)) : 0;
      cells.push({ dateIso: iso, week: w, day: d, kind: iso > todayIso ? "fut" : iso === todayIso ? "now" : "past", level });
    }
  }
  return cells;
}

export function averageScore(plans, todayIso, days = 30) {
  const from = shiftDays(todayIso, -days);
  const list = plans.filter((p) => p.status === "closed" && p.date > from && p.date <= todayIso).map((p) => num(p?.discipline_day?.score)).filter((v) => v != null);
  return list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null;
}

/* ------------------------------------------------------------------ odznaki */

export const BADGES = [
  { key: "streak5", name: "Seria 5 dni", desc: "zamknięte dni z rzędu", goal: 5 },
  { key: "planFirst", name: "Plan przed sesją", desc: "dni z pełnym planem", goal: 10 },
  { key: "noOvertrade", name: "Bez overtradingu", desc: "dni w limicie transakcji", goal: 10 },
  { key: "slSafe", name: "SL nietknięty", desc: "dni bez przesuwania SL", goal: 5 },
  { key: "sniper", name: "Snajper kill zone", desc: "wejścia w kill zone", goal: 20 },
  { key: "journalist", name: "Dziennikarz", desc: "dni z wnioskami", goal: 30 },
];

/** Postęp odznak z zapisanych dni i transakcji konta. */
export function badgeProgress({ plans, trades, accountId, pairs = DEFAULT_BIAS_PAIRS }) {
  const closed = plans.filter((p) => p.status === "closed");
  const viewsByDate = new Map();
  const views = (trades || []).filter((t) => String(t?.account_id) === String(accountId)).map(tradeView);
  for (const v of views) {
    const key = tradeDayKey(v.trade?.date);
    if (!viewsByDate.has(key)) viewsByDate.set(key, []);
    viewsByDate.get(key).push(v);
  }
  const sniper = views.filter((v) => {
    if (v.minutes == null) return false;
    const key = tradeDayKey(v.trade?.date);
    if (!key) return false;
    return sessionsForDate(key).some((s) => s.killZone && v.minutes >= s.killZone.from && v.minutes < s.killZone.to);
  }).length;
  const counts = {
    streak5: bestStreak(plans),
    planFirst: plans.filter((p) => isPlanComplete(p, pairs)).length,
    noOvertrade: closed.filter((p) => (viewsByDate.get(p.date) || []).length <= effectiveTradeLimit(p)).length,
    slSafe: closed.filter((p) => (viewsByDate.get(p.date) || []).length > 0 && !(p.day_tags || []).includes("Przesunięty SL")).length,
    sniper,
    journalist: plans.filter(hasConclusions).length,
  };
  return BADGES.map((b) => ({ ...b, count: counts[b.key] || 0, earned: (counts[b.key] || 0) >= b.goal }));
}

/* ------------------------------------------------------------------ Dziennik dni */

/** Dni miesiąca do Dziennika: łączy dni z transakcjami i dni z zapisanym planem. */
export function journalDays({ trades, plans, accountId, monthIso, todayIso }) {
  const prefix = monthIso.slice(0, 7);
  const acc = String(accountId || "");
  const byDate = new Map();
  for (const t of trades || []) {
    if (String(t?.account_id) !== acc) continue;
    const key = tradeDayKey(t?.date);
    if (!key.startsWith(prefix)) continue;
    if (!byDate.has(key)) byDate.set(key, { dateIso: key, trades: [], plan: null });
    byDate.get(key).trades.push(t);
  }
  for (const p of plans || []) {
    if (String(p?.account_id) !== acc || !String(p?.date || "").startsWith(prefix)) continue;
    if (!byDate.has(p.date)) byDate.set(p.date, { dateIso: p.date, trades: [], plan: null });
    byDate.get(p.date).plan = p;
  }
  return [...byDate.values()]
    .map((d) => {
      const views = d.trades.map(tradeView).sort((a, b) => (a.minutes ?? 9999) - (b.minutes ?? 9999));
      const st = statsOf(views);
      const closedDay = d.plan?.status === "closed";
      const stored = num(d.plan?.discipline_day?.score);
      const ratings = views.map((v) => v.rating).filter((v) => v != null);
      return {
        ...d,
        views,
        stats: st,
        today: d.dateIso === todayIso,
        closed: closedDay,
        score: stored,
        avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
        tags: Array.isArray(d.plan?.day_tags) ? d.plan.day_tags : [],
      };
    })
    .filter((d) => d.views.length || d.plan)
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
}

export function monthSummary(days) {
  const traded = days.filter((d) => d.views.length);
  const all = statsOf(traded.flatMap((d) => d.views));
  const nets = traded.map((d) => d.stats.net);
  const scores = days.filter((d) => d.closed && d.score != null).map((d) => d.score);
  return {
    ...all,
    days: traded.length,
    green: nets.filter((v) => v > 0).length,
    red: nets.filter((v) => v < 0).length,
    best: nets.length ? Math.max(...nets) : null,
    worst: nets.length ? Math.min(...nets) : null,
    avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
  };
}

/* ------------------------------------------------------------------ format */

export function fmtMoney(value, { sign = true } = {}) {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(Math.round(value)).toLocaleString("pl-PL");
  if (!sign) return `$${abs}`;
  return `${value >= 0 ? "+" : "−"}$${abs}`;
}

export function fmtR(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}R`;
}

export function fmtPf(value) {
  if (value == null) return "—";
  if (!Number.isFinite(value)) return "∞";
  return value.toFixed(2);
}
