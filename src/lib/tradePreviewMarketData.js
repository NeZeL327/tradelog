import { isClosedTrade, normalizeDirection } from "@/lib/utils";
import { toNumber } from "@/lib/tradePreviewStats";

export const CHART_INTERVALS = [
  { id: "1m", label: "1m", tv: "1" },
  { id: "5m", label: "5m", tv: "5" },
  { id: "15m", label: "15m", tv: "15" },
  { id: "30m", label: "30m", tv: "30" },
  { id: "1H", label: "1H", tv: "60" },
  { id: "4H", label: "4H", tv: "240" },
  { id: "1D", label: "1D", tv: "D" },
];

const CRYPTO = new Set([
  "BTC", "ETH", "SOL", "XRP", "BNB", "ADA", "DOGE", "AVAX", "DOT", "LINK", "MATIC", "PEPE", "LTC", "BCH",
]);

function padTime(time) {
  const match = String(time || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return "00:00:00";
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}:${match[3] || "00"}`;
}

export function tradeUnix(trade, which = "entry") {
  const date = which === "exit"
    ? (trade?.close_date || trade?.date)
    : trade?.date;
  const time = which === "exit"
    ? (trade?.exit_time || "")
    : (trade?.entry_time || trade?.open_time || trade?.time || "");
  if (!date) return null;
  const d = new Date(`${String(date).slice(0, 10)}T${padTime(time)}`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / 1000);
}

export function yahooSymbol(raw) {
  const clean = String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9=.-]/g, "");
  if (!clean) return null;
  if (clean.includes("=") || clean.includes("-")) return clean;
  const base = clean.replace(/(USDT|USD|USDC)$/, "");
  if (CRYPTO.has(base) || CRYPTO.has(clean.slice(0, 3))) {
    const coin = CRYPTO.has(base) ? base : clean.slice(0, 3);
    return `${coin}-USD`;
  }
  if (/^[A-Z]{6}$/.test(clean)) return `${clean}=X`;
  if (/^[A-Z]{3}USD$/.test(clean) && CRYPTO.has(clean.slice(0, 3))) {
    return `${clean.slice(0, 3)}-USD`;
  }
  return clean;
}

export function binanceSymbol(raw) {
  const clean = String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return null;
  const base = clean.replace(/(USDT|USD|USDC)$/, "");
  if (CRYPTO.has(base) || CRYPTO.has(clean.slice(0, 3))) {
    const coin = CRYPTO.has(base) ? base : clean.slice(0, 3);
    return `${coin}USDT`;
  }
  return null;
}

export function tradingViewSymbol(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (!s) return "FX:EURUSD";
  if (s.includes(":")) return s;
  const clean = s.replace(/[^A-Z0-9]/g, "");
  if (clean === "XAUUSD" || clean === "GOLD") return "OANDA:XAUUSD";
  if (clean === "XAGUSD") return "OANDA:XAGUSD";
  if (clean === "US500" || clean === "SPX500") return "FOREXCOM:SPXUSD";
  if (clean === "NAS100" || clean === "US100") return "FOREXCOM:NSXUSD";
  if (clean === "GER40" || clean === "DE40") return "FOREXCOM:GER40";
  const cryptoPair = binanceSymbol(clean);
  if (cryptoPair) return `BINANCE:${cryptoPair}`;
  if (/^[A-Z]{6}$/.test(clean)) return `FX:${clean}`;
  return clean;
}

export function tradingViewEmbedSrc(symbol, intervalId) {
  const spec = CHART_INTERVALS.find((item) => item.id === intervalId) || CHART_INTERVALS[0];
  const params = new URLSearchParams({
    symbol: tradingViewSymbol(symbol),
    interval: spec.tv,
    hidetoptoolbar: "0",
    hidesidetoolbar: "0",
    symboledit: "0",
    saveimage: "0",
    toolbarbg: "0b1220",
    theme: "dark",
    style: "1",
    timezone: "Europe/Warsaw",
    withdateranges: "1",
    hideideas: "1",
    hidevolume: "0",
    locale: "pl",
    studies: "[]",
  });
  return `https://www.tradingview.com/widgetembed/?${params.toString()}`;
}

function yahooBase() {
  return import.meta.env.DEV ? "/yahoo-chart" : "https://query1.finance.yahoo.com";
}

function rangeForTrade(trade, fallback) {
  const entry = tradeUnix(trade, "entry");
  if (!entry) return fallback;
  const ageDays = (Date.now() / 1000 - entry) / 86400;
  if (ageDays <= 1) return "1d";
  if (ageDays <= 5) return "5d";
  if (ageDays <= 30) return "1mo";
  if (ageDays <= 90) return "3mo";
  if (ageDays <= 180) return "6mo";
  if (ageDays <= 365) return "1y";
  if (ageDays <= 730) return "2y";
  return "5y";
}

function parseYahooChart(json) {
  const result = json?.chart?.result?.[0];
  const ts = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!Array.isArray(ts) || !quote) return [];
  const candles = [];
  for (let i = 0; i < ts.length; i += 1) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if (![open, high, low, close].every((n) => Number.isFinite(n))) continue;
    candles.push({
      time: ts[i],
      open,
      high,
      low,
      close,
    });
  }
  return candles;
}

function groupCandles(candles, size) {
  if (!size || size <= 1) return candles;
  const out = [];
  for (let i = 0; i < candles.length; i += size) {
    const chunk = candles.slice(i, i + size);
    if (!chunk.length) continue;
    out.push({
      time: chunk[0].time,
      open: chunk[0].open,
      high: Math.max(...chunk.map((c) => c.high)),
      low: Math.min(...chunk.map((c) => c.low)),
      close: chunk[chunk.length - 1].close,
    });
  }
  return out;
}

