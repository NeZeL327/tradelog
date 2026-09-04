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
        "inline-flex h-8 items-center rounded-md border p-0.5 overflow-hidden",
        isDark ? "border-border bg-background" : "border-input bg-background",
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
            onClick={() => {
              if (!isActive) setLanguage(lang.code);
            }}
            className={cn(
              "h-7 rounded-sm px-2 text-xs font-semibold",
                isDark
                ? "text-white/70 hover:text-white"
                : "text-muted-foreground hover:text-foreground",
              isActive
                ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.45)]"
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
