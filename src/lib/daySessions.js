// Godziny sesji i kill zone dla strony "Dzień" — JEDNO miejsce do zmiany.
// Każde okno jest zapisane w strefie "kotwicy" (giełda / ICT liczy w czasie Nowego Jorku)
// i przeliczane na czas polski dla konkretnej daty. Dzięki temu zmiana czasu letniego/zimowego
// (w UE i USA w różnych tygodniach) liczy się sama.

export const DAY_TZ = "Europe/Warsaw";

export const SESSION_WINDOWS = [
  {
    id: "asia",
    name: "Azja",
    anchorZone: "Asia/Tokyo",
    from: "09:00",
    to: "17:00",
    hint: "Kontekst: zakres i płynność",
    killZone: null,
  },
  {
    id: "london",
    name: "Londyn",
    anchorZone: "Europe/London",
    from: "08:00",
    to: "16:30",
    killZone: { name: "Londynu", anchorZone: "America/New_York", from: "02:00", to: "05:00" },
  },
  {
    id: "ny",
    name: "Nowy Jork",
    anchorZone: "America/New_York",
    from: "08:30",
    to: "16:00",
    killZone: { name: "Nowego Jorku", anchorZone: "America/New_York", from: "07:00", to: "10:00" },
  },
];

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
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
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
    const kz = s.killZone ? { name: s.killZone.name, ...windowFor(dateIso, s.killZone) } : null;
    return {
      id: s.id,
      name: s.name,
      from: span.from,
      to: span.to,
      label: `${hhmmOf(span.from)} – ${hhmmOf(span.to)}`,
      hint: kz ? `Kill zone ${hhmmOf(kz.from)} – ${hhmmOf(kz.to)}` : s.hint,
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