async function fetchYahoo(symbol, interval, trade) {
  const spec = CHART_INTERVALS.find((item) => item.id === interval) || CHART_INTERVALS[2];
  const ticker = yahooSymbol(symbol);
  if (!ticker) return [];
  const order = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y"];
  const needed = rangeForTrade(trade, spec.range);
  const range = order[Math.max(order.indexOf(spec.range), order.indexOf(needed))] || spec.range;
  const query = `/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${spec.yahoo}&range=${range}&includePrePost=false`;
  const urls = [`${yahooBase()}${query}`];
  if (import.meta.env.DEV) urls.push(`https://query1.finance.yahoo.com${query}`);
  let lastError = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastError = new Error(`Yahoo ${res.status}`);
        continue;
      }
      const json = await res.json();
      if (json?.chart?.error) {
        lastError = new Error(json.chart.error.description || "Yahoo error");
        continue;
      }
      const candles = groupCandles(parseYahooChart(json), spec.group || 0);
      if (candles.length) return candles;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) throw lastError;
  return [];
}

function binanceInterval(id) {
  if (id === "1H") return "1h";
  if (id === "4H") return "4h";
  if (id === "1D") return "1d";
  return id.toLowerCase();
}

async function fetchBinance(symbol, interval) {
  const pair = binanceSymbol(symbol);
  if (!pair) return [];
  const spec = CHART_INTERVALS.find((item) => item.id === interval) || CHART_INTERVALS[2];
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${binanceInterval(spec.id)}&limit=500`
  );
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  })).filter((c) => Number.isFinite(c.open) && Number.isFinite(c.close));
}

export async function fetchTradeCandles(symbol, interval, trade) {
  const errors = [];
  try {
    const yahoo = await fetchYahoo(symbol, interval, trade);
    if (yahoo.length) return { candles: yahoo, source: "yahoo" };
  } catch (err) {
    errors.push(err?.message || "Yahoo");
  }
  try {
    const binance = await fetchBinance(symbol, interval);
    if (binance.length) return { candles: binance, source: "binance" };
  } catch (err) {
    errors.push(err?.message || "Binance");
  }
  return { candles: [], source: null, error: errors[0] || "no-data" };
}

function pipSize(symbol, entry) {
  const s = String(symbol || "").toUpperCase();
  if (s.includes("JPY")) return 0.01;
  if (s.includes("XAU") || s.includes("GOLD")) return 0.1;
  if (entry != null && entry > 50) return 0.01;
  return 0.0001;
}

function levelFromPips(entry, pips, direction, symbol, side) {
  const e = toNumber(entry);
  const p = toNumber(pips);
  if (e === null || p === null) return null;
  const pip = pipSize(symbol, e);
  const long = normalizeDirection(direction) === "Long";
  if (side === "sl") return long ? e - p * pip : e + p * pip;
  return long ? e + p * pip : e - p * pip;
}

function looksLikePrice(value, entry) {
  const v = toNumber(value);
  const e = toNumber(entry);
  if (v === null || e === null || e === 0) return false;
  return Math.abs(v - e) / Math.abs(e) < 0.15;
}

export function tradePriceLevels(trade) {
  const entry = toNumber(trade?.entry_price);
  const exit = toNumber(trade?.exit_price);
  const slPrice = looksLikePrice(trade?.stop_loss, entry)
    ? toNumber(trade.stop_loss)
    : levelFromPips(entry, trade?.stop_loss_pips, trade?.direction, trade?.symbol, "sl");
  const tpPrice = looksLikePrice(trade?.take_profit, entry)
    ? toNumber(trade.take_profit)
    : looksLikePrice(trade?.take_profit_amount, entry)
      ? toNumber(trade.take_profit_amount)
      : levelFromPips(entry, trade?.take_profit_pips, trade?.direction, trade?.symbol, "tp");

  const executions = [];
  if (entry !== null) {
    executions.push({
      id: "entry",
      kind: "ENTRY",
      price: entry,
      time: tradeUnix(trade, "entry"),
    });
  }
  const outs = Array.isArray(trade?.scale_outs) ? trade.scale_outs : [];
  outs.forEach((item, idx) => {
    const price = toNumber(item.price);
    if (price === null) return;
    executions.push({
      id: item.id || `partial-${idx}`,
      kind: "EXEC",
      price,
      time: item.time ? tradeUnix({ date: trade?.date, entry_time: item.time }, "entry") : null,
    });
  });
  if (exit !== null) {
    executions.push({
      id: "exit",
      kind: "EXIT",
      price: exit,
      time: tradeUnix(trade, "exit"),
    });
  }

  return {
    entry,
    exit,
    sl: slPrice,
    tp: tpPrice,
    executions,
    isLong: normalizeDirection(trade?.direction) !== "Short",
    isClosed: isClosedTrade(trade),
  };
}

export function visibleRangeForTrade(candles, trade, intervalSec) {
  if (!candles.length) return null;
  const entry = tradeUnix(trade, "entry") || candles[0].time;
  const exit = tradeUnix(trade, "exit") || (trade?.exit_price != null ? candles[candles.length - 1].time : entry);
  const pad = Math.max(intervalSec * 24, 60 * 60);
  const from = Math.max(candles[0].time, Math.min(entry, exit) - pad);
  const to = Math.min(candles[candles.length - 1].time, Math.max(entry, exit) + pad);
  if (to <= from) return { from: candles[0].time, to: candles[candles.length - 1].time };
  return { from, to };
}

export function intervalSeconds(id) {
  const map = { "1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1H": 3600, "4H": 14400, "1D": 86400 };
  return map[id] || 900;
}
