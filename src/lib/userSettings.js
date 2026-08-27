const LOCAL_KEY = "appUserSettings_v1";

export const DEFAULT_USER_SETTINGS = Object.freeze({
  language: "pl",
  theme: "auto",
  default_currency: "USD",
  /** Strefa, w której POKAZUJEMY godziny w dzienniku / dashboardzie */
  timezone: "Europe/Warsaw",
  /**
   * Strefa, w której ZAPISANE są godziny w trade'ach (CSV/broker/formularz).
   * Domyślnie Warsaw — istniejące ręczne wpisy bez przesunięcia.
   * Import UTC → ustaw "UTC". Serwer MT4 GMT+2 → "Etc/GMT-2".
   */
  trade_time_source: "Europe/Warsaw",
  date_format: "YYYY-MM-DD",
  time_format: "24h", // "24h" | "12h"
  show_session_clocks: true,
  notifications_enabled: true,
  show_weekends: false,
  privacy_mode: false,
  start_page: "/Dashboard",
  pnl_view: "money",
  /** Custom entry-condition chips; null/undefined → DEFAULT_CONFLUENCES */
  trade_confluences: null,
  /** Custom mistake chips; null/undefined → DEFAULT_MISTAKES */
  trade_mistakes: null,
});

export const TIMEZONE_OPTIONS = Object.freeze([
  { value: "UTC", label: "UTC" },
  { value: "Europe/Warsaw", label: "Europa/Warszawa (Polska)" },
  { value: "Europe/London", label: "Europa/Londyn" },
  { value: "America/New_York", label: "Ameryka/Nowy Jork" },
  { value: "Asia/Tokyo", label: "Azja/Tokio" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
  { value: "Etc/GMT-2", label: "Broker GMT+2 (częsty MT4/MT5)" },
  { value: "Etc/GMT-3", label: "Broker GMT+3" },
]);

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
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("user-settings-changed"));
    }
    return picked;
  } catch {
    return {};
  }
}

/** Reset browser prefs so a new Firebase user does not inherit another account's local state. */
export function resetLocalSessionForFreshUser() {
  try {
    const defaults = { ...DEFAULT_USER_SETTINGS };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(defaults));
    localStorage.setItem("appTheme", defaults.theme === "auto" ? "dark" : defaults.theme);
    localStorage.setItem("appLanguage", defaults.language || "pl");
    localStorage.removeItem("appSkin");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("user-settings-changed"));
    }
  } catch {
    /* ignore */
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
  const nextTheme = theme === "dark" || theme === "light" || theme === "auto" ? theme : "auto";
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

export function formatTradeDate(dateStr, format) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  switch (format) {
    case "DD/MM/YYYY": return `${d}/${m}/${y}`;
    case "MM/DD/YYYY": return `${m}/${d}/${y}`;
    case "DD.MM.YYYY": return `${d}.${m}.${y}`;
    default: return dateStr;
  }
}

export function getDateFormat() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.date_format) return s.date_format;
    }
  } catch {}
  return DEFAULT_USER_SETTINGS.date_format;
}

export function getDisplayTimezone() {
  try {
    const s = loadLocalUserSettings();
    if (s.timezone) return s.timezone;
  } catch {}
  return DEFAULT_USER_SETTINGS.timezone;
}

export function getTradeTimeSource() {
  try {
    const s = loadLocalUserSettings();
    if (s.trade_time_source) return s.trade_time_source;
  } catch {}
  return DEFAULT_USER_SETTINGS.trade_time_source;
}

export function getTimeFormat() {
  try {
    const s = loadLocalUserSettings();
    if (s.time_format === "12h" || s.time_format === "24h") return s.time_format;
  } catch {}
  return DEFAULT_USER_SETTINGS.time_format;
}

function normalizeTimeString(timeStr) {
  if (!timeStr && timeStr !== 0) return "";
  const raw = String(timeStr).trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return raw.slice(0, 8);
  const hh = String(Math.min(23, Number(match[1]))).padStart(2, "0");
  const mm = String(Math.min(59, Number(match[2]))).padStart(2, "0");
  const ss = match[3] != null ? String(Math.min(59, Number(match[3]))).padStart(2, "0") : null;
  return ss != null ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}

function getZonedParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** Interpret YYYY-MM-DD + HH:mm[:ss] as wall clock in `timeZone` → UTC Date */
export function zonedWallTimeToDate(dateStr, timeStr, timeZone) {
  if (!dateStr || !timeStr) return null;
  const dateMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return null;
  const norm = normalizeTimeString(timeStr);
  const timeMatch = norm.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!timeMatch) return null;

  const y = Number(dateMatch[1]);
  const mo = Number(dateMatch[2]);
  const d = Number(dateMatch[3]);
  const h = Number(timeMatch[1]);
  const mi = Number(timeMatch[2]);
  const s = timeMatch[3] != null ? Number(timeMatch[3]) : 0;

  const utcGuess = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const offset1 = getTimeZoneOffsetMs(utcGuess, timeZone);
  let instant = new Date(utcGuess.getTime() - offset1);
  const offset2 = getTimeZoneOffsetMs(instant, timeZone);
  if (offset2 !== offset1) {
    instant = new Date(utcGuess.getTime() - offset2);
  }
  return instant;
}

