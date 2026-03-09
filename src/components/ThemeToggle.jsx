import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { updateUser } from "@/lib/localStorage";

const APP_THEME_EVENT = "app-theme-changed";

const themes = [
  { value: "light", label: "LIGHT" },
  { value: "dark", label: "DARK" }
];

const normalizeTheme = (value) => (value === "dark" ? "dark" : value === "light" ? "light" : null);

const resolveTheme = (user) => {
  const savedTheme = normalizeTheme(localStorage.getItem("appTheme"));
  if (savedTheme) return savedTheme;

  const profileTheme = normalizeTheme(user?.theme);
  if (profileTheme) return profileTheme;

  return document.documentElement.classList.contains("dark") ? "dark" : "light";
};

const applyThemeToDocument = (theme) => {
  const root = document.documentElement;
  root.classList.remove("dark");
  if (theme === "dark") {
    root.classList.add("dark");
  }
  root.setAttribute("data-skin", theme === "dark" ? "blackblu" : "default");
  localStorage.setItem("appTheme", theme);
  localStorage.setItem("appSkin", theme === "dark" ? "blackblu" : "default");
};

export default function ThemeToggle({ className = "" }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState(() => resolveTheme(user));

  useEffect(() => {
    const nextTheme = resolveTheme(user);
    setTheme((prev) => (prev === nextTheme ? prev : nextTheme));
  }, [user?.id, user?.theme]);

  useEffect(() => {
    applyThemeToDocument(theme);
    window.dispatchEvent(new CustomEvent(APP_THEME_EVENT, { detail: { theme } }));
  }, [theme]);

  useEffect(() => {
    const handleThemeEvent = (event) => {
      const nextTheme = normalizeTheme(event?.detail?.theme);
      if (nextTheme && nextTheme !== theme) {
        setTheme(nextTheme);
      }
    };

    window.addEventListener(APP_THEME_EVENT, handleThemeEvent);
    return () => {
      window.removeEventListener(APP_THEME_EVENT, handleThemeEvent);
    };
  }, [theme]);

  useEffect(() => {
    if (user?.id && user?.theme !== theme) {
      try {
        updateUser(user.id, {
          theme,
          skin: theme === "dark" ? "blackblu" : "default"
        });
      } catch (error) {
        console.error("Theme update error:", error);
      }
    }
  }, [user?.id, user?.theme, theme]);

  const handleThemeChange = (nextTheme) => {
    const normalizedTheme = nextTheme === "dark" ? "dark" : "light";
    if (normalizedTheme !== theme) {
      setTheme(normalizedTheme);
    }
  };

  return (
    <div
      className={cn(
        "inline-flex h-8 items-center rounded-md border border-input bg-background p-0.5 shadow-sm overflow-hidden",
        className
      )}
      role="group"
      aria-label="Theme"
    >
      {themes.map((entry) => {
        const isActive = theme === entry.value;
        return (
          <Button
            key={entry.value}
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => handleThemeChange(entry.value)}
            className={cn(
              "h-7 rounded-sm px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground",
              isActive && "bg-accent text-foreground"
            )}
            aria-pressed={isActive}
          >
            {entry.label}
          </Button>
        );
      })}
    </div>
  );
}
