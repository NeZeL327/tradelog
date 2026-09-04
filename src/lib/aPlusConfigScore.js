/**
 * A+ configuration score (LTF egzekucja) — pure scoring helpers.
 * Groups mirror the trader checklist; "Non" is exclusive within its group.
 */

export const APLUS_STORAGE_KEY = "aikeeptrade_aplus_config_v1";

/** @typedef {{ id: string, label: string, points: number, exclusive?: boolean }} ScoreOption */
/** @typedef {{ id: string, title: string, subtitle?: string, mode: 'multi' | 'single', options: ScoreOption[] }} ScoreGroup */

/** @type {ScoreGroup[]} */
export const APLUS_SCORE_GROUPS = [
  {
    id: "poi",
    title: "POI",
    subtitle: "Point of Interest",
    mode: "multi",
    options: [
      { id: "ipa_htf_mtf", label: "IPA HTF / MTF", points: 2 },
      { id: "significant_htf_mtf", label: "Significant HTF / MTF", points: 2 },
      { id: "external_htf_mtf", label: "External HTF / MTF", points: 2 },
      { id: "inducement_poi_15m", label: "Inducement POI 15m", points: 1 },
      { id: "smt_15m", label: "SMT 15m", points: 2 },
      { id: "poi_non", label: "Non", points: 0, exclusive: true },
    ],
  },
  {
    id: "liquidity",
    title: "LIQUIDITY",
    subtitle: "Płynność + imbalance",
    mode: "multi",
    options: [
      { id: "asia_imb", label: "Asia + imb.", points: 2 },
      { id: "frk_imb", label: "Frk + imb.", points: 1 },
      { id: "med_major_imb", label: "Med. / Major + imb.", points: 2 },
      { id: "min_imb", label: "Min. + imb.", points: 2 },
      { id: "h4_liquidity", label: "H4 liquidity", points: 1 },
      { id: "liq_non", label: "Non", points: 0, exclusive: true },
    ],
  },
  {
    id: "price_delivery",
    title: "Price delivery",
    subtitle: "Budowa w kierunku do POI",
    mode: "single",
    options: [
      { id: "good_pd", label: "Good PD", points: 0 },
      { id: "bad_pd", label: "Bad PD", points: 2 },
    ],
  },
  {
    id: "time",
    title: "TIME",
    subtitle: "Okno czasowe / news",
    mode: "multi",
    options: [
      { id: "h1_q1", label: "1 ćwiartka — H1", points: 1 },
      { id: "h1_q2", label: "2 ćwiartka — H1", points: 1 },
      { id: "h1_q3", label: "3 ćwiartka — H1", points: 1 },
      { id: "h1_q4", label: "4 ćwiartka — H1", points: 0 },
      { id: "h4_q1", label: "1/4 godzina H4", points: 0 },
      { id: "h4_q23", label: "2/3 godzina H4", points: 1 },
      { id: "news", label: "NEWS", points: -4 },
    ],
  },
];

export function emptyAPlusSelection() {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const g of APLUS_SCORE_GROUPS) out[g.id] = [];
  return out;
}

export function sanitizeAPlusSelection(raw) {
  const base = emptyAPlusSelection();
  if (!raw || typeof raw !== "object") return base;

  for (const group of APLUS_SCORE_GROUPS) {
    const allowed = new Set(group.options.map((o) => o.id));
    const incoming = Array.isArray(raw[group.id]) ? raw[group.id] : [];
    let next = incoming.map(String).filter((id) => allowed.has(id));

    if (group.mode === "single") {
      next = next.slice(0, 1);
    } else {
      const exclusive = group.options.find((o) => o.exclusive && next.includes(o.id));
      if (exclusive) next = [exclusive.id];
    }
    base[group.id] = next;
  }
  return base;
}

/**
 * Toggle option within a group — exclusive / single rules applied.
 * @param {Record<string, string[]>} selection
 * @param {string} groupId
 * @param {string} optionId
 */
export function toggleAPlusOption(selection, groupId, optionId) {
  const group = APLUS_SCORE_GROUPS.find((g) => g.id === groupId);
  if (!group) return sanitizeAPlusSelection(selection);

  const option = group.options.find((o) => o.id === optionId);
  if (!option) return sanitizeAPlusSelection(selection);

  const current = Array.isArray(selection?.[groupId]) ? [...selection[groupId]] : [];
  const isOn = current.includes(optionId);
  let next = current;

  if (group.mode === "single") {
    next = isOn ? [] : [optionId];
  } else if (option.exclusive) {
    next = isOn ? [] : [optionId];
  } else if (isOn) {
    next = current.filter((id) => id !== optionId);
  } else {
    next = [...current.filter((id) => {
      const opt = group.options.find((o) => o.id === id);
      return !opt?.exclusive;
    }), optionId];
  }

  return sanitizeAPlusSelection({ ...selection, [groupId]: next });
}

