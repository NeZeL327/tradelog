import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Calculator,
  Crosshair,
  ExternalLink,
  GripHorizontal,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  Pin,
  PinOff,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";
import {
  APLUS_SCORE_GROUPS,
  APLUS_STORAGE_KEY,
  APLUS_SUM_TIERS,
  evaluateAPlusSum,
  formatPoints,
  pointsToneClass,
  sumToneClass,
  loadAPlusSelection,
  saveAPlusSelection,
  sumAPlusPoints,
  toggleAPlusOption,
  emptyAPlusSelection,
} from "@/lib/aPlusConfigScore";
import {
  M1_MASTERY_OPTIONS,
  M1_STORAGE_KEY,
  formatM1Points,
  loadM1Selection,
  saveM1Selection,
  sumM1Points,
  toggleM1Option,
  emptyM1Selection,
} from "@/lib/m1MasteryScore";

export const FLOATING_CALC_EVENT = "floating-calculator:open";
export const FLOATING_CALC_CLOSE_EVENT = "floating-calculator:close";

const STORAGE_KEY = "aikeeptrade_floating_calc_v1";
const MIN_W = 300;
const MIN_H = 360;
const DEFAULT_W = 380;
const DEFAULT_H = 520;

const VERDICT_BOX = {
  rose: "border-loss/30 bg-loss/10 text-loss dark:text-loss",
  amber: "border-amber-300/80 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  emerald: "border-profit/30 bg-profit/10 text-profit dark:text-profit",
  orange: "border-orange-300/80 bg-orange-500/15 text-orange-900 dark:text-orange-200",
};

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function defaultGeometry() {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  return {
    x: Math.max(16, vw - DEFAULT_W - 24),
    y: Math.max(16, vh - DEFAULT_H - 24),
    w: DEFAULT_W,
    h: DEFAULT_H,
  };
}

function loadUiState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        open: false,
        minimized: false,
        alwaysOnTop: true,
        kind: "aplus",
        ...defaultGeometry(),
      };
    }
    const parsed = JSON.parse(raw);
    const geo = defaultGeometry();
    return {
      open: Boolean(parsed.open),
      minimized: Boolean(parsed.minimized),
      alwaysOnTop: parsed.alwaysOnTop !== false,
      kind: parsed.kind === "m1" ? "m1" : "aplus",
      x: Number.isFinite(parsed.x) ? parsed.x : geo.x,
      y: Number.isFinite(parsed.y) ? parsed.y : geo.y,
      w: Number.isFinite(parsed.w) ? clamp(parsed.w, MIN_W, 900) : geo.w,
      h: Number.isFinite(parsed.h) ? clamp(parsed.h, MIN_H, 900) : geo.h,
    };
  } catch {
    return {
      open: false,
      minimized: false,
      alwaysOnTop: true,
      kind: "aplus",
      ...defaultGeometry(),
    };
  }
}

function saveUiState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function openFloatingCalculator(kind = "aplus") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(FLOATING_CALC_EVENT, { detail: { kind: kind === "m1" ? "m1" : "aplus" } })
  );
}

/** Open floating calculator and enter Document Picture-in-Picture. */
export function openFloatingCalculatorPip(kind = "aplus") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(FLOATING_CALC_EVENT, {
      detail: { kind: kind === "m1" ? "m1" : "aplus", pip: true },
    })
  );
}

const POPUP_WINDOW_NAME = "aikeeptrade_calculator_popup";

/** Absolute popup URL — same origin, works after deploy and locally. */
export function getCalculatorPopupUrl(kind = "aplus") {
  const k = kind === "m1" ? "m1" : "aplus";
  const path = createPageUrl("CalculatorPopup");
  if (typeof window === "undefined") return `${path}?kind=${k}`;
  return `${window.location.origin}${path}?kind=${k}`;
}

