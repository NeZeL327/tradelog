import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { updateUser } from "@/lib/localStorage";

const themes = [
  { value: "light", label: "LIGHT", skin: "default" },
  { value: "dark", label: "DARK", skin: "blackblu" }
];

const applyThemeToDocument = (theme) => {
  document.documentElement.classList.remove("dark");
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  }
};

const applySkinToDocument = (skin) => {
  document.documentElement.setAttribute("data-skin", skin);
};

export default function ThemeToggle({ className = "" }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState(() => {
    // Initialize from localStorage or user preference
    const saved = localStorage.getItem("appTheme");
    if (saved) return saved;
    return user?.theme || "dark";
  });

  // Apply theme when component mounts and theme changes
  useEffect(() => {
    applyThemeToDocument(theme);
    const skin = theme === "dark" ? "blackblu" : "default";
    applySkinToDocument(skin);
    localStorage.setItem("appTheme", theme);
  }, [theme]);

  // Sync to user profile when user changes (but don't reset local theme)
  useEffect(() => {
    if (user?.id && user?.theme !== theme) {
      try {
        updateUser(user.id, { theme, skin: theme === "dark" ? "blackblu" : "default" });
      } catch (error) {
        console.error("Theme update error:", error);
      }
    }
  }, [user?.id]);

  const handleThemeChange = (nextTheme) => {
    const normalizedTheme = nextTheme === "dark" ? "dark" : "light";
    setTheme(normalizedTheme);
    // Don't call checkSession - just update local state
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-slate-200 bg-white/80 text-slate-700 backdrop-blur-sm p-1 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-100",
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
              "h-7 px-2 text-[11px] font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white",
              isActive && "bg-slate-900/10 text-slate-900 dark:bg-white/15 dark:text-white"
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
