import { emptyPosition } from "@/lib/calculatorMath";
import { DEFAULT_GRADES, emptyCondition, uid } from "@/lib/calculatorScoring";

export const HUB_STORAGE_KEY = "aikeeptrade_calculator_hub_v1";
const TAB_STORAGE_KEY = "aikeeptrade_calculators_tab_v1";
const HUB_EVENT = "aikeeptrade-calc-hub-changed";

export const MATH_CALCULATORS = [
  {
    id: "position-size",
    name: "Position Size Calculator",
    description: "Wielkość pozycji z salda, ryzyka i odległości SL.",
    category: "Risk",
  },
  {
    id: "risk-reward",
    name: "Risk / Reward",
    description: "Stosunek ryzyka do zysku z Entry / SL / TP.",
    category: "Risk",
  },
  {
    id: "break-even",
    name: "Break Even",
    description: "Cena BE po prowizji i kosztach.",
    category: "Risk",
  },
  {
    id: "profit",
    name: "Profit Calculator",
    description: "Zysk / strata z przebiegu ceny.",
    category: "Core",
  },
  {
    id: "tp-sl",
    name: "Take Profit / Stop Loss",
    description: "Poziomy TP i SL z R:R i pipsów.",
    category: "Risk",
  },
];

export const ELEMENT_TYPES = [
  { id: "number", label: "Pole liczbowe" },
  { id: "text", label: "Pole tekstowe" },
  { id: "checkbox", label: "Checkbox" },
  { id: "select", label: "Select" },
  { id: "multi", label: "Multi-select" },
  { id: "time", label: "Time" },
  { id: "timeRange", label: "Time range" },
  { id: "condition", label: "Warunek" },
  { id: "scoring", label: "Scoring" },
  { id: "result", label: "Wynik" },
  { id: "risk", label: "Risk" },
  { id: "position", label: "Position Size" },
  { id: "rr", label: "R:R" },
  { id: "note", label: "Notatka" },
  { id: "separator", label: "Separator / sekcja" },
];

export const ICON_OPTIONS = [
  "ListChecks",
  "Crosshair",
  "Calculator",
  "Target",
  "Flame",
  "Star",
  "Clock3",
  "Droplets",
  "MapPin",
  "TrendingUp",
  "Wallet",
  "Percent",
];

function emptyHub() {
  return {
    version: 1,
    selectedId: "aplus",
    defaultId: "aplus",
    favorites: { aplus: true },
    custom: [],
    templates: [],
    extras: {},
    runtime: {},
    math: {},
  };
}

function migrateSelectedFromTab(hub) {
  try {
    const tab = localStorage.getItem(TAB_STORAGE_KEY);
    if (!hub.selectedId || hub.selectedId === "aplus") {
      if (tab === "m1") hub.selectedId = "m1";
      if (tab === "aplus") hub.selectedId = "aplus";
    }
  } catch {
    /* ignore */
  }
  return hub;
}

export function loadHub() {
  try {
    const raw = localStorage.getItem(HUB_STORAGE_KEY);
    if (!raw) return migrateSelectedFromTab(emptyHub());
    const parsed = JSON.parse(raw);
    const base = emptyHub();
    return migrateSelectedFromTab({
      ...base,
      ...parsed,
      favorites: { ...base.favorites, ...(parsed.favorites || {}) },
      custom: Array.isArray(parsed.custom) ? parsed.custom : [],
      templates: Array.isArray(parsed.templates) ? parsed.templates : [],
      extras: parsed.extras && typeof parsed.extras === "object" ? parsed.extras : {},
      runtime: parsed.runtime && typeof parsed.runtime === "object" ? parsed.runtime : {},
      math: parsed.math && typeof parsed.math === "object" ? parsed.math : {},
    });
  } catch {
    return emptyHub();
  }
}

export function saveHub(hub) {
  try {
    localStorage.setItem(HUB_STORAGE_KEY, JSON.stringify(hub));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(HUB_EVENT));
    }
  } catch {
    /* ignore */
  }
  return hub;
}

export function patchHub(mutator) {
  const next = mutator(loadHub()) || loadHub();
  return saveHub(next);
}

