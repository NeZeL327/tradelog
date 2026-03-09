import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";

const languages = [
  { code: "pl", label: "PL" },
  { code: "en", label: "EN" }
];

export default function LanguageToggle({ className = "", variant = "light" }) {
  const { language, setLanguage } = useLanguage();
  const isDark = variant === "dark";

  return (
    <div
      className={cn(
        "inline-flex h-8 items-center rounded-md border p-0.5 shadow-sm overflow-hidden",
        isDark ? "border-slate-700/70 bg-slate-900/70" : "border-input bg-background",
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
              "h-7 rounded-sm px-2 text-xs font-semibold",
              isDark
                ? "text-slate-200 hover:text-white"
                : "text-muted-foreground hover:text-foreground",
              isActive
                ? isDark
                  ? "bg-slate-800 text-white"
                  : "bg-accent text-foreground"
                : null
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
