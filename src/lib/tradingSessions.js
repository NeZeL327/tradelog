/** Shared session windows — same logic as SessionClocks / SessionRhythmBar. */

export const TRADING_SESSIONS = [
  {
    id: "asia",
    clockId: "asia",
    zone: "Asia/Tokyo",
    startHour: 0,
    endHour: 9,
    labelPl: "Azja",
    labelEn: "Asia",
    rolePl: "kontekst",
    roleEn: "context",
  },
  {
    id: "london",
    clockId: "ldn",
    zone: "Europe/London",
    startHour: 8,
    endHour: 17,
    labelPl: "London",
    labelEn: "London",
    rolePl: null,
    roleEn: null,
  },
  {
    id: "ny",
    clockId: "ny",
    zone: "America/New_York",
    startHour: 9,
    endHour: 16,
    labelPl: "NY",
    labelEn: "NY",
    rolePl: null,
    roleEn: null,
  },
];

export function zoneHour(now, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === "hour")?.value);
    return Number.isFinite(h) && h >= 0 && h <= 23 ? h : -1;
  } catch {
    return -1;
  }
}

export function formatSessionRange(session) {
  if (!session) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(session.startHour)}:00 – ${pad(session.endHour)}:00`;
}

export function isSessionOpenNow(session, now = new Date()) {
  if (!session) return false;
  const hour = zoneHour(now, session.zone);
  if (hour < 0) return false;
  return hour >= session.startHour && hour < session.endHour;
}

/** Priority matches previous bar: London → NY → Asia. */
export function getActiveTradingSession(now = new Date()) {
  const order = ["london", "ny", "asia"];
  for (const id of order) {
    const session = TRADING_SESSIONS.find((s) => s.id === id);
    if (session && isSessionOpenNow(session, now)) return session;
  }
  return null;
}

export function getSessionById(id) {
  return TRADING_SESSIONS.find((s) => s.id === id) || null;
}

export function resolvePlanSessionId(activeOrClockId) {
  if (!activeOrClockId) return "london";
  if (activeOrClockId === "ldn") return "london";
  if (["asia", "london", "ny"].includes(activeOrClockId)) return activeOrClockId;
  return "london";
}
