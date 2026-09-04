const LAST_ID_KEY = "aikeep-last-trade-details-id";

export function tradeDetailsPath(tradeId) {
  if (!tradeId) return "/trade";
  return `/trade/${encodeURIComponent(String(tradeId))}`;
}

export function loadLastTradeDetailsId() {
  try {
    return localStorage.getItem(LAST_ID_KEY) || "";
  } catch {
    return "";
  }
}

export function saveLastTradeDetailsId(tradeId) {
  if (!tradeId) return;
  try {
    localStorage.setItem(LAST_ID_KEY, String(tradeId));
  } catch {
    /* ignore */
  }
}

export function goToTradeDetails(navigate, trade, trades = []) {
  if (!trade?.id || !navigate) return;
  saveLastTradeDetailsId(trade.id);
  navigate(tradeDetailsPath(trade.id), {
    state: { tradeIds: trades.map((item) => String(item.id)) },
  });
}