/** Separate browser window — works in Brave when switching to TradingView. */
export function openCalculatorPopupWindow(kind = "aplus") {
  if (typeof window === "undefined") return null;
  const url = getCalculatorPopupUrl(kind);
  const features = [
    "popup=yes",
    "width=420",
    "height=680",
    "left=60",
    "top=60",
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");
  let win = window.open(url, POPUP_WINDOW_NAME, features);
  // Fallback without features (some Brave shields block feature-string popups)
  if (!win) {
    win = window.open(url, POPUP_WINDOW_NAME);
  }
  if (!win) {
    toast.error(
      "Brave zablokował wyskakujące okno. Kliknij ikonę tarczy → zezwól na popupy dla tej strony, potem kliknij ponownie."
    );
    return null;
  }
  try {
    win.focus();
  } catch {
    /* ignore */
  }
  toast.success("Osobne okno otwarte — przejdź na TradingView; kalkulator zostaje w tym oknie.");
  return win;
}

function isDocumentPipSupported() {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

function copyStylesToPip(pipDoc) {
  [...document.styleSheets].forEach((styleSheet) => {
    try {
      const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join("");
      const style = pipDoc.createElement("style");
      style.textContent = cssRules;
      pipDoc.head.appendChild(style);
    } catch {
      if (!styleSheet.href) return;
      const link = pipDoc.createElement("link");
      link.rel = "stylesheet";
      link.href = styleSheet.href;
      pipDoc.head.appendChild(link);
    }
  });

  const isDark = document.documentElement.classList.contains("dark");
  pipDoc.documentElement.classList.toggle("dark", isDark);
  pipDoc.documentElement.style.height = "100%";
  pipDoc.documentElement.style.margin = "0";
  pipDoc.body.style.margin = "0";
  pipDoc.body.style.height = "100%";
  pipDoc.body.style.overflow = "hidden";
  pipDoc.body.style.background = "hsl(var(--card))";
  pipDoc.body.style.color = "hsl(var(--card-foreground))";
}

function CompactAPlusBody() {
  const [selection, setSelection] = useState(() => loadAPlusSelection());
  const { total, breakdown } = useMemo(() => sumAPlusPoints(selection), [selection]);
  const verdict = useMemo(() => evaluateAPlusSum(total), [total]);

  useEffect(() => {
    const sync = (e) => {
      if (e?.detail?.kind && e.detail.kind !== "aplus") return;
      setSelection(loadAPlusSelection());
    };
    const onStorage = (e) => {
      if (e.key === APLUS_STORAGE_KEY) setSelection(loadAPlusSelection());
    };
    window.addEventListener("aikeeptrade-calc-changed", sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("aikeeptrade-calc-changed", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = (groupId, optionId) => {
    setSelection((prev) => {
      const next = toggleAPlusOption(prev, groupId, optionId);
      saveAPlusSelection(next);
      return next;
    });
  };

  const reset = () => {
    const empty = emptyAPlusSelection();
    saveAPlusSelection(empty);
    setSelection(empty);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 shrink-0">
        <div
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
            VERDICT_BOX[verdict.tone] || VERDICT_BOX.rose
          )}
        >
          <span>{verdict.emoji}</span>
          <span>{verdict.label}</span>
          <span className={cn("tabular-nums opacity-90", sumToneClass(total))}>· {total}</span>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] gap-1" onClick={reset}>
          <RotateCcw className="w-3 h-3" />
          Reset
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5 space-y-2">
        {APLUS_SCORE_GROUPS.map((group) => {
          const selected = selection[group.id] || [];
          return (
            <div key={group.id} className="space-y-0.5">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
                {group.title}
              </p>
              <ul className="space-y-0">
                {group.options.map((opt) => {
                  const checked = selected.includes(opt.id);
                  return (
                    <li key={opt.id}>
                      <label
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-1 py-0.5 cursor-pointer text-[11px] leading-tight",
                          checked ? "bg-primary/10" : "hover:bg-muted/50"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => update(group.id, opt.id)}
                          className="h-3 w-3"
                        />
                        <span className="flex-1 truncate text-slate-800 dark:text-slate-200">{opt.label}</span>
                        <span className={cn("tabular-nums text-[9px] shrink-0", pointsToneClass(opt.points))}>
                          {formatPoints(opt.points)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-border/60 px-2.5 py-1.5 space-y-1 bg-muted/20">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Suma</span>
          <span className={cn("text-xl font-bold tabular-nums leading-none", sumToneClass(total))}>{total}</span>
        </div>
        <div className="grid grid-cols-2 gap-0.5">
          {APLUS_SUM_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={cn(
                "rounded px-1 py-0.5 text-[9px] border",
                verdict.id === tier.id ? VERDICT_BOX[tier.tone] : "border-transparent text-muted-foreground"
              )}
            >
              {tier.emoji} {tier.label}
            </div>
          ))}
        </div>
        {breakdown.length > 0 && (
          <p className="text-[9px] text-muted-foreground truncate">
            {breakdown.length} zaznaczonych
          </p>
        )}
      </div>
    </div>
  );
}

function CompactM1Body() {
  const [selection, setSelection] = useState(() => loadM1Selection());
  const { total, breakdown } = useMemo(() => sumM1Points(selection), [selection]);
  const verdict = useMemo(() => evaluateAPlusSum(total), [total]);

  useEffect(() => {
    const sync = (e) => {
      if (e?.detail?.kind && e.detail.kind !== "m1") return;
      setSelection(loadM1Selection());
    };
    const onStorage = (e) => {
      if (e.key === M1_STORAGE_KEY) setSelection(loadM1Selection());
    };
    window.addEventListener("aikeeptrade-calc-changed", sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("aikeeptrade-calc-changed", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = (optionId) => {
    setSelection((prev) => {
      const next = toggleM1Option(prev, optionId);
      saveM1Selection(next);
      return next;
    });
  };

  const reset = () => {
    const empty = emptyM1Selection();
    saveM1Selection(empty);
    setSelection(empty);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 shrink-0">
        <div
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
            VERDICT_BOX[verdict.tone] || VERDICT_BOX.rose
          )}
        >
          <span>{verdict.emoji}</span>
          <span>{verdict.label}</span>
          <span className={cn("tabular-nums opacity-90", sumToneClass(total))}>· {total}</span>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] gap-1" onClick={reset}>
          <RotateCcw className="w-3 h-3" />
          Reset
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5 space-y-0">
        {M1_MASTERY_OPTIONS.map((opt) => {
          const checked = selection.includes(opt.id);
          return (
            <label
              key={opt.id}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1 py-0.5 cursor-pointer text-[11px] leading-tight",
                checked ? "bg-primary/10" : "hover:bg-muted/50"
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => update(opt.id)}
                className="h-3 w-3"
              />
              <span className="flex-1 min-w-0">
                <span className="font-semibold text-foreground">{opt.code}</span>
                <span className="text-slate-700 dark:text-slate-300"> — {opt.label}</span>
              </span>
              <span className={cn("tabular-nums text-[9px] shrink-0", pointsToneClass(opt.points))}>
                {formatM1Points(opt.points)}
              </span>
            </label>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-border/60 px-2.5 py-1.5 space-y-1 bg-muted/20">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Suma</span>
          <span className={cn("text-xl font-bold tabular-nums leading-none", sumToneClass(total))}>{total}</span>
        </div>
        <div className="grid grid-cols-2 gap-0.5">
          {APLUS_SUM_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={cn(
                "rounded px-1 py-0.5 text-[9px] border",
                verdict.id === tier.id ? VERDICT_BOX[tier.tone] : "border-transparent text-muted-foreground"
              )}
            >
              {tier.emoji} {tier.label}
            </div>
          ))}
        </div>
        {breakdown.length > 0 && (
          <p className="text-[9px] text-muted-foreground truncate">{breakdown.length} zaznaczonych EM</p>
        )}
      </div>
    </div>
  );
}

export default function FloatingCalculator() {
  const [ui, setUi] = useState(() => loadUiState());
  const [pipWindow, setPipWindow] = useState(null);
  const [pipRoot, setPipRoot] = useState(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const pipSupported = isDocumentPipSupported();

  const persist = useCallback((patch) => {
    setUi((prev) => {
      const next = { ...prev, ...patch };
      saveUiState(next);
      return next;
    });
  }, []);

  const closePip = useCallback(() => {
    try {
      pipWindow?.close?.();
    } catch {
      /* ignore */
    }
    setPipWindow(null);
    setPipRoot(null);
  }, [pipWindow]);

  const openPip = useCallback(async () => {
    if (!isDocumentPipSupported()) {
      toast.error("Picture-in-Picture niedostępne w tej przeglądarce. Użyj przycisku „Osobne okno”.");
      return;
    }
    if (window.documentPictureInPicture.window) {
      toast.info("Okienko PiP jest już otwarte.");
      return;
    }
    try {
      const pip = await window.documentPictureInPicture.requestWindow({
        width: Math.round(ui.w || DEFAULT_W),
        height: Math.round(ui.h || DEFAULT_H),
        disallowReturnToOpener: false,
      });
      copyStylesToPip(pip.document);
      const root = pip.document.createElement("div");
      root.id = "aikeeptrade-pip-calc";
      root.style.width = "100%";
      root.style.height = "100%";
      root.style.display = "flex";
      root.style.flexDirection = "column";
      pip.document.body.appendChild(root);

      const onHide = () => {
        setPipWindow(null);
        setPipRoot(null);
      };
      pip.addEventListener("pagehide", onHide);

      setPipWindow(pip);
      setPipRoot(root);
      persist({ open: true, minimized: false });
      toast.success("Kalkulator przypięty nad innymi oknami. Zostaw kartę AiKeepTrade otwartą w tle.");
    } catch (err) {
      console.error(err);
      toast.error("Nie udało się otworzyć PiP. Kliknij ponownie po interakcji ze stroną.");
    }
  }, [persist, ui.h, ui.w]);

  useEffect(() => {
    const onOpen = (event) => {
      const kind = event?.detail?.kind === "m1" ? "m1" : "aplus";
      const wantPip = Boolean(event?.detail?.pip);
      persist({ open: true, minimized: false, kind });
      if (wantPip) openPip();
    };
    const onClose = () => {
      closePip();
      persist({ open: false });
    };
    window.addEventListener(FLOATING_CALC_EVENT, onOpen);
    window.addEventListener(FLOATING_CALC_CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(FLOATING_CALC_EVENT, onOpen);
      window.removeEventListener(FLOATING_CALC_CLOSE_EVENT, onClose);
    };
  }, [closePip, openPip, persist]);

  useEffect(() => {
    const onMove = (e) => {
      if (pipRoot) return;
      if (dragRef.current) {
        const { startX, startY, origX, origY } = dragRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const maxX = window.innerWidth - 80;
        const maxY = window.innerHeight - 40;
        persist({
          x: clamp(origX + dx, -ui.w + 80, maxX),
          y: clamp(origY + dy, 0, maxY),
        });
      }
      if (resizeRef.current) {
        const { startX, startY, origW, origH } = resizeRef.current;
        const nextW = clamp(origW + (e.clientX - startX), MIN_W, Math.min(900, window.innerWidth - 16));
        const nextH = clamp(origH + (e.clientY - startY), MIN_H, Math.min(900, window.innerHeight - 16));
        persist({ w: nextW, h: nextH });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [persist, pipRoot, ui.w]);

  useEffect(() => () => {
    try {
      window.documentPictureInPicture?.window?.close?.();
    } catch {
      /* ignore */
    }
  }, []);

  if (typeof document === "undefined") return null;

  const inPip = Boolean(pipRoot);
  const zClass = ui.alwaysOnTop ? "z-[220]" : "z-[60]";

  const panel = (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-card text-card-foreground",
        inPip ? "h-full w-full rounded-none border-0 shadow-none" : "rounded-xl border border-border shadow-2xl h-full"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1.5 border-b border-border/70 select-none shrink-0",
          !inPip && "cursor-grab active:cursor-grabbing",
          "bg-muted/40"
        )}
        onPointerDown={(e) => {
          if (inPip) return;
          if (e.button !== 0) return;
          if (e.target.closest("button")) return;
          document.body.style.userSelect = "none";
          dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: ui.x,
            origY: ui.y,
          };
        }}
      >
        {!inPip && <GripHorizontal className="w-4 h-4 text-muted-foreground shrink-0" />}
        {ui.kind === "m1" ? (
          <Crosshair className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <Calculator className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="text-[11px] font-semibold truncate flex-1">
          {ui.kind === "m1" ? "M1 MASTERY" : "Konfiguracja A+"}
          {inPip ? " · PiP" : ""}
        </span>

        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Otwórz w osobnym oknie (działa z TradingView / Brave)"
            onClick={() => openCalculatorPopupWindow(ui.kind)}
          >
            <ExternalLink className="w-3.5 h-3.5 text-profit" />
          </Button>
          {pipSupported && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={inPip ? "Zamknij Picture-in-Picture" : "Picture-in-Picture — okno nad innymi aplikacjami"}
              onClick={() => {
                if (inPip) closePip();
                else openPip();
              }}
            >
              <PictureInPicture2 className={cn("w-3.5 h-3.5", inPip && "text-primary")} />
            </Button>
          )}
          {!inPip && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title={ui.alwaysOnTop ? "Wyłącz zawsze na wierzchu (w aplikacji)" : "Zawsze na wierzchu (w aplikacji)"}
                onClick={() => persist({ alwaysOnTop: !ui.alwaysOnTop })}
              >
                {ui.alwaysOnTop ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title={ui.minimized ? "Rozwiń" : "Zwiń"}
                onClick={() => persist({ minimized: !ui.minimized })}
              >
                {ui.minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Zamknij"
            onClick={() => {
              closePip();
              persist({ open: false });
            }}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {(inPip || !ui.minimized) && (
        <>
          {!inPip && (
            <div className="px-2 py-1.5 border-b border-border bg-muted/30 shrink-0 space-y-1.5">
              <p className="text-[10px] leading-snug text-muted-foreground">
                <strong>Picture-in-Picture:</strong> ikona{" "}
                <PictureInPicture2 className="inline w-3 h-3" /> w belce — okno unosi się nad TradingView.
              </p>
              {pipSupported && (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 w-full text-[11px] gap-1.5"
                  onClick={() => openPip()}
                >
                  <PictureInPicture2 className="w-3.5 h-3.5" />
                  Włącz Picture-in-Picture
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 w-full text-[11px] gap-1.5"
                onClick={() => openCalculatorPopupWindow(ui.kind)}
              >
                <ExternalLink className="w-3.5 h-3.5 text-profit" />
                Albo osobne okno
              </Button>
            </div>
          )}
          <div className="flex gap-1 px-2 py-1.5 border-b border-border/50 bg-muted/20 shrink-0">
            <button
              type="button"
              className={cn(
                "flex-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition",
                ui.kind === "aplus"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              )}
              onClick={() => persist({ kind: "aplus" })}
            >
              A+
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition",
                ui.kind === "m1"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              )}
              onClick={() => persist({ kind: "m1" })}
            >
              M1
            </button>
          </div>

          <div className="flex-1 min-h-0 relative">
            {ui.kind === "m1" ? <CompactM1Body /> : <CompactAPlusBody />}
          </div>

          {!inPip && (
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                document.body.style.userSelect = "none";
                resizeRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  origW: ui.w,
                  origH: ui.h,
                };
              }}
              title="Zmień rozmiar"
            >
              <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-r-2 border-b-2 border-muted-foreground/50" />
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      {createPortal(
        <>
          {!ui.open && !inPip && (
            <button
              type="button"
              onClick={() => persist({ open: true, minimized: false })}
              className={cn(
                "fixed bottom-4 right-4 h-11 w-11 rounded-full shadow-lg border border-border",
                "bg-card text-foreground hover:bg-muted transition flex items-center justify-center",
                "z-[55]"
              )}
              title="Otwórz kalkulator"
              aria-label="Otwórz kalkulator"
            >
              <Calculator className="w-5 h-5 text-muted-foreground" />
            </button>
          )}

          {ui.open && !inPip && (
            <div
              className={cn("fixed", zClass, ui.minimized ? "h-auto" : "")}
              style={{
                left: ui.x,
                top: ui.y,
                width: ui.w,
                height: ui.minimized ? "auto" : ui.h,
              }}
            >
              {panel}
            </div>
          )}
        </>,
        document.body
      )}

      {inPip && pipRoot ? createPortal(panel, pipRoot) : null}
    </>
  );
}
