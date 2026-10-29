import { useEffect, useRef, useState } from "react";
import { loadLocalUserSettings } from "@/lib/userSettings";

// Trading day opens Asia, then London, then New York.
const CLOCKS = [
  { id: "asia", label: "ASIA", zone: "Asia/Tokyo", title: "Asia / Tokyo session" },
  { id: "ldn", label: "LDN", zone: "Europe/London", title: "London session" },
  { id: "ny", label: "NY", zone: "America/New_York", title: "New York session" },
];

function zoneHour(now, timeZone) {
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

function formatTime(date, timeZone, use12h) {
  try {
    // formatToParts avoids locale quirks (e.g. bogus "66:xx" on some Windows locales)
    if (use12h) {
      return new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date);
    }
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;
    if (!hour || !minute) return "--:--";
    const hNum = Number(hour);
    if (!Number.isFinite(hNum) || hNum < 0 || hNum > 23) return "--:--";
    return `${String(hNum).padStart(2, "0")}:${minute.padStart(2, "0")}`;
  } catch {
    return "--:--";
  }
}

function isSessionOpen(now, zone) {
  const hour = zoneHour(now, zone);
  if (hour < 0) return false;
  if (zone === "Europe/London") return hour >= 8 && hour < 17;
  if (zone === "America/New_York") return hour >= 9 && hour < 16;
  return hour >= 0 && hour < 9;
}

// Nowa minuta przenika (krótki fade); pierwsze wyświetlenie bez animacji.
function TickText({ value }) {
  const firstRef = useRef(value);
  return (
    <span key={value} className={firstRef.current === value ? undefined : "motion-value-swap"}>
      {value}
    </span>
  );
}

export default function SessionClocks() {
  const [now, setNow] = useState(() => new Date());
  const [prefs, setPrefs] = useState(() => {
    const local = loadLocalUserSettings();
    return {
      show: local.show_session_clocks !== false,
      use12h: local.time_format === "12h",
    };
  });

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const sync = () => {
      const local = loadLocalUserSettings();
      setPrefs({
        show: local.show_session_clocks !== false,
        use12h: local.time_format === "12h",
      });
    };
    window.addEventListener("storage", sync);
    window.addEventListener("user-settings-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("user-settings-changed", sync);
    };
  }, []);

  if (!prefs.show) return null;

  return (
    <div
      className="topbar-control hidden h-[32px] shrink-0 items-center rounded-full border border-ds-line bg-ds-s2 px-1.5 lg:flex"
      aria-label="Godziny sesji tradingowych"
    >
      {CLOCKS.map((clock, index) => {
        const open = isSessionOpen(now, clock.zone);
        return (
          <div key={clock.id} className="flex items-center">
            {index > 0 ? <span className="h-3.5 w-px shrink-0 bg-ds-line" aria-hidden /> : null}
            <div
              title={clock.title}
              className="flex items-center gap-1.5 px-2 py-0.5"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full transition-[background-color,box-shadow] duration-[var(--motion-slow)] ${
                  open ? "motion-pulse bg-ds-pos shadow-[0_0_6px_var(--ds-pos)]" : "bg-ds-text3 opacity-40"
                }`}
                aria-hidden
              />
              <span className={`text-[10px] font-medium uppercase tracking-[0.08em] ${open ? "text-ds-text2" : "text-ds-text3"}`}>
                {clock.label}
              </span>
              <span className={`data-mono text-[11px] tabular-nums ${open ? "font-medium text-ds-text" : "text-ds-text3"}`}>
                <TickText value={formatTime(now, clock.zone, prefs.use12h)} />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
