// Godziny sesji i kill zone dla strony "Dzień" — JEDNO miejsce do zmiany.
// Każde okno jest zapisane w strefie "kotwicy" (giełda / ICT liczy w czasie Nowego Jorku)
// i przeliczane na czas polski dla konkretnej daty. Dzięki temu zmiana czasu letniego/zimowego
// (w UE i USA w różnych tygodniach) liczy się sama.

export const DAY_TZ = "Europe/Warsaw";

export const SESSION_WINDOWS = [
  {
    id: "asia",
    name: "Azja",
    color: "#b48cff",
    anchorZone: "Asia/Tokyo",
    from: "09:00",
    to: "17:00",
    hint: "Kontekst: zakres i płynność",
    killZone: null,
  },
  {
    id: "london",
    name: "Londyn",
    color: "#6b7cf5",
    anchorZone: "Europe/London",
    from: "08:00",
    to: "16:30",
    killZone: { name: "Londynu", label: "Kill zone", anchorZone: "America/New_York", from: "02:00", to: "05:00" },
  },
  {
    id: "nyam",
    name: "NY AM",
    color: "#4fc3d9",
    anchorZone: "America/New_York",
    from: "08:30",
    to: "11:00",
    killZone: { name: "NY AM", label: "Kill zone", anchorZone: "America/New_York", from: "07:00", to: "10:00" },
  },
  {
    id: "nypm",
    name: "NY PM",
    color: "#f0a35b",
    anchorZone: "America/New_York",
    from: "13:30",
    to: "16:00",
    killZone: { name: "NY PM (power hour)", label: "Power hour", anchorZone: "America/New_York", from: "15:00", to: "16:00" },
  },
];

/** Gotowe zestawy sesji w kroku Plan. */
export const SESSION_PRESETS = [
  { label: "Tylko Londyn", ids: ["london"] },
  { label: "Londyn + NY AM", ids: ["london", "nyam"] },
  { label: "NY AM + PM", ids: ["nyam", "nypm"] },
  { label: "Cały dzień", ids: ["london", "nyam", "nypm"] },
];

const SESSION_ORDER = SESSION_WINDOWS.map((s) => s.id);
const LEGACY_SESSION_IDS = { ny: "nyam" };

/** Wybrane sesje dnia: nowe pole `sessions` (lista id), stare dni z `mapping_session` jako lista 1-elementowa. */
export function selectedSessionIds(doc) {
  const raw = Array.isArray(doc?.sessions) ? doc.sessions : doc?.mapping_session ? [doc.mapping_session] : [];
  const ids = raw.map((id) => LEGACY_SESSION_IDS[id] || id).filter((id) => SESSION_ORDER.includes(id));
  return SESSION_ORDER.filter((id) => ids.includes(id));
}

/** Pole `mapping_session` zostaje wypełnione pierwszą sesją, żeby stara strona dalej działała. */
export function legacyMappingSession(ids) {
  const first = ids[0];
  if (!first) return null;
  return first === "nyam" || first === "nypm" ? "ny" : first;
}

/** Podsumowanie wyboru: minuty na rynku (bez nakładania się), liczba kill zone, przerwy. */
export function sessionsSummary(sessions, ids) {
  const picked = sessions.filter((s) => ids.includes(s.id)).sort((a, b) => a.from - b.from);
  let minutes = 0;
  let end = -Infinity;
  const gaps = [];
  for (const s of picked) {
    if (end > -Infinity && s.from > end) gaps.push({ from: end, to: s.from });
    const start = Math.max(s.from, end);
    if (s.to > start) minutes += s.to - start;
    end = Math.max(end, s.to);
  }
  return {
    names: picked.map((s) => s.name).join(" + "),
    minutes,
    killZones: picked.filter((s) => s.killZone).length,
    gaps,
  };
}

/** Sesja, w której wypada wejście (od początku kill zone do końca sesji); null, gdy żadna. */
export function sessionOfMinute(sessions, minutes, ids = null) {
  const pool = ids ? sessions.filter((s) => ids.includes(s.id)) : sessions;
  return pool.find((s) => {
    const w = tradingWindow(s);
    return minutes >= w.from && minutes < w.to;
  }) || null;
}

/** Bieżąca albo najbliższa (lub ostatnia) z wybranych sesji — do licznika w kroku Handel. */
export function currentOrNextSession(sessions, ids, minutes) {
  const pool = sessions.filter((s) => ids.includes(s.id));
  if (!pool.length) return null;
  return pool.find((s) => minutes >= s.from && minutes < s.to) || pool.find((s) => s.from > minutes) || pool[pool.length - 1];
}

function zoneParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") % 24, minute: get("minute"), second: get("second") };
}

function offsetMs(date, timeZone) {
  const p = zoneParts(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

/** "YYYY-MM-DD" + "HH:MM" jako czas ścienny w `timeZone` → moment (Date). */
export function wallTimeToInstant(dateIso, hhmm, timeZone) {
  const [y, mo, d] = String(dateIso).split("-").map(Number);
  const [h, mi] = String(hhmm).split(":").map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi, 0));
  const first = offsetMs(guess, timeZone);
  let instant = new Date(guess.getTime() - first);
  const second = offsetMs(instant, timeZone);
  if (second !== first) instant = new Date(guess.getTime() - second);
  return instant;
}

function isoOf(p) {
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function dayDiff(aIso, bIso) {
  const a = Date.UTC(...aIso.split("-").map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))));
  const b = Date.UTC(...bIso.split("-").map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))));
  return Math.round((a - b) / 86400000);
}

/** Minuty od północy dnia `dateIso` w czasie polskim (może wyjść < 0 lub > 1440). */
export function warsawMinutesOf(instant, dateIso) {
  const p = zoneParts(instant, DAY_TZ);
  return dayDiff(isoOf(p), dateIso) * 1440 + p.hour * 60 + p.minute;
}

/** Teraz w czasie polskim: { dateIso, minutes }. */
export function nowInWarsaw(now = new Date()) {
  const p = zoneParts(now, DAY_TZ);
  return { dateIso: isoOf(p), minutes: p.hour * 60 + p.minute };
}

export function hhmmOf(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function durationLabel(minutes) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`;
}

function windowFor(dateIso, w) {
  return {
    from: warsawMinutesOf(wallTimeToInstant(dateIso, w.from, w.anchorZone), dateIso),
    to: warsawMinutesOf(wallTimeToInstant(dateIso, w.to, w.anchorZone), dateIso),
  };
}

/** Sesje i kill zone przeliczone na czas polski dla danej daty. */
export function sessionsForDate(dateIso) {
  return SESSION_WINDOWS.map((s) => {
    const span = windowFor(dateIso, s);
    const kz = s.killZone ? { name: s.killZone.name, label: s.killZone.label, ...windowFor(dateIso, s.killZone) } : null;
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      from: span.from,
      to: span.to,
      label: `${hhmmOf(span.from)} – ${hhmmOf(span.to)}`,
      hint: kz ? `${kz.label} ${hhmmOf(kz.from)} – ${hhmmOf(kz.to)}` : s.hint,
      killZone: kz,
    };
  });
}

/** Okno, w którym wolno handlować w wybranej sesji: od początku kill zone (albo sesji) do końca sesji. */
export function tradingWindow(session) {
  if (!session) return null;
  const from = session.killZone ? Math.min(session.killZone.from, session.from) : session.from;
  return { from, to: session.to };
}

export function sessionState(session, minutes) {
  if (minutes >= session.from && minutes < session.to) return "open";
  if (minutes < session.from && session.from - minutes <= 120) return "soon";
  return "off";
}
