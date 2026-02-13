import React from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";

const languages = [
  { code: "pl", label: "PL" },
  { code: "en", label: "EN" }
];

export default function LanguageToggle({ className = "" }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-slate-200 bg-white/80 text-slate-700 backdrop-blur-sm p-1 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-100",
        className
      )}
      role="group"
      aria-label="Language"
    >
      {languages.map((lang) => {
        const isActive = language === lang.code;
        return (
          <Button
            key={lang.code}
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setLanguage(lang.code)}
            className={cn(
              "h-7 px-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white",
              isActive && "bg-slate-900/10 text-slate-900 dark:bg-white/15 dark:text-white"
            )}
            aria-pressed={isActive}
          >
            {lang.label}
          </Button>
        );
      })}
    </div>
  );
}