function formatPartsTime(parts, use12h) {
  if (use12h) {
    const h24 = parts.hour;
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")} ${ampm}`;
  }
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
}

/**
 * Convert trade wall time from source zone → display zone.
 * When zones match, returns as-is (no shift) — bezpieczne dla istniejących danych PL.
 */
export function convertTradeDateTime(dateStr, timeStr, {
  fromZone = getTradeTimeSource(),
  toZone = getDisplayTimezone(),
  timeFormat = getTimeFormat(),
} = {}) {
  const normTime = normalizeTimeString(timeStr);
  if (!normTime) {
    return { date: dateStr || "", time: "" };
  }
  if (!dateStr) {
    const t = normTime.length === 5 ? `${normTime}:00` : normTime;
    return { date: "", time: t };
  }

  const withSeconds = normTime.length === 5 ? `${normTime}:00` : normTime;

  if (!fromZone || !toZone || fromZone === toZone) {
    if (timeFormat !== "12h") {
      return { date: dateStr, time: withSeconds };
    }
    const instant = zonedWallTimeToDate(dateStr, withSeconds, fromZone || "UTC");
    if (!instant) return { date: dateStr, time: withSeconds };
    return { date: dateStr, time: formatPartsTime(getZonedParts(instant, fromZone || "UTC"), true) };
  }

  const instant = zonedWallTimeToDate(dateStr, withSeconds, fromZone);
  if (!instant || Number.isNaN(instant.getTime())) {
    return { date: dateStr, time: withSeconds };
  }
  const parts = getZonedParts(instant, toZone);
  const date = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const time = formatPartsTime(parts, timeFormat === "12h");
  return { date, time };
}

/** Display-only helper for entry/exit clocks in UI */
export function formatTradeClock(trade, which = "entry") {
  const source = getTradeTimeSource();
  const display = getDisplayTimezone();
  const timeFormat = getTimeFormat();

  if (which === "exit") {
    const date = trade?.close_date || trade?.date || "";
    const time = trade?.exit_time || "";
    if (!time) return "";
    const converted = convertTradeDateTime(date, time, { fromZone: source, toZone: display, timeFormat });
    return converted.time
      ? (timeFormat === "12h" ? converted.time : String(converted.time).slice(0, 8))
      : "";
  }

  const date = trade?.date || "";
  const time = trade?.entry_time || trade?.open_time || trade?.time || "";
  if (!time) return "";
  const converted = convertTradeDateTime(date, time, { fromZone: source, toZone: display, timeFormat });
  return converted.time
    ? (timeFormat === "12h" ? converted.time : String(converted.time).slice(0, 8))
    : "";
}

/** Date for display that may shift when converting across midnight */
export function formatTradeClockDate(trade, which = "entry", dateFormat = getDateFormat()) {
  const source = getTradeTimeSource();
  const display = getDisplayTimezone();
  const timeFormat = getTimeFormat();

  if (which === "exit") {
    const date = trade?.close_date || trade?.date || "";
    const time = trade?.exit_time || "";
    if (!date) return "";
    if (!time) return formatTradeDate(date, dateFormat);
    const converted = convertTradeDateTime(date, time, { fromZone: source, toZone: display, timeFormat });
    return formatTradeDate(converted.date || date, dateFormat);
  }

  const date = trade?.date || "";
  const time = trade?.entry_time || trade?.open_time || trade?.time || "";
  if (!date) return "";
  if (!time) return formatTradeDate(date, dateFormat);
  const converted = convertTradeDateTime(date, time, { fromZone: source, toZone: display, timeFormat });
  return formatTradeDate(converted.date || date, dateFormat);
}

/** Hour 0-23 in display timezone — for Analytics hour buckets */
export function getTradeEntryHour(trade) {
  const date = trade?.date || "";
  const time = trade?.entry_time || trade?.open_time || trade?.time || "";
  if (!time) return null;
  // Always 24h so "01:30 PM" does not become hour 1
  const converted = convertTradeDateTime(date, time, { timeFormat: "24h" });
  const match = String(converted.time || "").match(/^(\d{1,2}):/);
  if (!match) return null;
  const h = Number(match[1]);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null;
}

/** Minutes from midnight (0–1439) for entry clocks */
export function getTradeEntryMinutes(trade) {
  const date = trade?.date || "";
  const time = trade?.entry_time || trade?.open_time || trade?.time || "";
  if (!time) return null;
  const converted = convertTradeDateTime(date, time, { timeFormat: "24h" });
  const match = String(converted.time || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const min = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function applyRuntimeSettings(settings) {
  applyTheme(settings?.theme);
  document.documentElement.classList.toggle("privacy-mode", !!settings?.privacy_mode);
  document.documentElement.setAttribute(
    "data-pnl-view",
    settings?.pnl_view === "percent" ? "percent" : "money"
  );
}
