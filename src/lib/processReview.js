/**
 * Privacy-safe process review from trade TAGS only.
 * No screenshots, symbols, prices, notes, or strategy text in AI payloads.
 */

import { getTradeRealizedPL } from "@/lib/utils";
import {
  computeBasicStats,
  tradesInPeriod,
} from "@/lib/reports";
import {
  aggregateTagPerformance,
  normalizeTagLabel,
} from "@/lib/tradeTags";
import { normalizeEmotions } from "@/components/EmotionsPanel";

function decidedWinRate(wins, losses) {
  const d = wins + losses;
  return d > 0 ? Number(((wins / d) * 100).toFixed(1)) : 0;
}

function getPl(trade) {
  return getTradeRealizedPL(trade) ?? 0;
}

/** Flatten emotion stage tags across before/during/after. */
export function collectEmotionTags(trade) {
  const emotions = normalizeEmotions(trade?.emotions);
  const out = [];
  for (const stage of ["before", "during", "after"]) {
    const tags = emotions[stage]?.tags;
    if (!Array.isArray(tags)) continue;
    for (const t of tags) {
      const label = normalizeTagLabel(t);
      if (label) out.push(label);
    }
  }
  return out;
}

function aggregateEmotionTags(trades) {
  const map = {};
  let taggedTrades = 0;
  for (const trade of trades || []) {
    const tags = [...new Set(collectEmotionTags(trade))];
    if (!tags.length) continue;
    taggedTrades += 1;
    const pl = getPl(trade);
    const isWin = trade.outcome === "Win";
    const isLoss = trade.outcome === "Loss";
    for (const tag of tags) {
      if (!map[tag]) map[tag] = { tag, wins: 0, losses: 0, total: 0, pl: 0 };
      map[tag].total += 1;
      if (isWin) map[tag].wins += 1;
      else if (isLoss) map[tag].losses += 1;
      map[tag].pl += pl;
    }
  }
  const rows = Object.values(map)
    .map((x) => ({
      tag: x.tag,
      trades: x.total,
      wins: x.wins,
      losses: x.losses,
      winRate: decidedWinRate(x.wins, x.losses),
      avgPL: x.total > 0 ? Number((x.pl / x.total).toFixed(2)) : 0,
      totalPL: Number(x.pl.toFixed(2)),
    }))
    .sort((a, b) => b.trades - a.trades || a.avgPL - b.avgPL);
  return { rows, taggedTrades };
}

function aggregateByField(trades, getter) {
  const map = {};
  for (const trade of trades || []) {
    const raw = getter(trade);
    const key = normalizeTagLabel(raw) || "—";
    if (!map[key]) map[key] = { tag: key, wins: 0, losses: 0, total: 0, pl: 0 };
    map[key].total += 1;
    if (trade.outcome === "Win") map[key].wins += 1;
    else if (trade.outcome === "Loss") map[key].losses += 1;
    map[key].pl += getPl(trade);
  }
  return Object.values(map)
    .map((x) => ({
      tag: x.tag,
      trades: x.total,
      wins: x.wins,
      losses: x.losses,
      winRate: decidedWinRate(x.wins, x.losses),
      avgPL: x.total > 0 ? Number((x.pl / x.total).toFixed(2)) : 0,
      totalPL: Number(x.pl.toFixed(2)),
    }))
    .sort((a, b) => b.trades - a.trades);
}

function positiveTags(rows, minTrades = 2) {
  return (rows || [])
    .filter((r) => r.trades >= minTrades && (r.winRate >= 55 || r.avgPL > 0))
    .sort((a, b) => b.winRate - a.winRate || b.avgPL - a.avgPL)
    .slice(0, 5);
}

function negativeTags(rows, minTrades = 2) {
  return (rows || [])
    .filter((r) => r.trades >= minTrades && (r.winRate <= 45 || r.avgPL < 0))
    .sort((a, b) => a.winRate - b.winRate || a.avgPL - b.avgPL)
    .slice(0, 5);
}

function topByCount(rows, n = 5) {
  return (rows || []).slice(0, n);
}

/**
 * Build full process review for a date range.
 * @param {object[]} allTrades
 * @param {string} start YYYY-MM-DD
 * @param {string} end YYYY-MM-DD
 */