export function subscribeHub(onChange) {
  const handler = () => onChange(loadHub());
  window.addEventListener(HUB_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(HUB_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function getExtra(hub, id) {
  return hub.extras?.[id] || {
    name: "",
    description: "",
    notes: "",
    images: [],
    conditions: [],
    elements: [],
    grades: null,
  };
}

export function setExtra(hub, id, extra) {
  return {
    ...hub,
    extras: { ...hub.extras, [id]: extra },
  };
}

export function getRuntime(hub, id) {
  const cur = hub.runtime?.[id] || {};
  return {
    values: cur.values || {},
    position: { ...emptyPosition(), ...(cur.position || {}) },
    tab: cur.tab || "conditions",
  };
}

export function setRuntime(hub, id, runtime) {
  return {
    ...hub,
    runtime: { ...hub.runtime, [id]: runtime },
  };
}

export function getMathState(hub, id) {
  return hub.math?.[id] || {};
}

export function setMathState(hub, id, state) {
  return {
    ...hub,
    math: { ...hub.math, [id]: state },
  };
}

export function emptyElement(type = "number") {
  return {
    id: uid("el"),
    type,
    name: "",
    description: "",
    icon: "",
    defaultValue: "",
    unit: "",
    min: "",
    max: "",
    required: false,
    points: 0,
    passValue: "",
    timeframe: "",
    visible: true,
    options: [],
  };
}

export function emptyCustomCalculator(partial = {}) {
  return {
    id: uid("calc"),
    name: "Nowy kalkulator",
    description: "",
    icon: "Calculator",
    category: "Setup",
    favorite: false,
    accent: "",
    conditions: [],
    elements: [],
    grades: DEFAULT_GRADES.map((g) => ({ ...g })),
    notes: "",
    images: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...partial,
  };
}

export function isMathId(id) {
  return MATH_CALCULATORS.some((c) => c.id === id);
}

export function isBuiltinSetup(id) {
  return id === "aplus" || id === "m1";
}

export function findCustom(hub, id) {
  return (hub.custom || []).find((c) => c.id === id) || null;
}

export function displayName(hub, id) {
  if (id === "aplus") return getExtra(hub, "aplus").name || "Konfiguracja A+";
  if (id === "m1") return getExtra(hub, "m1").name || "M1 MASTERY";
  const math = MATH_CALCULATORS.find((c) => c.id === id);
  if (math) return math.name;
  return findCustom(hub, id)?.name || id;
}

export function exportHubPayload(hub) {
  return {
    type: "aikeeptrade-calculator-hub",
    version: 1,
    exportedAt: new Date().toISOString(),
    custom: (hub.custom || []).map((c) => ({
      ...c,
      images: [],
    })),
    templates: hub.templates || [],
    extras: Object.fromEntries(
      Object.entries(hub.extras || {}).map(([key, extra]) => [
        key,
        { ...extra, images: [] },
      ])
    ),
    favorites: hub.favorites || {},
    defaultId: hub.defaultId,
  };
}

export function importHubPayload(hub, payload) {
  if (!payload || payload.type !== "aikeeptrade-calculator-hub") {
    throw new Error("Nieprawidłowy plik kalkulatorów.");
  }
  const incoming = Array.isArray(payload.custom) ? payload.custom : [];
  const mapped = incoming.map((item) => ({
    ...emptyCustomCalculator(),
    ...item,
    id: uid("calc"),
    name: String(item.name || "Import").trim() || "Import",
    images: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
  const templates = Array.isArray(payload.templates) ? payload.templates : [];
  return {
    ...hub,
    custom: [...(hub.custom || []), ...mapped],
    templates: [...(hub.templates || []), ...templates.map((t) => ({ ...t, id: uid("tpl") }))],
  };
}

export function snapshotAsTemplate(calc, name) {
  return {
    id: uid("tpl"),
    name: name || `${calc.name} — szablon`,
    calculator: {
      name: calc.name,
      description: calc.description,
      icon: calc.icon,
      category: calc.category,
      accent: calc.accent,
      conditions: calc.conditions || [],
      elements: calc.elements || [],
      grades: calc.grades || DEFAULT_GRADES,
      notes: calc.notes || "",
    },
    createdAt: Date.now(),
  };
}

export function calculatorFromTemplate(template) {
  const src = template?.calculator || {};
  return emptyCustomCalculator({
    name: src.name || template.name || "Z szablonu",
    description: src.description || "",
    icon: src.icon || "Calculator",
    category: src.category || "Setup",
    accent: src.accent || "",
    conditions: Array.isArray(src.conditions)
      ? src.conditions.map((c) => emptyCondition({ ...c, id: uid("cond") }))
      : [],
    elements: Array.isArray(src.elements)
      ? src.elements.map((e) => ({ ...emptyElement(e.type), ...e, id: uid("el") }))
      : [],
    grades: Array.isArray(src.grades) ? src.grades.map((g) => ({ ...g })) : DEFAULT_GRADES.map((g) => ({ ...g })),
    notes: src.notes || "",
  });
}