export function sumAPlusPoints(selection) {
  const safe = sanitizeAPlusSelection(selection);
  let total = 0;
  /** @type {{ groupId: string, optionId: string, label: string, points: number }[]} */
  const breakdown = [];

  for (const group of APLUS_SCORE_GROUPS) {
    for (const optionId of safe[group.id] || []) {
      const option = group.options.find((o) => o.id === optionId);
      if (!option) continue;
      total += option.points;
      breakdown.push({
        groupId: group.id,
        optionId: option.id,
        label: option.label,
        points: option.points,
      });
    }
  }

  return { total, breakdown, selection: safe };
}

/** Legend + verdict for configuration total (from trader checklist). */
export const APLUS_SUM_TIERS = Object.freeze([
  { id: "none", min: -Infinity, max: 4, emoji: "❌", label: "brak trade", tone: "rose" },
  { id: "medium", min: 5, max: 7, emoji: "⚠️", label: "średni setup", tone: "amber" },
  { id: "a", min: 8, max: 9, emoji: "✅", label: "A", tone: "emerald" },
  { id: "aplus", min: 10, max: Infinity, emoji: "🔥", label: "A+", tone: "orange" },
]);

export function evaluateAPlusSum(total) {
  const n = Number(total);
  const score = Number.isFinite(n) ? n : 0;
  const tier =
    APLUS_SUM_TIERS.find((t) => score >= t.min && score <= t.max) || APLUS_SUM_TIERS[0];
  return {
    score,
    id: tier.id,
    emoji: tier.emoji,
    label: tier.label,
    tone: tier.tone,
    display: `${tier.emoji} ${tier.label}`,
  };
}

export function formatPoints(n) {
  const v = Number(n) || 0;
  if (v > 0) return `+${v}`;
  return String(v);
}

/** Option points: + green, 0 / negative red. */
export function pointsToneClass(points) {
  const v = Number(points) || 0;
  if (v > 0) return "text-profit dark:text-profit";
  return "text-loss dark:text-loss";
}

/**
 * Sum number: red → strong green by score.
 * ≤0 red · 1–4 warmer red/orange · 5–7 lime · 8–9 green · 10+ deep green
 */
export function sumToneClass(total) {
  const n = Number(total);
  const score = Number.isFinite(n) ? n : 0;
  if (score <= 0) return "text-loss dark:text-loss";
  if (score <= 2) return "text-loss dark:text-loss";
  if (score <= 4) return "text-orange-600 dark:text-orange-400";
  if (score <= 5) return "text-amber-600 dark:text-amber-400";
  if (score <= 7) return "text-lime-600 dark:text-lime-400";
  if (score <= 9) return "text-profit dark:text-profit";
  return "text-profit dark:text-profit";
}

/** Panel border/bg for the suma block — same red→green scale. */
export function sumPanelClass(total) {
  const n = Number(total);
  const score = Number.isFinite(n) ? n : 0;
  if (score <= 0) {
    return "border-loss/40 bg-loss/80 dark:border-loss/30/70 dark:bg-loss/10";
  }
  if (score <= 4) {
    return "border-loss/30 bg-loss/60 dark:border-loss/30/50 dark:bg-loss/10";
  }
  if (score <= 7) {
    return "border-lime-400/70 bg-lime-50/70 dark:border-lime-700/50 dark:bg-lime-950/30";
  }
  if (score <= 9) {
    return "border-profit/40 bg-profit/80 dark:border-profit/40/60 dark:bg-profit/10";
  }
  return "border-profit/40 bg-profit/90 dark:border-profit/40 dark:bg-profit/10/50";
}

export function loadAPlusSelection() {
  try {
    const raw = localStorage.getItem(APLUS_STORAGE_KEY);
    if (!raw) return emptyAPlusSelection();
    return sanitizeAPlusSelection(JSON.parse(raw));
  } catch {
    return emptyAPlusSelection();
  }
}

export function saveAPlusSelection(selection) {
  try {
    const safe = sanitizeAPlusSelection(selection);
    localStorage.setItem(APLUS_STORAGE_KEY, JSON.stringify(safe));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("aikeeptrade-calc-changed", { detail: { kind: "aplus" } }));
    }
    return safe;
  } catch {
    return sanitizeAPlusSelection(selection);
  }
}
