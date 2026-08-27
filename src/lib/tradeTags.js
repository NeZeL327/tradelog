/**
 * Shared vocabulary for entry conditions (confluences) and trade mistakes.
 * Stored in user settings; analytics aggregate from trade documents.
 */

import {
  getEffectiveUserSettings,
  loadLocalUserSettings,
  saveLocalUserSettings,
} from "@/lib/userSettings";
import { updateUser } from "@/lib/localStorage";

export const DEFAULT_CONFLUENCES = Object.freeze([
  "Sweep płynności",
  "FVG",
  "Order Block",
  "Breaker",
  "BOS",
  "CHoCH",
  "Premium/Discount",
  "Imbalance",
  "Trendline",
  "Wsparcie/Opór",
  "Fibo",
  "Sesja killzone",
  "News uniknięty",
  "HTF zgodny",
]);

export const DEFAULT_MISTAKES = Object.freeze([
  "FOMO",
  "Overtrading",
  "Przesunięty SL",
  "Za wczesne wyjście",
  "Brak potwierdzenia",
  "Revenge trade",
  "Za duża pozycja",
  "Wejście pod news",
  "Złamany plan",
  "Brak SL",
  "Late entry",
]);

export const TRADE_TAG_MAX_LEN = 48;

export function normalizeTagLabel(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, TRADE_TAG_MAX_LEN);
}

function normalizeTagList(list, fallback) {
  if (!Array.isArray(list)) return [...fallback];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const tag = normalizeTagLabel(raw);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export function resolveConfluences(settings) {
  return normalizeTagList(settings?.trade_confluences, DEFAULT_CONFLUENCES);
}

export function resolveMistakes(settings) {
  return normalizeTagList(settings?.trade_mistakes, DEFAULT_MISTAKES);
}

export function loadTradeTagLists({ cloudSettings } = {}) {
  const local = loadLocalUserSettings();
  const effective = getEffectiveUserSettings({ cloudSettings, localSettings: local });
  return {
    confluences: resolveConfluences(effective),
    mistakes: resolveMistakes(effective),
  };
}

/** Persist vocabulary locally (+ Firestore when logged in). */
export async function saveTradeTagLists({ confluences, mistakes, userId } = {}) {
  const next = {
    trade_confluences: normalizeTagList(confluences, DEFAULT_CONFLUENCES),
    trade_mistakes: normalizeTagList(mistakes, DEFAULT_MISTAKES),
  };
  const local = loadLocalUserSettings();
  saveLocalUserSettings({ ...local, ...next });
  if (userId) {
    try {
      await updateUser(userId, next);
    } catch (err) {
      console.error("saveTradeTagLists cloud:", err);
    }
  }
  return {
    confluences: next.trade_confluences,
    mistakes: next.trade_mistakes,
  };
}

export function addTagToList(list, label, fallback = []) {
  const tag = normalizeTagLabel(label);
  if (!tag) return { list: normalizeTagList(list, fallback), added: null };
  const current = normalizeTagList(list, fallback);
  const exists = current.some((t) => t.toLowerCase() === tag.toLowerCase());
  if (exists) return { list: current, added: null };
  return { list: [...current, tag], added: tag };
}

export function removeTagFromList(list, label, fallback = []) {
  const tag = normalizeTagLabel(label);
  const current = normalizeTagList(list, fallback);
  return current.filter((t) => t.toLowerCase() !== tag.toLowerCase());
}

export function renameTagInList(list, fromLabel, toLabel, fallback = []) {
  const from = normalizeTagLabel(fromLabel);
  const to = normalizeTagLabel(toLabel);
  const current = normalizeTagList(list, fallback);
  if (!from || !to) return { list: current, renamed: false };
  if (from.toLowerCase() === to.toLowerCase()) {
    return {
      list: current.map((t) => (t.toLowerCase() === from.toLowerCase() ? to : t)),
      renamed: true,
    };
  }
  const clash = current.some((t) => t.toLowerCase() === to.toLowerCase());
  if (clash) return { list: current, renamed: false };
  return {
    list: current.map((t) => (t.toLowerCase() === from.toLowerCase() ? to : t)),
    renamed: true,
  };
}

export function remapSelectedTags(selected, fromLabel, toLabel) {
  const from = normalizeTagLabel(fromLabel);
  const to = normalizeTagLabel(toLabel);
  if (!from) return Array.isArray(selected) ? selected : [];
  return (Array.isArray(selected) ? selected : [])
    .map((t) => (normalizeTagLabel(t).toLowerCase() === from.toLowerCase() ? to : t))
    .filter(Boolean);
}

/**
 * Aggregate winRate / avgPL / totalPL per tag from trade.confluences or trade.mistakes.
 * One trade counts once per unique tag.
 */
export function aggregateTagPerformance(trades, field, { decidedWinRate, getPl } = {}) {
  const map = {};
  let taggedTrades = 0;

  for (const trade of trades || []) {
    const raw = trade?.[field];
    if (!Array.isArray(raw) || raw.length === 0) continue;
    const tags = [
      ...new Set(raw.map(normalizeTagLabel).filter(Boolean)),
    ];
    if (!tags.length) continue;
    taggedTrades += 1;
    const pl = typeof getPl === "function" ? getPl(trade) : 0;
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
      winRate:
        typeof decidedWinRate === "function"
          ? decidedWinRate(x.wins, x.losses)
          : x.wins + x.losses > 0
            ? Number(((x.wins / (x.wins + x.losses)) * 100).toFixed(1))
            : 0,
      avgPL: x.total > 0 ? Number((x.pl / x.total).toFixed(2)) : 0,
      totalPL: Number(x.pl.toFixed(2)),
    }))
    .sort((a, b) => b.trades - a.trades || a.avgPL - b.avgPL);

  return { rows, taggedTrades };
}
