import { createPageUrl } from "@/utils";

export const DEFAULT_DOCK_KEYS = [
  "dashboard",
  "journal",
  "dayplan",
  "calendar",
  "analytics",
  "backtesting",
  "strategies",
];

export const ALL_NAV_ITEMS = [
  { key: "dashboard", titleKey: "dashboard", fallbackTitle: "Dashboard", url: createPageUrl("Dashboard"), iconName: "LayoutDashboard", group: "trading" },
  { key: "journal", titleKey: "journal", fallbackTitle: "Dziennik", url: createPageUrl("Journal"), iconName: "BookOpen", group: "trading" },
  { key: "dayplan", titleKey: "dayPlan", fallbackTitle: "Plan dnia", url: createPageUrl("DayPlan"), iconName: "CalendarCheck2", group: "trading" },
  { key: "calendar", titleKey: "calendar", fallbackTitle: "Kalendarz", url: createPageUrl("Calendar"), iconName: "Calendar", group: "trading" },
  { key: "planned", titleKey: "plannedTrades", fallbackTitle: "Planowane", url: createPageUrl("Planned"), iconName: "ListTodo", group: "trading" },
  { key: "missed", titleKey: "missedTrades", fallbackTitle: "Opóźnione", url: createPageUrl("Missed"), iconName: "AlarmClockOff", group: "trading" },
  { key: "trade", titleKey: "tradeDetails", fallbackTitle: "Trade details", url: "/trade", iconName: "CandlestickChart", group: "analysis" },
  { key: "analytics", titleKey: "analytics", fallbackTitle: "Analityka", url: createPageUrl("Analytics"), iconName: "BarChart3", group: "analysis" },
  { key: "backtesting", titleKey: "backtesting", fallbackTitle: "Backtesting", url: createPageUrl("Backtesting"), iconName: "FlaskConical", group: "analysis" },
  { key: "strategies", titleKey: "strategies", fallbackTitle: "Strategie", url: createPageUrl("Strategies"), iconName: "Brain", group: "analysis" },
  { key: "goals", titleKey: "goals", fallbackTitle: "Cele", url: createPageUrl("Goals"), iconName: "Target", group: "analysis" },
  { key: "calculators", titleKey: "calculators", fallbackTitle: "Kalkulatory", url: createPageUrl("Calculators"), iconName: "Calculator", group: "tools" },
  { key: "notes", titleKey: "notes", fallbackTitle: "Notatki", url: createPageUrl("Notes"), iconName: "NotebookPen", group: "workspace" },
  { key: "reports", titleKey: "reports", fallbackTitle: "Raporty", url: createPageUrl("Raporty"), iconName: "FileBarChart", group: "workspace" },
  { key: "processReview", titleKey: "processReview", fallbackTitle: "Przegląd procesu", url: createPageUrl("ProcessReview"), iconName: "ClipboardList", group: "workspace" },
  { key: "checklist", titleKey: "notesChecklists", fallbackTitle: "Checklisty", url: createPageUrl("Checklist"), iconName: "ListChecks", group: "workspace" },
  { key: "accounts", titleKey: "accounts", fallbackTitle: "Konta", url: createPageUrl("Accounts"), iconName: "Wallet", group: "account" },
  { key: "billing", titleKey: "billing", fallbackTitle: "Subskrypcja", url: createPageUrl("Billing"), iconName: "CreditCard", group: "account" },
  { key: "settings", titleKey: "settings", fallbackTitle: "Ustawienia", url: createPageUrl("Settings"), iconName: "Settings", group: "account" },
];

const MAX_DOCK = 9;

function storageKey(userId) {
  return `aikeep_dock_shortcuts_${userId || "guest"}`;
}

export function loadDockShortcuts(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [...DEFAULT_DOCK_KEYS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_DOCK_KEYS];
    const valid = new Set(ALL_NAV_ITEMS.map((item) => item.key));
    const keys = parsed.map(String).filter((key) => valid.has(key));
    return keys.length ? keys.slice(0, MAX_DOCK) : [...DEFAULT_DOCK_KEYS];
  } catch {
    return [...DEFAULT_DOCK_KEYS];
  }
}

export function saveDockShortcuts(userId, keys) {
  const valid = new Set(ALL_NAV_ITEMS.map((item) => item.key));
  const next = [...new Set((keys || []).map(String).filter((key) => valid.has(key)))].slice(0, MAX_DOCK);
  localStorage.setItem(storageKey(userId), JSON.stringify(next.length ? next : DEFAULT_DOCK_KEYS));
  return next.length ? next : [...DEFAULT_DOCK_KEYS];
}

export function resolveDockItems(t, shortcutKeys) {
  const byKey = Object.fromEntries(ALL_NAV_ITEMS.map((item) => [item.key, item]));
  const keys = (shortcutKeys?.length ? shortcutKeys : DEFAULT_DOCK_KEYS).filter((key) => byKey[key]);
  const primary = keys.map((key) => {
    const item = byKey[key];
    return {
      ...item,
      title: t(item.titleKey) || item.fallbackTitle,
    };
  });
  const primarySet = new Set(keys);
  const more = ALL_NAV_ITEMS.filter((item) => !primarySet.has(item.key)).map((item) => ({
    ...item,
    title: t(item.titleKey) || item.fallbackTitle,
  }));
  return { primary, more };
}

export const DOCK_MAX = MAX_DOCK;
