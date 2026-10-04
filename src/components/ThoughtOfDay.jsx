import { useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/LanguageProvider";
import { pickDailyQuote } from "@/lib/quotes";
import { cn } from "@/lib/utils";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hiddenStorageKey() {
  return `aikeep_quote_hidden_${todayKey()}`;
}

function savedStorageKey() {
  return `aikeep_quote_saved_${todayKey()}`;
}

export default function ThoughtOfDay() {
  const { t, language } = useLanguage();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(hiddenStorageKey()) === "1";
    } catch {
      return false;
    }
  });
  const [saved, setSaved] = useState(() => {
    try {
      return localStorage.getItem(savedStorageKey()) === "1";
    } catch {
      return false;
    }
  });

  const quote = useMemo(() => pickDailyQuote(language === "en" ? "en" : "pl"), [language]);

  useEffect(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const saveQuote = async () => {
    try {
      localStorage.setItem(savedStorageKey(), "1");
      localStorage.setItem(`aikeep_quote_text_${todayKey()}`, quote);
      setSaved(true);
      try {
        await navigator.clipboard.writeText(quote);
      } catch {
        /* clipboard optional — persistence is primary */
      }
      toast.success(t("quoteSaved") || "Cytat zapisany");
    } catch {
      toast.error(t("quoteSaveError") || "Nie udało się zapisać cytatu");
    }
  };

  const hideToday = () => {
    try {
      localStorage.setItem(hiddenStorageKey(), "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
    setOpen(false);
  };

  const showAgain = () => {
    try {
      localStorage.removeItem(hiddenStorageKey());
    } catch {
      /* ignore */
    }
    setHidden(false);
  };

  return (
    <div ref={rootRef} className="relative flex items-center">
      <button
        type="button"
        aria-label={t("thoughtOfDay") || "Myśl dnia"}
        title={t("thoughtOfDay") || "Myśl dnia"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 transition-colors",
          open ? "bg-sky-500/15 text-sky-300" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
        )}
      >
        <Lightbulb className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span className="hidden max-w-[4.5rem] truncate text-[10px] font-medium lg:inline">
          {t("thoughtOfDay") || "Myśl dnia"}
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t("thoughtOfDay") || "Myśl dnia"}
          className="absolute bottom-[calc(100%+10px)] left-0 z-[80] w-[min(280px,calc(100vw-2rem))] rounded-xl border border-border/60 bg-[hsl(222_28%_9%)] p-3 shadow-xl"
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-300/90">
            {t("thoughtOfDay") || "Myśl dnia"}
          </p>
          {hidden ? (
            <div className="space-y-2">
              <p className="text-[12px] text-muted-foreground">
                {t("quoteHiddenToday") || "Ukryte na dziś"}
              </p>
              <button
                type="button"
                onClick={showAgain}
                className="text-[12px] font-medium text-sky-300 hover:underline"
              >
                {t("quoteShowAgain") || "Pokaż ponownie"}
              </button>
            </div>
          ) : (
            <>
              <p className="text-[13px] leading-snug text-foreground/90">“{quote}”</p>
              {saved ? (
                <p className="mt-2 text-[11px] text-sky-300/90">{t("quoteSaved") || "Zapisano"}</p>
              ) : null}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveQuote}
                  className="rounded-md bg-sky-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950 hover:bg-sky-400"
                >
                  {t("quoteSave") || "Zapisz"}
                </button>
                <button
                  type="button"
                  onClick={hideToday}
                  className="rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground"
                >
                  {t("quoteHideToday") || "Ukryj na dziś"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
