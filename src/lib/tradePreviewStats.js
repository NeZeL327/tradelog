import { directionLabel, getTradeRealizedPL, isClosedTrade, normalizeDirection } from "@/lib/utils";
import { formatTradeClock, formatTradeClockDate, formatTradeDate, getDateFormat } from "@/lib/userSettings";

export const STATS_STORAGE_PREFIX = "trade_preview_stats_fields_";

export const TABS = [
  { id: "stats", label: "Stats" },
  { id: "strategy", label: "Strategy" },
  { id: "tags", label: "Tags" },
  { id: "executions", label: "Executions" },
  { id: "chart", label: "Charts" },
  { id: "photos", label: "Zdjęcia" },
  { id: "emotion", label: "Emotion" },
  { id: "notes", label: "Notes" },
  { id: "running_pl", label: "Running P&L" },
];

export function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatSigned(value, digits = 2) {
  const n = toNumber(value);
  if (n === null) return null;
  const abs = Math.abs(n).toFixed(digits);
  if (n > 0) return `+${abs}`;
  if (n < 0) return `-${abs}`;
  return abs;
}

export function plTone(value) {
  const n = toNumber(value);
  if (n === null || n === 0) return "neutral";
  return n > 0 ? "profit" : "loss";
}

function padTime(time) {
  const match = String(time || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return "00:00:00";
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}:${match[3] || "00"}`;
}

function parseTradeDateTime(dateStr, timeStr) {
  if (!dateStr) return null;
  const d = new Date(`${String(dateStr).slice(0, 10)}T${padTime(timeStr)}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatHeldDuration(trade) {
  const open = parseTradeDateTime(trade?.date, trade?.entry_time || trade?.open_time || trade?.time);
  const closeDate = trade?.close_date || (isClosedTrade(trade) ? trade?.date : null);
  const close = parseTradeDateTime(closeDate, trade?.exit_time);
  if (!open || !close) return null;
  const ms = close.getTime() - open.getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatOpenedLabel(trade, dateFormat = getDateFormat()) {
  return formatTradeClockDate(trade, "entry", dateFormat) || formatTradeDate(trade?.date, dateFormat) || "—";
}

export function formatClosedLabel(trade, dateFormat = getDateFormat()) {
  if (!trade?.close_date && !trade?.exit_time && !isClosedTrade(trade)) return null;
  return formatTradeClockDate(trade, "exit", dateFormat) || formatTradeDate(trade?.close_date || trade?.date, dateFormat) || null;
}

export function getGrossPl(trade) {
  const gross = toNumber(trade?.profit_loss_gross);
  if (gross !== null) return gross;
  return null;
}

export function getPositionSize(trade) {
  return toNumber(trade?.position_size) ?? toNumber(trade?.quantity) ?? toNumber(trade?.volume_units);
}

export function getScaleOutPnl(trade, scaleOut) {
  const manual = toNumber(scaleOut?.pnl);
  if (manual !== null) return manual;
  const size = toNumber(scaleOut?.size);
  const price = toNumber(scaleOut?.price);
  const entry = toNumber(trade?.entry_price);
  if (size === null || price === null || entry === null) return null;
  const sign = normalizeDirection(trade?.direction) === "Short" ? -1 : 1;
  return (price - entry) * size * sign;
}

export function getTradeScreenshots(trade) {
  const slots = [trade?.screenshot_1, trade?.screenshot_2, trade?.screenshot_3].filter(Boolean);
  const legacy = Array.isArray(trade?.chart_screenshots)
    ? trade.chart_screenshots.map((item) => (typeof item === "string" ? item : item?.url)).filter(Boolean)
    : [];
  const seen = new Set();
  return [...slots, ...legacy].filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

const PHOTO_SLOTS = ["screenshot_1", "screenshot_2", "screenshot_3"];

export function getTradePhotoItems(trade) {
  const captions = trade?.screenshot_captions && typeof trade.screenshot_captions === "object"
    ? trade.screenshot_captions
    : {};
  const items = [];
  const seen = new Set();
  PHOTO_SLOTS.forEach((key) => {
    const url = trade?.[key];
    if (!url || seen.has(url)) return;
    seen.add(url);
    items.push({ id: key, url, caption: captions[key] || "", kind: "slot", slot: key });
  });
  const extras = Array.isArray(trade?.chart_screenshots) ? trade.chart_screenshots : [];
  extras.forEach((raw, index) => {
    const url = typeof raw === "string" ? raw : raw?.url;
    if (!url || seen.has(url)) return;
    seen.add(url);
    items.push({
      id: `chart_${index}`,
      url,
      caption: (typeof raw === "object" && raw?.caption) || captions[`chart_${index}`] || "",
      kind: "extra",
      index,
    });
  });
  return items;
}

export function nextScreenshotPatch(trade, url) {
  for (const key of PHOTO_SLOTS) {
    if (!trade?.[key]) return { [key]: url };
  }
  const extras = Array.isArray(trade?.chart_screenshots) ? [...trade.chart_screenshots] : [];
  extras.push(url);
  return { chart_screenshots: extras };
}

export function removeScreenshotPatch(trade, item) {
  if (item.kind === "slot") return { [item.slot]: "" };
  const extras = Array.isArray(trade?.chart_screenshots) ? [...trade.chart_screenshots] : [];
  extras.splice(item.index, 1);
  return { chart_screenshots: extras };
}

export function captionPatch(trade, item, caption) {
  return {
    screenshot_captions: {
      ...(trade?.screenshot_captions && typeof trade.screenshot_captions === "object"
        ? trade.screenshot_captions
        : {}),
      [item.id]: caption,
    },
  };
}

function displayOrDash(value) {
  if (value === null || value === undefined) return "—";
  const text = String(value).trim();
  return text ? text : "—";
}

function roiValue(trade) {
  const pct = toNumber(trade?.profit_loss_percent);
  if (pct === null) return { text: "—", tone: "neutral" };
  return { text: `${formatSigned(pct)}%`, tone: plTone(pct) };
}

function realizedR(trade) {
  const risk = Math.abs(toNumber(trade?.stop_loss_amount) ?? toNumber(trade?.stop_loss) ?? 0);
  const pl = getTradeRealizedPL(trade);
  if (!risk || pl === null) return { text: "—", tone: "neutral" };
  const r = pl / risk;
  return { text: `${formatSigned(r)}R`, tone: plTone(r) };
}

function returnPerPip(trade) {
  const pips = toNumber(trade?.pips);
  const pl = getTradeRealizedPL(trade);
  if (pips === null || pips === 0 || pl === null) return { text: "—", tone: "neutral" };
  const v = pl / pips;
  return { text: formatSigned(v), tone: plTone(v) };
}

function starsText(value) {
  const n = Math.max(0, Math.min(5, Math.round(toNumber(value) || 0)));
  if (!n) return { text: "—", tone: "neutral", rating: 0 };
  return { text: `${n}/5`, tone: "neutral", rating: n };
}

export const STATS_FIELDS = [
  { id: "side", label: "Side" },
  { id: "account", label: "Account" },
  { id: "forex_traded", label: "Forex traded" },
  { id: "pips", label: "Pips" },
  { id: "return_per_pip", label: "Return Per Pip" },
  { id: "commissions", label: "Commissions / Fees" },
  { id: "swap", label: "Total Swap" },
  { id: "net_roi", label: "Net ROI" },
  { id: "gross_pl", label: "Gross P&L" },
  { id: "adjusted_cost", label: "Adjusted Cost" },
  { id: "strategy", label: "Strategy" },
  { id: "price_mae", label: "Price MAE" },
  { id: "price_mfe", label: "Price MFE" },
  { id: "trade_rating", label: "Trade Rating" },
  { id: "profit_target", label: "Profit Target" },
  { id: "stop_loss", label: "Stop Loss" },
  { id: "initial_target", label: "Initial Target" },
  { id: "trade_risk", label: "Trade Risk" },
  { id: "planned_r", label: "Planned R-Multiple" },
  { id: "realized_r", label: "Realized R-Multiple" },
  { id: "average_entry", label: "Average Entry" },
  { id: "average_exit", label: "Average Exit" },
  { id: "entry_time", label: "Entry Time" },
  { id: "exit_time", label: "Exit Time" },
  { id: "timeframe", label: "Timeframe" },
  { id: "session", label: "Session" },
  { id: "status", label: "Status" },
  { id: "remaining_size", label: "Remaining size" },
  { id: "breakeven", label: "Breakeven" },
  { id: "running_pl", label: "Running P&L" },
];

export const DEFAULT_STATS_FIELD_IDS = [
  "side",
  "account",
  "forex_traded",
  "pips",
  "commissions",
  "swap",
  "net_roi",
  "gross_pl",
  "strategy",
  "trade_rating",
  "profit_target",
  "stop_loss",
  "average_entry",
  "average_exit",
  "entry_time",
  "exit_time",
  "running_pl",
];

const VALID_IDS = new Set(STATS_FIELDS.map((f) => f.id));

export function loadVisibleStatsFields(userId) {
  try {
    const raw = localStorage.getItem(`${STATS_STORAGE_PREFIX}${userId || "guest"}`);
    if (!raw) return [...DEFAULT_STATS_FIELD_IDS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_STATS_FIELD_IDS];
    const ids = parsed.filter((id) => VALID_IDS.has(id));
    return ids.length ? ids : [...DEFAULT_STATS_FIELD_IDS];
  } catch {
    return [...DEFAULT_STATS_FIELD_IDS];
  }
}

export function saveVisibleStatsFields(userId, ids) {
  const next = (ids || []).filter((id) => VALID_IDS.has(id));
  localStorage.setItem(`${STATS_STORAGE_PREFIX}${userId || "guest"}`, JSON.stringify(next));
  return next;
}

export function getRunningPlPoints(trade) {
  const outs = Array.isArray(trade?.scale_outs) ? trade.scale_outs : [];
  if (!outs.length) return [];
  let sum = 0;
  const points = [];
  outs.forEach((item, idx) => {
    const pnl = getScaleOutPnl(trade, item);
    if (pnl === null) return;
    sum += pnl;
    points.push({ idx, value: sum });
  });
  const net = getTradeRealizedPL(trade);
  if (net !== null && points.length) {
    points.push({ idx: points.length, value: net });
  }
  return points;
}

export function getStatsCell(trade, fieldId, t) {
  switch (fieldId) {
    case "side":
      return { text: directionLabel(trade?.direction, t) || "—", tone: "neutral" };
    case "account":
      return { text: displayOrDash(trade?.accountName || trade?.account_name || trade?.account), tone: "neutral" };
    case "forex_traded":
      return { text: displayOrDash(getPositionSize(trade) ?? trade?.position_size), tone: "neutral" };
    case "pips": {
      const pips = toNumber(trade?.pips);
      if (pips === null) return { text: "—", tone: "neutral" };
      return { text: String(pips), tone: plTone(pips) };
    }
    case "return_per_pip":
      return returnPerPip(trade);
    case "commissions": {
      const n = toNumber(trade?.commission);
      if (n === null) return { text: "—", tone: "neutral" };
      return { text: formatSigned(n), tone: "neutral" };
    }
    case "swap": {
      const n = toNumber(trade?.swap);
      if (n === null) return { text: "—", tone: "neutral" };
      return { text: formatSigned(n), tone: "neutral" };
    }
    case "net_roi":
      return roiValue(trade);
    case "gross_pl": {
      const gross = getGrossPl(trade);
      if (gross === null) return { text: "—", tone: "neutral" };
      return { text: formatSigned(gross), tone: plTone(gross) };
    }
    case "adjusted_cost":
      return { text: displayOrDash(trade?.adjusted_cost ?? trade?.adjustedCost), tone: "neutral" };
    case "price_mae": {
      const n = toNumber(trade?.price_mae ?? trade?.mae ?? trade?.max_adverse_excursion);
      if (n === null) return { text: "—", tone: "neutral" };
      return { text: String(n), tone: "loss" };
    }
    case "price_mfe": {
      const n = toNumber(trade?.price_mfe ?? trade?.mfe ?? trade?.max_favorable_excursion);
      if (n === null) return { text: "—", tone: "neutral" };
      return { text: String(n), tone: "profit" };
    }
    case "strategy":
      return { text: displayOrDash(trade?.strategyName || trade?.strategy_name || trade?.strategy), tone: "neutral" };
    case "trade_rating":
      return starsText(trade?.setup_confidence);
    case "profit_target":
      return {
        text: displayOrDash(trade?.take_profit_amount ?? trade?.take_profit ?? (trade?.take_profit_pips != null ? `${trade.take_profit_pips} pips` : null)),
        tone: "neutral",
      };
    case "stop_loss":
      return {
        text: displayOrDash(trade?.stop_loss_amount ?? trade?.stop_loss ?? (trade?.stop_loss_pips != null ? `${trade.stop_loss_pips} pips` : null)),
        tone: "neutral",
      };
    case "initial_target":
      return { text: displayOrDash(trade?.take_profit_pips != null ? `${trade.take_profit_pips} pips` : trade?.take_profit_amount), tone: "neutral" };
    case "trade_risk":
      return { text: displayOrDash(trade?.stop_loss_amount ?? trade?.stop_loss), tone: "neutral" };
    case "planned_r": {
      const rr = toNumber(trade?.risk_reward_ratio);
      if (rr === null) return { text: "—", tone: "neutral" };
      return { text: `${rr.toFixed(2)}R`, tone: "neutral" };
    }
    case "realized_r":
      return realizedR(trade);
    case "average_entry":
      return { text: displayOrDash(trade?.entry_price), tone: "neutral" };
    case "average_exit":
      return { text: displayOrDash(trade?.exit_price), tone: "neutral" };
    case "entry_time":
      return { text: displayOrDash(formatTradeClock(trade, "entry")), tone: "neutral" };
    case "exit_time":
      return { text: displayOrDash(formatTradeClock(trade, "exit")), tone: "neutral" };
    case "timeframe":
      return { text: displayOrDash(trade?.timeframe), tone: "neutral" };
    case "session":
      return { text: displayOrDash(trade?.session), tone: "neutral" };
    case "status":
      return { text: displayOrDash(trade?.status), tone: "neutral" };
    case "remaining_size":
      return { text: displayOrDash(trade?.remaining_size), tone: "neutral" };
    case "breakeven":
      return {
        text: trade?.breakeven_moved
          ? displayOrDash(trade?.breakeven_price || "tak")
          : "—",
        tone: "neutral",
      };
    case "running_pl":
      return { text: "", tone: "sparkline" };
    default:
      return { text: "—", tone: "neutral" };
  }
}

export function buildExecutionRows(trade) {
  const rows = [];
  rows.push({
    id: "entry",
    kind: "Entry",
    time: formatTradeClock(trade, "entry") || "—",
    price: trade?.entry_price ?? "—",
    size: getPositionSize(trade) ?? trade?.position_size ?? "—",
    pnl: null,
  });
  const outs = Array.isArray(trade?.scale_outs) ? trade.scale_outs : [];
  outs.forEach((item, idx) => {
    rows.push({
      id: item.id || `scale-${idx}`,
      kind: "Partial",
      time: item.time || "—",
      price: item.price ?? "—",
      size: item.size ?? "—",
      pnl: getScaleOutPnl(trade, item),
      note: item.reason || "",
    });
  });
  if (trade?.exit_price != null && trade.exit_price !== "") {
    rows.push({
      id: "exit",
      kind: "Exit",
      time: formatTradeClock(trade, "exit") || "—",
      price: trade.exit_price,
      size: trade?.remaining_size ?? "—",
      pnl: getTradeRealizedPL(trade),
    });
  }
  return rows;
}
