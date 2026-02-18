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
        "inline-flex h-8 items-center rounded-md border border-input bg-background p-0.5 shadow-sm overflow-hidden",
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
              "h-7 rounded-sm px-2 text-xs font-semibold text-muted-foreground hover:text-foreground",
              isActive && "bg-accent text-foreground"
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
