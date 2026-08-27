/**
 * M1 MASTERY — ekstra confluences / entry model (1min).
 * Flat multi-select checklist; all selected items stack.
 */

export const M1_STORAGE_KEY = "aikeeptrade_m1_mastery_v1";

/** @typedef {{ id: string, code: string, label: string, points: number }} M1Option */

/** @type {M1Option[]} */
export const M1_MASTERY_OPTIONS = [
  { id: "em1", code: "EM#1", label: "External SMT", points: 2 },
  { id: "em2", code: "EM#2", label: "fMS + Tms", points: 2 },
  { id: "em3", code: "EM#3", label: "Reversal EPA", points: 2 },
  { id: "em4", code: "EM#4", label: "Buildup liq. followed by IND", points: 2 },
  { id: "em5", code: "EM#5", label: "IFVG", points: 1 },
  { id: "em6", code: "EM#6", label: "BPR", points: 2 },
  { id: "em7", code: "EM#7", label: "CISD", points: 1 },
  { id: "em8", code: "EM#8", label: "SMT internal", points: 1 },
];

const ALLOWED = new Set(M1_MASTERY_OPTIONS.map((o) => o.id));

export function emptyM1Selection() {
  return [];
}

export function sanitizeM1Selection(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const id of raw) {
    const key = String(id);
    if (!ALLOWED.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function toggleM1Option(selection, optionId) {
  const safe = sanitizeM1Selection(selection);
  if (!ALLOWED.has(optionId)) return safe;
  if (safe.includes(optionId)) return safe.filter((id) => id !== optionId);
  return [...safe, optionId];
}

export function sumM1Points(selection) {
  const safe = sanitizeM1Selection(selection);
  let total = 0;
  /** @type {{ id: string, code: string, label: string, points: number }[]} */
  const breakdown = [];
  for (const id of safe) {
    const opt = M1_MASTERY_OPTIONS.find((o) => o.id === id);
    if (!opt) continue;
    total += opt.points;
    breakdown.push({ id: opt.id, code: opt.code, label: opt.label, points: opt.points });
  }
  return { total, breakdown, selection: safe };
}

export function formatM1Points(n) {
  const v = Number(n) || 0;
  if (v > 0) return `+${v}`;
  return String(v);
}

export function loadM1Selection() {
  try {
    const raw = localStorage.getItem(M1_STORAGE_KEY);
    if (!raw) return emptyM1Selection();
    return sanitizeM1Selection(JSON.parse(raw));
  } catch {
    return emptyM1Selection();
  }
}

export function saveM1Selection(selection) {
  try {
    const safe = sanitizeM1Selection(selection);
    localStorage.setItem(M1_STORAGE_KEY, JSON.stringify(safe));
    return safe;
  } catch {
    return sanitizeM1Selection(selection);
  }
}
