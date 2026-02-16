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
        "inline-flex items-center rounded-full border border-slate-700 bg-slate-800/80 text-slate-100 backdrop-blur-sm p-1 shadow-sm",
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
              "h-7 px-2 text-xs font-semibold text-slate-300 hover:text-white",
              isActive && "bg-white/15 text-white"
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
