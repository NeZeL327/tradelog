/**
 * MetaApi deals → one closed AiKeepTrade trade per position.
 * One positionId with several round-trips is reported, not split into fake tickets.
 */
import { normalizeTicket } from "./tradeImportDedup.js";

const EPS = 1e-6;

const HEDGING = "ACCOUNT_MARGIN_MODE_RETAIL_HEDGING";
const NETTING = "ACCOUNT_MARGIN_MODE_RETAIL_NETTING";

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function volumeOf(deal) {
  const n = Number(deal?.volume);
  return Number.isFinite(n) ? n : 0;
}

function priceOf(deal) {
  const n = Number(deal?.price);
  return Number.isFinite(n) ? n : null;
}

function directionOf(type) {
  if (type === "DEAL_TYPE_BUY") return "Long";
  if (type === "DEAL_TYPE_SELL") return "Short";
  return null;
}

function isBuySell(deal) {
  return deal?.type === "DEAL_TYPE_BUY" || deal?.type === "DEAL_TYPE_SELL";
}

function brokerParts(deal) {
  const raw = String(deal?.brokerTime || "");
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (match) return { date: match[1], time: match[2] };
  const parsed = Date.parse(deal?.time || "");
  if (!Number.isFinite(parsed)) return { date: "", time: "" };
  const iso = new Date(parsed).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 19) };
}

