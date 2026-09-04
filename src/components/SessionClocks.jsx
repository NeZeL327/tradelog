import { useEffect, useState } from "react";
import { loadLocalUserSettings } from "@/lib/userSettings";

const CLOCKS = [
  { id: "pl", label: "PL", zone: "Europe/Warsaw", title: "Polska (Warszawa)" },
  { id: "ny", label: "NY", zone: "America/New_York", title: "Nowy Jork (NY session)" },
  { id: "asia", label: "ASIA", zone: "Asia/Tokyo", title: "Asia / Tokyo session" },
];

function formatTime(date, timeZone, use12h) {
  try {
    return new Intl.DateTimeFormat(use12h ? "en-US" : "pl-PL", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: use12h,
    }).format(date);
  } catch {
    return "--:--:--";
  }
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
      className="hidden sm:flex items-center gap-1.5 md:gap-2 mr-1"
      aria-label="Godziny sesji tradingowych"
    >
      {CLOCKS.map((clock) => (
        <div
          key={clock.id}
          title={clock.title}
          className="flex flex-col items-center leading-none px-2 md:px-2.5 py-1.5 rounded-md border border-border/60 bg-muted/40 min-w-[5rem]"
        >
          <span className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {clock.label}
          </span>
          <span className="text-sm md:text-[15px] font-mono font-semibold tabular-nums text-foreground mt-1">
            {formatTime(now, clock.zone, prefs.use12h)}
          </span>
        </div>
      ))}
    </div>
  );
}
