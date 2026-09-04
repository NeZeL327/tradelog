import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { CHART } from "./chartTheme"

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
  if (normalized === "Long") return "rounded-full bg-profit/12 text-profit border-transparent text-[11px] font-medium px-2 py-0.5";
  if (normalized === "Short") return "rounded-full bg-loss/12 text-loss border-transparent text-[11px] font-medium px-2 py-0.5";
  return "rounded-full bg-muted text-muted-foreground border-transparent text-[11px] font-medium px-2 py-0.5";
};

const normalizeTradeStatus = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (["open", "otwarta", "aktywna"].includes(normalized)) return "open";
  if (["closed", "wykonana", "zamknięta", "zamknieta", "executed"].includes(normalized)) return "closed";
  if (["breakeven", "be", "na zero"].includes(normalized)) return "breakeven";
  if (["planned", "planowana"].includes(normalized)) return "planned";
  if (["missed", "spozniona", "spóźniona", "spozniony", "spóźniony"].includes(normalized)) return "missed";
  return "default";
};

export const tradeStatusMatchesFilter = (tradeStatus, filterValue) => {
  if (filterValue === "all") return true;
  return normalizeTradeStatus(tradeStatus) === normalizeTradeStatus(filterValue);
};

export const isClosedTrade = (trade) => {
  const status = normalizeTradeStatus(trade?.status);
  return status === "closed" || status === "breakeven";
};

export const tradeStatusDisplay = (status) => {
  if (normalizeTradeStatus(status) === "breakeven") return "Breakeven";
  return status || "-";
};

export const tradeOutcomeDisplay = (outcome) => {
  const normalized = normalizeTradeOutcome(outcome);
  if (normalized === "breakeven") return "BE";
  if (normalized === "win") return "Win";
  if (normalized === "loss") return "Loss";
  return outcome || "";
};

/** Net realized P&L — dla importu CSV dolicza commission/swap jeśli nie są już w profit_loss. */
export function getTradeRealizedPL(trade) {
  if (!trade || trade.profit_loss == null || trade.profit_loss === "") return null;
  let pl = parseFloat(trade.profit_loss);
  if (Number.isNaN(pl)) return null;

  if (trade.fees_included_in_pl) return pl;

  if (trade.imported && (trade.commission != null || trade.swap != null)) {
    let commission = parseFloat(trade.commission);
    const swap = parseFloat(trade.swap);
    if (!Number.isNaN(commission)) {
      if (commission > 0) commission = -Math.abs(commission);
      pl += commission;
    }
    if (!Number.isNaN(swap)) pl += swap;
  }

  return pl;
}

const normalizeTradeOutcome = (outcome) => {
  const normalized = String(outcome || "").toLowerCase();
  if (normalized === "win") return "win";
  if (normalized === "loss") return "loss";
  if (normalized === "breakeven") return "breakeven";
  return "default";
};

export const tradeStatusBadgeClass = (status) => {
  const normalized = normalizeTradeStatus(status);
  if (normalized === "open") return "rounded-full bg-warning/12 text-warning border-transparent text-[11px] font-medium px-2 py-0.5";
  if (normalized === "closed") return "rounded-full bg-profit/12 text-profit border-transparent text-[11px] font-medium px-2 py-0.5";
  if (normalized === "breakeven") return "rounded-full bg-warning/12 text-warning border-transparent text-[11px] font-medium px-2 py-0.5";
  if (normalized === "planned") return "rounded-full bg-muted text-muted-foreground border-transparent text-[11px] font-medium px-2 py-0.5";
  if (normalized === "missed") return "rounded-full bg-loss/12 text-loss border-transparent text-[11px] font-medium px-2 py-0.5";
  return "rounded-full bg-muted text-muted-foreground border-transparent text-[11px] font-medium px-2 py-0.5";
};

export const tradeOutcomeBadgeClass = (outcome) => {
  const normalized = normalizeTradeOutcome(outcome);
  if (normalized === "win") return "rounded-full bg-profit/12 text-profit border-transparent text-[11px] font-medium px-2 py-0.5";
  if (normalized === "loss") return "rounded-full bg-loss/12 text-loss border-transparent text-[11px] font-medium px-2 py-0.5";
  if (normalized === "breakeven") return "rounded-full bg-warning/12 text-warning border-transparent text-[11px] font-medium px-2 py-0.5";
  return "rounded-full bg-muted text-muted-foreground border-transparent text-[11px] font-medium px-2 py-0.5";
};

export const tradeOutcomeToneClass = (outcome) => {
  const normalized = normalizeTradeOutcome(outcome);
  if (normalized === "win") return "bg-profit/10 text-profit";
  if (normalized === "loss") return "bg-loss/10 text-loss";
  if (normalized === "breakeven") return "bg-warning/10 text-warning";
  return "bg-muted text-muted-foreground";
};

export const tradeOutcomeChartColor = (outcome) => {
  const normalized = normalizeTradeOutcome(outcome);
  if (normalized === "win") return CHART.profit;
  if (normalized === "loss") return CHART.loss;
  if (normalized === "breakeven") return CHART.warning;
  return CHART.muted;
};

export const tradePnLBarColor = (value) => {
  const parsed = Number(value) || 0;
  return parsed >= 0 ? CHART.profit : CHART.loss;
};

export const directionChartColor = (direction) => {
  const normalized = normalizeDirection(direction);
  if (normalized === "Long") return CHART.long;
  if (normalized === "Short") return CHART.short;
  return CHART.muted;
};
