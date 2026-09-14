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

const MAX_PLAUSIBLE_ABS_R = 15;

function almostEqualNum(a, b) {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return Math.abs(a - b) / scale < 0.02;
}

/** True when a number looks like an FX/metal price, not dollar risk. */
function looksLikePriceLevel(n) {
  return n >= 0.5 && n <= 5;
}

/** Dollar (account) risk. Ignores SL price copied into stop_loss_amount. */
export function getTradeMoneyRisk(trade) {
  const amount = Math.abs(Number(trade?.stop_loss_amount));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const slPrice = Math.abs(Number(trade?.stop_loss));
  if (Number.isFinite(slPrice) && slPrice > 0 && almostEqualNum(amount, slPrice)) return null;
  if (looksLikePriceLevel(amount)) return null;
  return amount;
}

/** Realized R = P&L / money risk. Never divide by a price level. */
export function tradeRealizedR(trade) {
  const pl = getTradeRealizedPL(trade);
  const risk = getTradeMoneyRisk(trade);
  if (risk && pl != null) {
    const r = pl / risk;
    if (Number.isFinite(r) && (Math.abs(r) <= MAX_PLAUSIBLE_ABS_R || risk >= 20)) return r;
  }
  const stored = [trade?.r_multiple, trade?.realized_r]
    .map(Number)
    .find((n) => Number.isFinite(n) && n !== 0 && Math.abs(n) <= MAX_PLAUSIBLE_ABS_R);
  if (stored == null) return null;
  if (pl != null && pl !== 0 && Math.sign(stored) !== Math.sign(pl)) return null;
  return stored;
}

const normalizeTradeOutcome = (outcome) => {
  const normalized = String(outcome || "").trim().toLowerCase();
  if (normalized === "win" || normalized === "w" || normalized === "profit") return "win";
  if (normalized === "loss" || normalized === "l" || normalized === "lose") return "loss";
  if (normalized === "breakeven" || normalized === "be" || normalized === "break even" || normalized === "break-even") return "breakeven";
  return "default";
};

/** Win / loss / BE from label, or from P&L when outcome is missing. */
export function getTradeOutcomeKey(trade) {
  const labeled = normalizeTradeOutcome(trade?.outcome);
  if (labeled !== "default") return labeled;
  const pl = getTradeRealizedPL(trade);
  if (pl == null) return "default";
  if (pl > 0) return "win";
  if (pl < 0) return "loss";
  return "breakeven";
}

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
