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
          <p className="font-mono text-[12px] font-medium leading-snug tracking-[0.01em] text-white/90 not-italic">
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
        "relative max-w-md overflow-hidden rounded-md border border-border bg-card px-3 py-2",
        className
      )}
    >
      <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary" aria-hidden />
      <p className="pl-3 font-mono text-[12px] font-medium leading-snug tracking-[0.01em] text-foreground/90 not-italic">“{text}”</p>
    </div>
  );
}