export function buildProcessReview(allTrades, start, end) {
  const trades = tradesInPeriod(allTrades, start, end);
  const stats = computeBasicStats(trades);
  const totalPl = Number(
    trades.reduce((s, t) => s + getPl(t), 0).toFixed(2)
  );

  const confluences = aggregateTagPerformance(trades, "confluences", {
    decidedWinRate,
    getPl,
  });
  const mistakes = aggregateTagPerformance(trades, "mistakes", {
    decidedWinRate,
    getPl,
  });
  const psychology = aggregateTagPerformance(trades, "psychology_tags", {
    decidedWinRate,
    getPl,
  });
  const emotions = aggregateEmotionTags(trades);
  const sessions = aggregateByField(trades, (t) => t.session || "");
  const timeframes = aggregateByField(trades, (t) => t.timeframe || "");

  const withMistakes = trades.filter(
    (t) => Array.isArray(t.mistakes) && t.mistakes.length > 0
  ).length;
  const cleanTrades = Math.max(0, trades.length - withMistakes);
  const processScore =
    trades.length > 0
      ? Number(((cleanTrades / trades.length) * 100).toFixed(1))
      : 0;

  const wentWell = [
    ...positiveTags(confluences.rows).map((r) => ({
      source: "wejście",
      ...r,
    })),
    ...positiveTags(psychology.rows, 1).map((r) => ({
      source: "psychologia",
      ...r,
    })),
    ...positiveTags(emotions.rows, 1).map((r) => ({
      source: "emocje",
      ...r,
    })),
    ...positiveTags(sessions, 1).map((r) => ({
      source: "sesja",
      ...r,
    })),
  ].slice(0, 8);

  const wentWrong = [
    ...topByCount(mistakes.rows, 5).map((r) => ({
      source: "błąd",
      ...r,
    })),
    ...negativeTags(confluences.rows).map((r) => ({
      source: "wejście",
      ...r,
    })),
    ...negativeTags(psychology.rows, 1).map((r) => ({
      source: "psychologia",
      ...r,
    })),
    ...negativeTags(emotions.rows, 1).map((r) => ({
      source: "emocje",
      ...r,
    })),
  ].slice(0, 8);

  const topMistakes = topByCount(mistakes.rows, 8);

  let focusNext = "Taguj każdy trejd (wejście, błędy, psychologia) — bez tagów nie ma przeglądu.";
  if (topMistakes[0]) {
    focusNext = `Jeden fokus: redukuj „${topMistakes[0].tag}” (wystąpił ${topMistakes[0].trades}×).`;
  } else if (processScore < 70 && trades.length > 0) {
    focusNext = "Jeden fokus: więcej trejdów bez błędów procesowych (cel: ≥70% clean).";
  } else if (wentWell[0]) {
    focusNext = `Jeden fokus: powtarzaj to, co działa — „${wentWell[0].tag}” (${wentWell[0].source}).`;
  } else if (trades.length > 0) {
    focusNext = "Jeden fokus: utrzymuj dyscyplinę i taguj psychologię przy każdym wejściu.";
  }

  return {
    start,
    end,
    trades,
    stats: {
      ...stats,
      total_pl: totalPl,
      process_score: processScore,
      clean_trades: cleanTrades,
      with_mistakes: withMistakes,
    },
    confluences: confluences.rows,
    mistakes: mistakes.rows,
    psychology: psychology.rows,
    emotions: emotions.rows,
    sessions,
    timeframes,
    wentWell,
    wentWrong,
    topMistakes,
    focusNext,
    tagged: {
      confluences: confluences.taggedTrades,
      mistakes: mistakes.taggedTrades,
      psychology: psychology.taggedTrades,
      emotions: emotions.taggedTrades,
    },
  };
}

/**
 * Sanitize review for external AI — frequencies only, no strategy/IP leakage.
 */
export function toAiSafePayload(review) {
  if (!review) return null;
  const slim = (rows, limit = 8) =>
    (rows || []).slice(0, limit).map((r) => ({
      tag: r.tag,
      n: r.trades,
      wr: r.winRate,
      avg: r.avgPL,
    }));

  return {
    period: { start: review.start, end: review.end },
    stats: {
      trades: review.stats.trades_count,
      wins: review.stats.wins_count,
      losses: review.stats.losses_count,
      win_rate: review.stats.win_rate,
      process_clean_pct: review.stats.process_score,
      trades_with_mistake_tags: review.stats.with_mistakes,
    },
    entry_tags: slim(review.confluences),
    mistake_tags: slim(review.mistakes),
    psychology_tags: slim(review.psychology),
    emotion_tags: slim(review.emotions),
    sessions: slim(review.sessions, 4),
    timeframes: slim(review.timeframes, 4),
    local_hints: {
      went_well: (review.wentWell || []).slice(0, 5).map((r) => `${r.source}:${r.tag}`),
      went_wrong: (review.wentWrong || []).slice(0, 5).map((r) => `${r.source}:${r.tag}`),
      focus: review.focusNext,
    },
    language: "pl",
    constraints: [
      "Używaj TYLKO podanych tagów i liczb.",
      "Nie wymyślaj strategii, setupów ICT, poziomów ani reguł wejścia.",
      "Nie proś o screeny ani szczegóły playbooka.",
      "Skup się na zachowaniu, psychologii i powtarzalnych błędach.",
    ],
  };
}

export function buildLocalNarrative(review) {
  if (!review || !review.stats.trades_count) {
    return {
      summary: "Brak zamkniętych trejdów w wybranym okresie.",
      well: [],
      bad: [],
      mistakes: [],
      improve: [],
      focus: review?.focusNext || "",
    };
  }
  const s = review.stats;
  const summary = `${s.trades_count} trejdów · WR ${s.win_rate}% · proces clean ${s.process_score}% (${s.clean_trades} bez tagu błędu).`;

  const improve = [];
  for (const m of (review.topMistakes || []).slice(0, 4)) {
    improve.push(`Ogranicz „${m.tag}” — ${m.trades}× w okresie (WR ${m.winRate}%).`);
  }
  for (const r of (review.wentWrong || []).slice(0, 3)) {
    if (r.source === "błąd") continue;
    improve.push(`Sprawdź wzorzec „${r.tag}” (${r.source}) — WR ${r.winRate}%, ${r.trades}×.`);
  }
  if (s.process_score < 70 && s.trades_count >= 3) {
    improve.push(`Podnieś % trejdów bez błędów (teraz ${s.process_score}%).`);
  }
  if (!improve.length) {
    improve.push(review.focusNext || "Utrzymuj tagowanie i dyscyplinę.");
  }

  return {
    summary,
    well: (review.wentWell || []).map(
      (r) => `${r.tag} (${r.source}) — ${r.trades}×, WR ${r.winRate}%`
    ),
    bad: (review.wentWrong || []).map(
      (r) => `${r.tag} (${r.source}) — ${r.trades}×, WR ${r.winRate}%`
    ),
    mistakes: (review.topMistakes || []).map(
      (r) => `${r.tag} — ${r.trades}× (WR ${r.winRate}%)`
    ),
    improve: [...new Set(improve)].slice(0, 6),
    focus: review.focusNext,
  };
}
