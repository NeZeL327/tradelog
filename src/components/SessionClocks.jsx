import { useEffect, useState } from "react";
import { loadLocalUserSettings } from "@/lib/userSettings";

const CLOCKS = [
  { id: "ldn", label: "LDN", zone: "Europe/London", title: "London session" },
  { id: "ny", label: "NY", zone: "America/New_York", title: "New York session" },
  { id: "asia", label: "ASIA", zone: "Asia/Tokyo", title: "Asia / Tokyo session" },
];

function zoneHour(now, timeZone) {
  try {
    return Number(
      new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(now)
    );
  } catch {
    return -1;
  }
}

function formatTime(date, timeZone, use12h) {
  try {
    return new Intl.DateTimeFormat(use12h ? "en-US" : "pl-PL", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: use12h,
    }).format(date);
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
      className="hidden sm:flex items-center gap-1.5 mr-1"
      aria-label="Godziny sesji tradingowych"
    >
      {CLOCKS.map((clock) => {
        const open = isSessionOpen(now, clock.zone);
        return (
          <div
            key={clock.id}
            title={clock.title}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                open
                  ? "bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
                  : "bg-muted-foreground/40"
              }`}
              aria-hidden
            />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {clock.label}
            </span>
            <span className="text-[12px] font-medium tabular-nums text-foreground">
              {formatTime(now, clock.zone, prefs.use12h)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
