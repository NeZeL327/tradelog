import { pickContextualQuote, pickDailyQuote } from "@/lib/quotes";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";

export default function QuoteLine({ stats, variant = "page", className }) {
  const { language } = useLanguage();
  const text = stats ? pickContextualQuote(language, stats) : pickDailyQuote(language);

  if (variant === "sidebar") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-white/10 bg-black/45 px-3 py-2.5",
          className
        )}
      >
        <img
          src="/sidebar-mountains.png"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45"
        />
        <div className="relative">
          <p className="text-[12px] leading-snug text-white/90 italic">
            “{text}”
          </p>
          <span className="mt-2 block h-0.5 w-8 rounded-full bg-primary" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative max-w-sm overflow-hidden rounded-lg border border-border bg-card px-3 py-2.5",
        className
      )}
    >
      <span className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-full bg-primary" aria-hidden />
      <p className="pl-3 text-[13px] leading-snug text-muted-foreground italic">“{text}”</p>
    </div>
  );
}
