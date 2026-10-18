// Read-only, indicative discipline heuristics derived from existing trade fields.
// Nothing here is persisted and no existing calculation is changed.
import { getTradeMoneyRisk, getTradeOutcomeKey } from "@/lib/utils";

/** Minutes after a losing trade's exit during which a new entry counts as overtrading. */
export const OVERTRADING_WINDOW_MIN = 15;

/** A trade's risk counts as elevated when it exceeds the day's median by this factor. */
export const RISK_MEDIAN_TOLERANCE = 1.25;

export const DISCIPLINE_WEIGHTS = {
  // Entry opened within OVERTRADING_WINDOW_MIN after a same-day loss closed.
  overtradingAfterLoss: 25,
  // Money risk above RISK_MEDIAN_TOLERANCE × the day's median risk (needs ≥ 2 trades with risk).
  riskAboveMedian: 15,
  // Each tag in `mistakes`.
  perMistake: 10,
  // Cap for the total mistakes deduction.
  maxMistakesPenalty: 30,
};

export const DISCIPLINE_FORMULA =
  `100 − ${DISCIPLINE_WEIGHTS.overtradingAfterLoss} (entry ≤ ${OVERTRADING_WINDOW_MIN} min after a same-day loss)` +
  ` − ${DISCIPLINE_WEIGHTS.riskAboveMedian} (risk > ${RISK_MEDIAN_TOLERANCE}× day median)` +
  ` − ${DISCIPLINE_WEIGHTS.perMistake} per mistake tag (max ${DISCIPLINE_WEIGHTS.maxMistakesPenalty}); clamped to 0–100`;

function dayKey(trade) {
  const raw = String(trade?.date || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function timestamp(trade, field) {
  const day = dayKey(trade);
  const match = String(trade?.[field] || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!day || !match) return null;
  const [, h, m, s = "0"] = match;
  const [y, mo, d] = day.split("-").map(Number);
  const value = new Date(y, mo - 1, d, Number(h), Number(m), Number(s)).getTime();
  return Number.isFinite(value) ? value : null;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mistakeList(trade) {
  return (Array.isArray(trade?.mistakes) ? trade.mistakes : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

/**
 * Returns Map<tradeId, { lossTradeId, minutesAfterLoss }> for trades entered within
 * OVERTRADING_WINDOW_MIN after a losing trade on the same day closed.
 */
export function detectOvertradingAfterLoss(trades) {
  const list = Array.isArray(trades) ? trades : [];
  const losses = list
    .filter((trade) => getTradeOutcomeKey(trade) === "loss")
    .map((trade) => ({ trade, day: dayKey(trade), exitAt: timestamp(trade, "exit_time") }))
    .filter((item) => item.day && item.exitAt != null);
  const windowMs = OVERTRADING_WINDOW_MIN * 60000;
  const flagged = new Map();

  list.forEach((trade) => {
    const day = dayKey(trade);
    const entryAt = timestamp(trade, "entry_time");
    if (!day || entryAt == null) return;
    const hit = losses
      .filter((loss) => loss.trade !== trade && loss.day === day)
      .map((loss) => ({ loss, gap: entryAt - loss.exitAt }))
      .filter(({ gap }) => gap >= 0 && gap <= windowMs)
      .sort((a, b) => a.gap - b.gap)[0];
    if (hit) {
      flagged.set(trade.id, { lossTradeId: hit.loss.trade.id, minutesAfterLoss: Math.round(hit.gap / 60000) });
    }
  });
  return flagged;
}

/**
 * Indicative 0–100 score. Returns score: null when the trade has no parsable date + entry_time,
 * because the overtrading check cannot be evaluated.
 * reasons: [{ code, label, points }] — every deduction applied.
 * skipped: [label] — checks that could not run due to missing data.
 */
export function computeDisciplineScore(trade, dayTrades) {
  if (timestamp(trade, "entry_time") == null) {
    return { score: null, reasons: [], skipped: ["Missing date or entry time"], flags: [] };
  }
  const list = Array.isArray(dayTrades) ? dayTrades : [];
  const reasons = [];
  const skipped = [];
  const flags = [];

  const overtrading = detectOvertradingAfterLoss(list.includes(trade) ? list : [...list, trade]).get(trade.id);
  if (overtrading) {
    reasons.push({
      code: "overtrading",
      label: `Entry ${overtrading.minutesAfterLoss} min after a losing trade`,
      points: -DISCIPLINE_WEIGHTS.overtradingAfterLoss,
    });
    flags.push("overtrading");
  }

  const risk = getTradeMoneyRisk(trade);
  const dayRisks = list.map(getTradeMoneyRisk).filter((value) => value != null);
  if (risk == null || dayRisks.length < 2) {
    skipped.push("Risk vs day median (not enough risk data)");
  } else {
    const dayMedian = median(dayRisks);
    if (risk > dayMedian * RISK_MEDIAN_TOLERANCE) {
      reasons.push({
        code: "risk",
        label: `Risk ${risk.toFixed(2)} > ${RISK_MEDIAN_TOLERANCE}× day median ${dayMedian.toFixed(2)}`,
        points: -DISCIPLINE_WEIGHTS.riskAboveMedian,
      });
      flags.push("risk");
    }
  }

  const mistakes = mistakeList(trade);
  if (mistakes.length) {
    reasons.push({
      code: "mistakes",
      label: `Mistakes: ${mistakes.join(", ")}`,
      points: -Math.min(mistakes.length * DISCIPLINE_WEIGHTS.perMistake, DISCIPLINE_WEIGHTS.maxMistakesPenalty),
    });
    flags.push("mistakes");
  }

  const total = reasons.reduce((sum, reason) => sum + reason.points, 100);
  return { score: Math.max(0, Math.min(100, total)), reasons, skipped, flags };
}

/** Session summary over trades that have a score; average is null when none can be scored. */
export function computeSessionDiscipline(dayTrades) {
  const list = Array.isArray(dayTrades) ? dayTrades : [];
  const results = list.map((trade) => computeDisciplineScore(trade, list));
  const scores = results.map((result) => result.score).filter((score) => score != null);
  if (!scores.length) {
    return { average: null, min: null, max: null, scoredCount: 0, flaggedCount: 0 };
  }
  return {
    average: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    min: Math.min(...scores),
    max: Math.max(...scores),
    scoredCount: scores.length,
    flaggedCount: results.filter((result) => result.reasons.length > 0).length,
  };
}
