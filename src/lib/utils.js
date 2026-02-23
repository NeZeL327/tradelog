import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

export const normalizeDirection = (direction) => {
  if (!direction) return "";
  const normalized = direction.toLowerCase();
  if (normalized === "long" || normalized === "buy") return "Long";
  if (normalized === "short" || normalized === "sell") return "Short";
  return direction;
};

export const directionLabel = (direction, t) => {
  const normalized = normalizeDirection(direction);
  if (!normalized) return "";
  if (t) {
    if (normalized === "Long" && t("longLabel")) return t("longLabel");
    if (normalized === "Short" && t("shortLabel")) return t("shortLabel");
  }
  return normalized;
};

export const directionBadgeClass = (direction) => {
  const normalized = normalizeDirection(direction);
  if (normalized === "Long") return "bg-emerald-500 text-white border-transparent shadow-sm shadow-emerald-500/30";
  if (normalized === "Short") return "bg-rose-500 text-white border-transparent shadow-sm shadow-rose-500/30";
  return "bg-slate-500 text-white border-transparent";
};

const normalizeTradeStatus = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (["open", "otwarta", "aktywna"].includes(normalized)) return "open";
  if (["closed", "wykonana", "zamknięta", "zamknieta", "executed"].includes(normalized)) return "closed";
  if (["planned", "planowana"].includes(normalized)) return "planned";
  return "default";
};

export const isClosedTrade = (trade) => normalizeTradeStatus(trade?.status) === "closed";

const normalizeTradeOutcome = (outcome) => {
  const normalized = String(outcome || "").toLowerCase();
  if (normalized === "win") return "win";
  if (normalized === "loss") return "loss";
  if (normalized === "breakeven") return "breakeven";
  return "default";
};

export const tradeStatusBadgeClass = (status) => {
  const normalized = normalizeTradeStatus(status);
  if (normalized === "open") return "bg-amber-500 text-white border-transparent shadow-sm shadow-amber-500/30";
  if (normalized === "closed") return "bg-emerald-500 text-white border-transparent shadow-sm shadow-emerald-500/30";
  if (normalized === "planned") return "bg-slate-500 text-white border-transparent shadow-sm shadow-slate-500/30";
  return "bg-slate-500 text-white border-transparent";
};

export const tradeOutcomeBadgeClass = (outcome) => {
  const normalized = normalizeTradeOutcome(outcome);
  if (normalized === "win") return "border-emerald-500/80 text-emerald-600 dark:text-emerald-300 bg-emerald-500/5";
  if (normalized === "loss") return "border-rose-500/80 text-rose-600 dark:text-rose-300 bg-rose-500/5";
  if (normalized === "breakeven") return "border-amber-500/80 text-amber-600 dark:text-amber-300 bg-amber-500/5";
  return "border-slate-500/70 text-slate-600 dark:text-slate-300";
};

export const tradeOutcomeToneClass = (outcome) => {
  const normalized = normalizeTradeOutcome(outcome);
  if (normalized === "win") return "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300";
  if (normalized === "loss") return "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300";
  if (normalized === "breakeven") return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
  return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
};

export const tradeOutcomeChartColor = (outcome) => {
  const normalized = normalizeTradeOutcome(outcome);
  if (normalized === "win") return "#10b981";
  if (normalized === "loss") return "#ef4444";
  if (normalized === "breakeven") return "#f59e0b";
  return "#64748b";
};

export const tradePnLBarColor = (value) => {
  const parsed = Number(value) || 0;
  return parsed >= 0 ? "#f59e0b" : "#ef4444";
};

export const directionChartColor = (direction) => {
  const normalized = normalizeDirection(direction);
  if (normalized === "Long") return "#22c55e";
  if (normalized === "Short") return "#ef4444";
  return "#64748b";
};
