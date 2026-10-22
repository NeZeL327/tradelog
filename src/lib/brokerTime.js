/**
 * Broker server clock: IANA zone + a fixed hour shift (default America/New_York + 7h).
 * That follows US DST (GMT+2 winter, GMT+3 summer) without Europe/Athens or a constant offset.
 * Conversion uses Intl only — no DST tables, no I/O.
 */

export const DEFAULT_BROKER_TIME = Object.freeze({
  serverTimeZone: "America/New_York",
  serverOffsetHours: 7,
  userTimeZone: "Europe/Prague",
});

const YMD = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/;
const HMS = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function parseDateTime(dateStr, timeStr) {
  const d = YMD.exec(String(dateStr || "").trim());
  const t = HMS.exec(String(timeStr || "").trim().replace(/,/g, ":"));
  if (!d || !t) return null;
  const y = Number(d[1]);
  const mo = Number(d[2]);
  const day = Number(d[3]);
  const h = Number(t[1]);
  const mi = Number(t[2]);
  const s = Number(t[3] || 0);
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
  if (h > 23 || mi > 59 || s > 59) return null;
  return { y, mo, day, h, mi, s };
}

function shiftHours(parts, deltaHours) {
  const ms = Date.UTC(
    parts.y,
    parts.mo - 1,
    parts.day,
    parts.h + deltaHours,
    parts.mi,
    parts.s
  );
  const dt = new Date(ms);
  return {
    y: dt.getUTCFullYear(),
    mo: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
    h: dt.getUTCHours(),
    mi: dt.getUTCMinutes(),
    s: dt.getUTCSeconds(),
  };
}

function zoneParts(ms, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const map = {};
  for (const part of dtf.formatToParts(new Date(ms))) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const hour = Number(map.hour);
  return {
    y: Number(map.year),
    mo: Number(map.month),
    day: Number(map.day),
    h: hour === 24 ? 0 : hour,
    mi: Number(map.minute),
    s: Number(map.second),
  };
}

function partsToUtcMs(parts) {
  return Date.UTC(parts.y, parts.mo - 1, parts.day, parts.h, parts.mi, parts.s);
}

function tzOffsetMs(ms, timeZone) {
  return partsToUtcMs(zoneParts(ms, timeZone)) - ms;
}

function zonedTimeToUtcMs(parts, timeZone) {
  const asUtc = partsToUtcMs(parts);
  const guess = asUtc - tzOffsetMs(asUtc, timeZone);
  // Second pass: offset at the guessed instant (DST on that calendar date).
  return asUtc - tzOffsetMs(guess, timeZone);
}

function formatStored(parts) {
  return {
    date: `${parts.y}-${pad2(parts.mo)}-${pad2(parts.day)}`,
    time: `${pad2(parts.h)}:${pad2(parts.mi)}:${pad2(parts.s)}`,
  };
}

/**
 * Convert broker server wall clock to the user zone.
 * Returns `{ date, time }` in the same strings import stores (`YYYY-MM-DD`, `HH:MM:SS`).
 */
export function serverToLocal(dateStr, timeStr, opts = {}) {
  const parsed = parseDateTime(dateStr, timeStr);
  if (!parsed) return { date: "", time: "" };

  const serverTimeZone = opts.serverTimeZone || DEFAULT_BROKER_TIME.serverTimeZone;
  const serverOffsetHours = Number.isFinite(opts.serverOffsetHours)
    ? opts.serverOffsetHours
    : DEFAULT_BROKER_TIME.serverOffsetHours;
  const userTimeZone = opts.userTimeZone || DEFAULT_BROKER_TIME.userTimeZone;

  const nyWall = shiftHours(parsed, -serverOffsetHours);
  const utcMs = zonedTimeToUtcMs(nyWall, serverTimeZone);
  return formatStored(zoneParts(utcMs, userTimeZone));
}
