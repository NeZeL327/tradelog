import {
  APLUS_SCORE_GROUPS,
  APLUS_SUM_TIERS,
  evaluateAPlusSum,
  sumAPlusPoints,
} from "@/lib/aPlusConfigScore";
import { M1_MASTERY_OPTIONS, sumM1Points } from "@/lib/m1MasteryScore";
import { toNum } from "@/lib/calculatorMath";

export const CONDITION_TYPES = [
  "boolean",
  "select",
  "multi",
  "number",
  "text",
  "time",
  "timeRange",
];

export const DEFAULT_GRADES = [
  { id: "c", label: "C", minPct: 0, maxPct: 49 },
  { id: "b", label: "B", minPct: 50, maxPct: 69 },
  { id: "a", label: "A", minPct: 70, maxPct: 84 },
  { id: "aplus", label: "A+", minPct: 85, maxPct: 100 },
];

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyCondition(partial = {}) {
  return {
    id: uid("cond"),
    name: "",
    type: "boolean",
    operator: ">=",
    value: "",
    actual: "",
    unit: "",
    timeframe: "",
    points: 1,
    required: false,
    description: "",
    options: [],
    min: "",
    max: "",
    visible: true,
    ...partial,
  };
}

function parseList(value) {
  if (Array.isArray(value)) return value.map(String);
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isConditionMet(condition, actual) {
  const type = condition?.type || "boolean";
  const expected = condition?.value;
  if (type === "boolean") return actual === true || actual === "true" || actual === 1;
  if (type === "select") return String(actual || "") === String(expected || "");
  if (type === "multi") {
    const need = parseList(expected);
    const have = parseList(actual);
    return need.length > 0 && need.every((item) => have.includes(item));
  }
  if (type === "number") {
    const n = toNum(actual, NaN);
    const target = toNum(expected, NaN);
    if (!Number.isFinite(n) || !Number.isFinite(target)) return false;
    const op = condition.operator || ">=";
    if (op === ">") return n > target;
    if (op === ">=") return n >= target;
    if (op === "<") return n < target;
    if (op === "<=") return n <= target;
    if (op === "!=") return n !== target;
    return n === target;
  }
  if (type === "text") {
    const a = String(actual || "").trim().toLowerCase();
    const e = String(expected || "").trim().toLowerCase();
    if (!e) return a.length > 0;
    return a.includes(e);
  }
  if (type === "time") return String(actual || "") === String(expected || "");
  if (type === "timeRange") {
    const [from, to] = String(expected || "").split("-").map((s) => s.trim());
    const t = String(actual || "").trim();
    if (!from || !to || !t) return false;
    return t >= from && t <= to;
  }
  return false;
}

export function scoreConditions(conditions, values) {
  let earned = 0;
  let max = 0;
  let requiredTotal = 0;
  let requiredMet = 0;
  let optionalTotal = 0;
  let optionalMet = 0;
  let checked = 0;
  const rows = [];

  for (const cond of conditions || []) {
    if (cond?.visible === false) continue;
    const pts = toNum(cond.points);
    const maxPts = Math.max(pts, 0);
    max += maxPts;
    const actual = values?.[cond.id];
    const met = isConditionMet(cond, actual);
    if (met) {
      earned += pts;
      checked += 1;
    }
    if (cond.required) {
      requiredTotal += 1;
      if (met) requiredMet += 1;
    } else {
      optionalTotal += 1;
      if (met) optionalMet += 1;
    }
    rows.push({ ...cond, met, actual });
  }

  const requiredOk = requiredTotal === 0 || requiredMet === requiredTotal;
  const pct = max > 0 ? (earned / max) * 100 : 0;
  return {
    earned,
    max,
    pct,
    checked,
    total: rows.length,
    requiredTotal,
    requiredMet,
    optionalTotal,
    optionalMet,
    requiredOk,
    rows,
  };
}

export function pickGrade(pct, grades = DEFAULT_GRADES) {
  const list = Array.isArray(grades) && grades.length ? grades : DEFAULT_GRADES;
  const score = Number.isFinite(pct) ? pct : 0;
  const hit = list.find((g) => score >= toNum(g.minPct) && score <= toNum(g.maxPct, 100));
  return hit || list[0];
}

export function aplusBuiltinConditions() {
  const rows = [];
  for (const group of APLUS_SCORE_GROUPS) {
    for (const opt of group.options) {
      rows.push({
        id: `${group.id}:${opt.id}`,
        groupId: group.id,
        optionId: opt.id,
        name: opt.label,
        type: group.mode === "single" ? "select" : "boolean",
        value: group.title,
        timeframe: inferTf(opt.label, group.id),
        points: opt.points,
        required: false,
        builtin: true,
        exclusive: Boolean(opt.exclusive),
        groupTitle: group.title,
        groupMode: group.mode,
      });
    }
  }
  return rows;
}

export function m1BuiltinConditions() {
  return M1_MASTERY_OPTIONS.map((opt) => ({
    id: opt.id,
    name: `${opt.code} ${opt.label}`,
    type: "boolean",
    value: "",
    timeframe: "M1",
    points: opt.points,
    required: false,
    builtin: true,
  }));
}

function inferTf(label, groupId) {
  const s = String(label || "");
  if (/15m/i.test(s)) return "M15";
  if (/H4/i.test(s)) return "H4";
  if (/H1/i.test(s)) return "H1";
  if (groupId === "time") return "H1/H4";
  if (groupId === "price_delivery") return "LTF";
  return "HTF";
}

export function aplusMaxPoints() {
  let max = 0;
  for (const group of APLUS_SCORE_GROUPS) {
    const opts = group.options.filter((o) => !o.exclusive);
    if (group.mode === "single") {
      max += Math.max(0, ...opts.map((o) => o.points), 0);
    } else {
      max += opts.reduce((sum, o) => sum + Math.max(0, o.points), 0);
    }
  }
  return max;
}

export function m1MaxPoints() {
  return M1_MASTERY_OPTIONS.reduce((sum, o) => sum + Math.max(0, o.points), 0);
}

export function evaluateSetup({ kind, aplusSelection, m1Selection, extraConditions, extraValues, grades }) {
  if (kind === "aplus") {
    const { total, breakdown } = sumAPlusPoints(aplusSelection);
    const extra = scoreConditions(extraConditions, extraValues);
    const earned = total + extra.earned;
    const max = aplusMaxPoints() + extra.max;
    const builtinRequired = extra.requiredOk;
    const verdict = grades?.length
      ? pickGrade(max > 0 ? (earned / max) * 100 : 0, grades)
      : evaluateAPlusSum(total);
    return {
      earned,
      max,
      pct: max > 0 ? (earned / max) * 100 : 0,
      checked: breakdown.length + extra.checked,
      total: aplusBuiltinConditions().length + extra.total,
      requiredTotal: extra.requiredTotal,
      requiredMet: extra.requiredMet,
      optionalTotal: extra.optionalTotal + aplusBuiltinConditions().length,
      optionalMet: extra.optionalMet + breakdown.length,
      requiredOk: builtinRequired,
      gradeLabel: grades?.length ? verdict.label : verdict.label,
      gradeId: verdict.id,
      extra,
      breakdown,
    };
  }

  if (kind === "m1") {
    const { total, breakdown } = sumM1Points(m1Selection);
    const extra = scoreConditions(extraConditions, extraValues);
    const earned = total + extra.earned;
    const max = m1MaxPoints() + extra.max;
    const verdict = grades?.length
      ? pickGrade(max > 0 ? (earned / max) * 100 : 0, grades)
      : evaluateAPlusSum(total);
    return {
      earned,
      max,
      pct: max > 0 ? (earned / max) * 100 : 0,
      checked: breakdown.length + extra.checked,
      total: M1_MASTERY_OPTIONS.length + extra.total,
      requiredTotal: extra.requiredTotal,
      requiredMet: extra.requiredMet,
      optionalTotal: extra.optionalTotal + M1_MASTERY_OPTIONS.length,
      optionalMet: extra.optionalMet + breakdown.length,
      requiredOk: extra.requiredOk,
      gradeLabel: verdict.label,
      gradeId: verdict.id,
      extra,
      breakdown,
    };
  }

  const extra = scoreConditions(extraConditions, extraValues);
  const grade = pickGrade(extra.pct, grades);
  return {
    earned: extra.earned,
    max: extra.max,
    pct: extra.pct,
    checked: extra.checked,
    total: extra.total,
    requiredTotal: extra.requiredTotal,
    requiredMet: extra.requiredMet,
    optionalTotal: extra.optionalTotal,
    optionalMet: extra.optionalMet,
    requiredOk: extra.requiredOk,
    gradeLabel: grade.label,
    gradeId: grade.id,
    extra,
    breakdown: extra.rows.filter((r) => r.met),
  };
}

export { APLUS_SUM_TIERS };
