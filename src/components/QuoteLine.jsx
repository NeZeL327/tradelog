import { pickContextualQuote, pickDailyQuote } from "@/lib/quotes";
import { useLanguage } from "@/components/LanguageProvider";
import { cn } from "@/lib/utils";
import { Quote } from "lucide-react";

export default function QuoteLine({ stats, variant = "page", className }) {
  const { language } = useLanguage();
  const text = stats ? pickContextualQuote(language, stats) : pickDailyQuote(language);

  if (variant === "sidebar") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-primary/20 bg-black/45 px-3 py-2.5",
          className
        )}
      >
        <img
          src="/sidebar-mountains.png"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45"
        />
        <div className="relative">
          <Quote className="w-3.5 h-3.5 text-primary mb-1.5" />
          <p className="text-[12px] leading-snug text-white/90 italic">
            “{text}”
          </p>
          <span className="mt-2 block h-0.5 w-8 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative max-w-sm overflow-hidden rounded-xl border border-primary/30 bg-card px-3.5 py-2.5",
        className
      )}
    >
      <span className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" aria-hidden />
      <p className="pl-3 text-[13px] leading-snug text-foreground/80 italic">“{text}”</p>
    </div>
  );
}