function levelOrNull(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

function blankCycle() {
  return {
    direction: null,
    volume: 0,
    entryVolume: 0,
    entryNotional: 0,
    entryDate: "",
    entryTime: "",
    exitNotional: 0,
    exitVolume: 0,
    exitDate: "",
    exitTime: "",
    profit: 0,
    commission: 0,
    swap: 0,
    stopLoss: null,
    takeProfit: null,
    symbol: "",
  };
}

function addMoney(cycle, deal) {
  cycle.profit += money(deal.profit);
  cycle.commission += money(deal.commission);
  cycle.swap += money(deal.swap);
}

function sameSymbol(cycle, deal) {
  const symbol = deal?.symbol ? String(deal.symbol) : "";
  if (!symbol) return true;
  if (!cycle.symbol) {
    cycle.symbol = symbol;
    return true;
  }
  return cycle.symbol === symbol;
}

function startFromEntry(deal) {
  const direction = directionOf(deal.type);
  const volume = volumeOf(deal);
  const price = priceOf(deal);
  if (!direction || volume <= 0 || price == null) {
    return { error: "brak ceny lub wolumenu wejścia" };
  }
  const when = brokerParts(deal);
  const cycle = blankCycle();
  cycle.direction = direction;
  cycle.volume = volume;
  cycle.entryVolume = volume;
  cycle.entryNotional = price * volume;
  cycle.entryDate = when.date;
  cycle.entryTime = when.time;
  cycle.stopLoss = levelOrNull(deal.stopLoss);
  cycle.takeProfit = levelOrNull(deal.takeProfit);
  cycle.symbol = deal.symbol ? String(deal.symbol) : "";
  addMoney(cycle, deal);
  return { cycle };
}

function addEntry(cycle, deal) {
  const direction = directionOf(deal.type);
  const volume = volumeOf(deal);
  const price = priceOf(deal);
  if (!direction || volume <= 0 || price == null) {
    return { error: "brak ceny lub wolumenu wejścia" };
  }
  if (direction !== cycle.direction) {
    return { error: "wejście przeciwne bez zamknięcia" };
  }
  if (!sameSymbol(cycle, deal)) return { error: "zmiana symbolu w pozycji" };
  cycle.volume += volume;
  cycle.entryVolume += volume;
  cycle.entryNotional += price * volume;
  addMoney(cycle, deal);
  return {};
}

function applyExit(cycle, deal) {
  const volume = volumeOf(deal);
  const price = priceOf(deal);
  if (volume <= 0 || price == null) {
    return { error: "brak ceny lub wolumenu wyjścia" };
  }
  if (!cycle || cycle.volume + EPS < volume) return { missingEntry: true };
  if (!sameSymbol(cycle, deal)) return { error: "zmiana symbolu w pozycji" };
  cycle.volume -= volume;
  cycle.exitNotional += price * volume;
  cycle.exitVolume += volume;
  const when = brokerParts(deal);
  cycle.exitDate = when.date;
  cycle.exitTime = when.time;
  addMoney(cycle, deal);
  if (cycle.volume <= EPS) {
    cycle.volume = 0;
    return { closed: cycle };
  }
  return {};
}

function applyReversal(cycle, deal) {
  if (!cycle || cycle.volume <= EPS) return startFromEntry(deal);
  const volume = volumeOf(deal);
  const price = priceOf(deal);
  const nextDirection = directionOf(deal.type);
  if (volume <= 0 || price == null || !nextDirection) {
    return { error: "brak danych odwrócenia pozycji" };
  }
  if (nextDirection === cycle.direction) {
    return { error: "odwrócenie bez zmiany kierunku" };
  }
  if (volume + EPS < cycle.volume) {
    return { error: "odwrócenie mniejsze niż otwarty wolumen" };
  }
  if (!sameSymbol(cycle, deal)) return { error: "zmiana symbolu w pozycji" };

  const closedVolume = cycle.volume;
  const openedVolume = volume - closedVolume;
  cycle.exitNotional += price * closedVolume;
  cycle.exitVolume += closedVolume;
  cycle.volume = 0;
  const when = brokerParts(deal);
  cycle.exitDate = when.date;
  cycle.exitTime = when.time;
  addMoney(cycle, deal);

  let next = null;
  if (openedVolume > EPS) {
    next = blankCycle();
    next.direction = nextDirection;
    next.volume = openedVolume;
    next.entryVolume = openedVolume;
    next.entryNotional = price * openedVolume;
    next.entryDate = when.date;
    next.entryTime = when.time;
    next.stopLoss = levelOrNull(deal.stopLoss);
    next.takeProfit = levelOrNull(deal.takeProfit);
    next.symbol = cycle.symbol;
  }
  return { closed: cycle, next };
}

function sortDeals(deals) {
  return [...deals].sort((a, b) => {
    const delta = Date.parse(a?.time || "") - Date.parse(b?.time || "");
    if (delta) return delta;
    return String(a?.id || "").localeCompare(String(b?.id || ""));
  });
}

export function foldPositionDeals(deals) {
  let cycle = null;
  const closed = [];
  let missingEntry = false;

  for (const deal of sortDeals(deals)) {
    if (!isBuySell(deal)) continue;
    const entry = deal.entryType;
    let step = null;

    if (entry === "DEAL_ENTRY_IN") {
      step = cycle && cycle.volume > EPS ? addEntry(cycle, deal) : startFromEntry(deal);
      if (step.cycle) cycle = step.cycle;
    } else if (entry === "DEAL_ENTRY_OUT" || entry === "DEAL_ENTRY_OUT_BY") {
      step = applyExit(cycle, deal);
    } else if (entry === "DEAL_ENTRY_INOUT") {
      step = applyReversal(cycle, deal);
      if (step.cycle) cycle = step.cycle;
    } else {
      return { error: "nieznany typ wejścia deala", closed: [], missingEntry: false, open: false };
    }

    if (!step) continue;
    if (step.error) {
      return { error: step.error, closed: [], missingEntry: false, open: false };
    }
    if (step.missingEntry) missingEntry = true;
    if (step.closed) {
      closed.push(step.closed);
      cycle = step.next || null;
    }
  }

  return {
    error: null,
    closed,
    missingEntry,
    open: !!(cycle && cycle.volume > EPS),
  };
}

function roundLots(value) {
  return Number(value.toFixed(4));
}

function roundPrice(value) {
  return Number(value.toFixed(8));
}

function normalizeCommission(value) {
  if (!value) return 0;
  return value < 0 ? value : -Math.abs(value);
}

function cycleToTrade(cycle, positionId, accountId) {
  const ticket = normalizeTicket(positionId);
  const entry = cycle.entryNotional / cycle.entryVolume;
  const exit = cycle.exitNotional / cycle.exitVolume;
  const commission = normalizeCommission(cycle.commission);
  const swap = cycle.swap;
  const gross = cycle.profit;
  const net = gross + commission + swap;
  const trade = {
    account_id: String(accountId),
    status: "Closed",
    imported: true,
    import_broker: "mt5",
    external_ticket: ticket,
    date: cycle.entryDate,
    time: cycle.entryTime,
    entry_time: cycle.entryTime,
    close_date: cycle.exitDate,
    exit_time: cycle.exitTime,
    symbol: cycle.symbol,
    direction: cycle.direction,
    position_size: roundLots(cycle.entryVolume),
    quantity: roundLots(cycle.entryVolume),
    entry_price: roundPrice(entry),
    exit_price: roundPrice(exit),
    profit_loss_gross: gross,
    commission,
    swap,
    profit_loss: net,
    fees_included_in_pl: true,
    outcome: net > 0 ? "Win" : net < 0 ? "Loss" : "Breakeven",
  };
  if (cycle.stopLoss != null) {
    trade.stop_loss = cycle.stopLoss;
    trade.stop_loss_amount = cycle.stopLoss;
  }
  if (cycle.takeProfit != null) {
    trade.take_profit = cycle.takeProfit;
    trade.take_profit_amount = cycle.takeProfit;
  }
  return trade;
}

export function classifyPosition(positionId, deals, accountId, { final = false } = {}) {
  const fold = foldPositionDeals(deals);
  if (fold.missingEntry && !final) return { status: "needs-history" };
  if (fold.missingEntry) {
    return { status: "unmapped", reason: "wolumen wyjść większy niż wejść" };
  }
  if (fold.error) return { status: "unmapped", reason: fold.error };
  if (fold.closed.length > 1) {
    return { status: "unmapped", reason: "kilka zamknięć w jednym positionId" };
  }
  if (fold.closed.length === 0) return { status: "open" };
  const cycle = fold.closed[0];
  if (!cycle.entryVolume || !cycle.exitVolume || !cycle.symbol || !cycle.entryDate) {
    return { status: "unmapped", reason: "pozycja bez symbolu, czasu albo wolumenu" };
  }
  if (!normalizeTicket(positionId)) {
    return { status: "unmapped", reason: "brak positionId" };
  }
  return { status: "trade", trade: cycleToTrade(cycle, positionId, accountId) };
}

export function groupPositionDeals(deals) {
  const groups = new Map();
  const unmapped = [];

  for (const deal of deals || []) {
    if (!isBuySell(deal)) continue;
    const positionId = deal.positionId == null ? "" : String(deal.positionId).trim();
    if (!positionId || positionId === "0") {
      unmapped.push({ positionId: "", reason: "brak positionId" });
      continue;
    }
    if (!groups.has(positionId)) groups.set(positionId, []);
    groups.get(positionId).push(deal);
  }

  return { groups, unmapped };
}

export function assertMarginMode(marginMode) {
  if (marginMode === HEDGING || marginMode === NETTING) return null;
  if (marginMode === "ACCOUNT_MARGIN_MODE_EXCHANGE") {
    return "Tryb EXCHANGE nie jest obsługiwany.";
  }
  return "Nie udało się odczytać trybu konta (hedging/netting).";
}

export function uniqueDeals(deals) {
  const byId = new Map();
  for (const deal of deals || []) {
    const id = deal?.id == null ? "" : String(deal.id);
    if (!id) continue;
    byId.set(id, deal);
  }
  return [...byId.values()];
}
