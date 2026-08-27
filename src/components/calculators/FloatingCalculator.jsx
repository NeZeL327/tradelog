import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Calculator,
  Crosshair,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
  RotateCcw,
  X,
} from "lucide-react";
import {
  APLUS_SCORE_GROUPS,
  APLUS_SUM_TIERS,
  evaluateAPlusSum,
  formatPoints,
  loadAPlusSelection,
  saveAPlusSelection,
  sumAPlusPoints,
  toggleAPlusOption,
  emptyAPlusSelection,
} from "@/lib/aPlusConfigScore";
import {
  M1_MASTERY_OPTIONS,
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
  rose: "border-rose-300/80 bg-rose-500/10 text-rose-800 dark:text-rose-200",
  amber: "border-amber-300/80 bg-amber-500/10 text-amber-900 dark:text-amber-200",
  emerald: "border-emerald-300/80 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
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

function CompactAPlusBody() {
  const [selection, setSelection] = useState(() => loadAPlusSelection());
  const { total, breakdown } = useMemo(() => sumAPlusPoints(selection), [selection]);
  const verdict = useMemo(() => evaluateAPlusSum(total), [total]);

  useEffect(() => {
    const sync = (e) => {
      if (e?.detail?.kind && e.detail.kind !== "aplus") return;
      setSelection(loadAPlusSelection());
    };
    window.addEventListener("aikeeptrade-calc-changed", sync);
    return () => window.removeEventListener("aikeeptrade-calc-changed", sync);
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
          <span className="tabular-nums opacity-80">· {total}</span>
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
                          checked ? "bg-violet-500/10" : "hover:bg-muted/50"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => update(group.id, opt.id)}
                          className="h-3 w-3"
                        />
                        <span className="flex-1 truncate text-slate-800 dark:text-slate-200">{opt.label}</span>
                        <span className="tabular-nums text-[9px] text-muted-foreground shrink-0">
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
          <span className="text-xl font-bold tabular-nums leading-none">{total}</span>
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
    window.addEventListener("aikeeptrade-calc-changed", sync);
    return () => window.removeEventListener("aikeeptrade-calc-changed", sync);
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
          <span className="tabular-nums opacity-80">· {total}</span>
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
                checked ? "bg-cyan-500/10" : "hover:bg-muted/50"
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => update(opt.id)}
                className="h-3 w-3"
              />
              <span className="flex-1 min-w-0">
                <span className="font-semibold text-cyan-700 dark:text-cyan-300">{opt.code}</span>
                <span className="text-slate-700 dark:text-slate-300"> — {opt.label}</span>
              </span>
              <span className="tabular-nums text-[9px] text-muted-foreground shrink-0">
                {formatM1Points(opt.points)}
              </span>
            </label>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-border/60 px-2.5 py-1.5 space-y-1 bg-muted/20">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Suma</span>
          <span className="text-xl font-bold tabular-nums leading-none">{total}</span>
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
  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  const persist = useCallback((patch) => {
    setUi((prev) => {
      const next = { ...prev, ...patch };
      saveUiState(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onOpen = (event) => {
      const kind = event?.detail?.kind === "m1" ? "m1" : "aplus";
      persist({ open: true, minimized: false, kind });
    };
    const onClose = () => persist({ open: false });
    window.addEventListener(FLOATING_CALC_EVENT, onOpen);
    window.addEventListener(FLOATING_CALC_CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(FLOATING_CALC_EVENT, onOpen);
      window.removeEventListener(FLOATING_CALC_CLOSE_EVENT, onClose);
    };
  }, [persist]);

  useEffect(() => {
    const onMove = (e) => {
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
  }, [persist, ui.w]);

  if (typeof document === "undefined") return null;

  const zClass = ui.alwaysOnTop ? "z-[220]" : "z-[60]";

  return createPortal(
    <>
      {!ui.open && (
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
          <Calculator className="w-5 h-5 text-violet-500" />
        </button>
      )}

      {ui.open && (
        <div
          className={cn(
            "fixed flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl",
            zClass,
            ui.minimized ? "h-auto" : ""
          )}
          style={{
            left: ui.x,
            top: ui.y,
            width: ui.w,
            height: ui.minimized ? "auto" : ui.h,
          }}
        >
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 border-b border-border/70 cursor-grab active:cursor-grabbing select-none",
              ui.kind === "m1"
                ? "bg-cyan-50/80 dark:bg-cyan-950/40"
                : "bg-violet-50/80 dark:bg-violet-950/40"
            )}
            onPointerDown={(e) => {
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
            <GripHorizontal className="w-4 h-4 text-muted-foreground shrink-0" />
            {ui.kind === "m1" ? (
              <Crosshair className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
            ) : (
              <Calculator className="w-3.5 h-3.5 text-violet-600 shrink-0" />
            )}
            <span className="text-[11px] font-semibold truncate flex-1">
              {ui.kind === "m1" ? "M1 MASTERY" : "Konfiguracja A+"}
            </span>

            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title={ui.alwaysOnTop ? "Wyłącz zawsze na wierzchu" : "Zawsze na wierzchu"}
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Zamknij"
                onClick={() => persist({ open: false })}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {!ui.minimized && (
            <>
              <div className="flex gap-1 px-2 py-1.5 border-b border-border/50 bg-muted/20 shrink-0">
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition",
                    ui.kind === "aplus"
                      ? "bg-violet-600 text-white"
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
                      ? "bg-cyan-600 text-white"
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
            </>
          )}
        </div>
      )}
    </>,
    document.body
  );
}
