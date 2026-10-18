import { createPageUrl } from "@/utils";

export const DEFAULT_DOCK_KEYS = [
  "dashboard",
  "journal",
  "calendar",
  "analytics",
  "backtesting",
  "strategies",
];

export const ALL_NAV_ITEMS = [
  { key: "dashboard", titleKey: "dashboard", fallbackTitle: "Dashboard", url: createPageUrl("Dashboard"), iconName: "LayoutDashboard", group: "trading" },
  { key: "journal", titleKey: "journal", fallbackTitle: "Dziennik", url: createPageUrl("Journal"), iconName: "BookOpen", group: "trading" },
  { key: "calendar", titleKey: "calendar", fallbackTitle: "Kalendarz", url: createPageUrl("Calendar"), iconName: "Calendar", group: "trading" },
  { key: "trade", titleKey: "tradeDetails", fallbackTitle: "Trade details", url: "/trade", iconName: "CandlestickChart", group: "analysis" },
  { key: "analytics", titleKey: "analytics", fallbackTitle: "Analityka", url: createPageUrl("Analytics"), iconName: "BarChart3", group: "analysis" },
  { key: "backtesting", titleKey: "backtesting", fallbackTitle: "Backtesting", url: createPageUrl("Backtesting"), iconName: "FlaskConical", group: "analysis" },
  { key: "strategies", titleKey: "strategies", fallbackTitle: "Strategie", url: createPageUrl("Strategies"), iconName: "Brain", group: "analysis" },
  { key: "calculators", titleKey: "calculators", fallbackTitle: "Kalkulatory", url: createPageUrl("Calculators"), iconName: "Calculator", group: "tools" },
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
