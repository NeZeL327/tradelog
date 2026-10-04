export const DAY_PLAN_STATUSES = ["draft", "ready", "active", "closed"];

export const DAY_PLAN_STATUS_LABELS = {
  draft: { pl: "Szkic", en: "Draft" },
  ready: { pl: "Gotowy", en: "Ready" },
  active: { pl: "W trakcie", en: "In progress" },
  closed: { pl: "Zamknięty", en: "Closed" },
};

export const MOOD_OPTIONS = [
  { id: "calm", pl: "Spokojny", en: "Calm" },
  { id: "focused", pl: "Skupiony", en: "Focused" },
  { id: "tired", pl: "Zmęczony", en: "Tired" },
];

export const DEFAULT_CHECKLIST = [
  { key: "calendar", pl: "Sprawdziłem kalendarz i newsy", en: "I checked the calendar and news" },
  { key: "levels", pl: "Wyznaczyłem poziomy", en: "I marked my levels" },
  { key: "risk", pl: "Znam maksymalne ryzyko", en: "I know my max risk" },
  { key: "setup", pl: "Setup jest potwierdzony", en: "Setup is confirmed" },
  { key: "focus", pl: "Jestem skupiony i trzymam się planu", en: "I am focused and sticking to the plan" },
];

export const PROCESS_GOALS = [
  { id: "stick_to_plan", pl: "Trzymać się planu", en: "Stick to the plan" },
  { id: "one_setup", pl: "Tylko jeden setup", en: "Only one setup" },
  { id: "no_revenge", pl: "Bez revenge tradingu", en: "No revenge trading" },
  { id: "journal", pl: "Notować każdą decyzję", en: "Journal every decision" },
];

export function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function todayIso(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftIsoDate(iso, days) {
  const [y, m, d] = String(iso).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return todayIso(dt);
}

export function formatIsoDisplay(iso, locale = "pl-PL") {
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function planDocId(accountId, date) {
  return `${String(accountId)}_${String(date)}`;
}

export function defaultChecklist(language = "pl") {
  return DEFAULT_CHECKLIST.map((item) => ({
    id: createId(),
    text: language === "en" ? item.en : item.pl,
    done: false,
    custom: false,
  }));
}

export function emptyDayPlan({ accountId, date, language = "pl" }) {
  return {
    account_id: String(accountId || ""),
    date: String(date || todayIso()),
    status: "draft",
    template_id: null,
    template_name: "",
    pre_session: {
      market_context: "",
      scenario_levels: "",
      watchlist: "",
      avoid_today: "",
    },
    checklist: defaultChecklist(language),
    parameters: {
      trade_limit: 3,
      max_risk_percent: 1,
      process_goal: "stick_to_plan",
      extra_rules: "",
    },
    session_notes: [],
    post_session: {
      went_well: "",
      improve_next: "",
      mood: "",
      discipline: null,
    },
  };
}

export function planToTemplatePayload(plan, name) {
  return {
    name: String(name || "Szablon").trim().slice(0, 80),
    pre_session: {
      market_context: plan?.pre_session?.market_context || "",
      scenario_levels: plan?.pre_session?.scenario_levels || "",
      watchlist: plan?.pre_session?.watchlist || "",
      avoid_today: plan?.pre_session?.avoid_today || "",
    },
    checklist: (plan?.checklist || []).map((item) => ({
      id: createId(),
      text: String(item.text || ""),
      done: false,
      custom: !!item.custom,
    })),
    parameters: {
      trade_limit: Number(plan?.parameters?.trade_limit) || 0,
      max_risk_percent: Number(plan?.parameters?.max_risk_percent) || 0,
      process_goal: plan?.parameters?.process_goal || "stick_to_plan",
      extra_rules: plan?.parameters?.extra_rules || "",
    },
  };
}

export function applyTemplateToPlan(plan, template) {
  return {
    ...plan,
    template_id: template.id || null,
    template_name: template.name || "",
    pre_session: {
      market_context: template.pre_session?.market_context || "",
      scenario_levels: template.pre_session?.scenario_levels || "",
      watchlist: template.pre_session?.watchlist || "",
      avoid_today: template.pre_session?.avoid_today || "",
    },
    checklist: (template.checklist || []).map((item) => ({
      id: createId(),
      text: String(item.text || ""),
      done: false,
      custom: !!item.custom,
    })),
    parameters: {
      trade_limit: Number(template.parameters?.trade_limit) || 0,
      max_risk_percent: Number(template.parameters?.max_risk_percent) || 0,
      process_goal: template.parameters?.process_goal || "stick_to_plan",
      extra_rules: template.parameters?.extra_rules || "",
    },
  };
}

export function planHasContent(plan) {
  if (!plan) return false;
  const pre = plan.pre_session || {};
  if (Object.values(pre).some((v) => String(v || "").trim())) return true;
  if ((plan.checklist || []).some((item) => item.done || item.custom)) return true;
  if ((plan.session_notes || []).length) return true;
  const post = plan.post_session || {};
  if (String(post.went_well || "").trim() || String(post.improve_next || "").trim()) return true;
  if (post.mood || post.discipline != null) return true;
  const params = plan.parameters || {};
  if (String(params.extra_rules || "").trim()) return true;
  return false;
}

export function validatePlanParameters(parameters) {
  const errors = [];
  const limit = Number(parameters?.trade_limit);
  const risk = Number(parameters?.max_risk_percent);
  if (!Number.isFinite(limit) || limit < 0 || limit > 100) {
    errors.push("limit");
  }
  if (!Number.isFinite(risk) || risk < 0 || risk > 100) {
    errors.push("risk");
  }
  return errors;
}
