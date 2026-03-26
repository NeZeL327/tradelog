const LOCAL_KEY = "appUserSettings_v1";

export const DEFAULT_USER_SETTINGS = Object.freeze({
  language: "pl",
  theme: "auto",
  default_currency: "USD",
  timezone: "Europe/Warsaw",
  date_format: "YYYY-MM-DD",
  notifications_enabled: true,
  show_weekends: false,
  privacy_mode: false,  // blur sensitive numbers (inspired by TradeZella Privacy View)
  start_page: "/Dashboard", // inspired by TradesViz custom home page
  pnl_view: "money",   // "money" | "percent" (inspired by TradeZella Dollars/Percentage View)
});

const SETTINGS_KEYS = Object.freeze(Object.keys(DEFAULT_USER_SETTINGS));

export function pickUserSettings(value) {
  const out = {};
  if (!value || typeof value !== "object") return out;
  for (const k of SETTINGS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, k) && value[k] !== undefined) {
      out[k] = value[k];
    }
  }
  return out;
}

export function loadLocalUserSettings() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    return pickUserSettings(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveLocalUserSettings(settings) {
  try {
    const picked = pickUserSettings(settings);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(picked));
    return picked;
  } catch {
    return {};
  }
}

export function getEffectiveUserSettings({ cloudSettings, localSettings } = {}) {
  return {
    ...DEFAULT_USER_SETTINGS,
    ...(pickUserSettings(localSettings) || {}),
    ...(pickUserSettings(cloudSettings) || {}),
  };
}

export function getMissingCloudSettings({ cloudSettings, localSettings } = {}) {
  const cloud = pickUserSettings(cloudSettings);
  const local = pickUserSettings(localSettings);
  const missing = {};
  for (const k of SETTINGS_KEYS) {
    if (cloud[k] === undefined && local[k] !== undefined) {
      missing[k] = local[k];
    }
  }
  return missing;
}

export function applyTheme(theme) {
  const root = document.documentElement;
  const nextTheme = theme || "light";
  const shouldBeDark =
    nextTheme === "dark" ||
    (nextTheme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  root.classList.toggle("dark", shouldBeDark);
  root.removeAttribute("data-skin");

  if (nextTheme === "auto") {
    localStorage.removeItem("appTheme");
  } else {
    localStorage.setItem("appTheme", nextTheme);
  }
  localStorage.removeItem("appSkin");
}

export function applyRuntimeSettings(settings) {
  applyTheme(settings?.theme);
  document.documentElement.classList.toggle("privacy-mode", !!settings?.privacy_mode);
  document.documentElement.setAttribute(
    "data-pnl-view",
    settings?.pnl_view === "percent" ? "percent" : "money"
  );
}
