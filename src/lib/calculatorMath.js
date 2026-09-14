/** Forex / CFD position and risk helpers used by default calculators. */

const STANDARD_LOT = 100000;

export function toNum(value, fallback = 0) {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export function pipSize(symbol, price) {
  const s = String(symbol || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (s.includes("JPY") || s.endsWith("JPY")) return 0.01;
  if (s.includes("XAU") || s.includes("GOLD")) return 0.01;
  if (s.includes("XAG") || s.includes("SILVER")) return 0.001;
  const p = toNum(price, 0);
  if (p >= 50) return 0.01;
  return 0.0001;
}

export function pipValuePerLot(symbol, price) {
  const s = String(symbol || "").toUpperCase().replace(/[^A-Z]/g, "");
  const size = pipSize(symbol, price);
  const px = toNum(price, 0) || 1;
  if (!s) return size * STANDARD_LOT;
  const quote = s.slice(-3);
  const base = s.slice(0, 3);
  if (quote === "USD" || quote === "USDT") return size * STANDARD_LOT;
  if (base === "USD") return (size / px) * STANDARD_LOT;
  return size * STANDARD_LOT;
}

export function priceDistance(entry, other) {
  return Math.abs(toNum(entry) - toNum(other));
}

export function distancePips(symbol, entry, other) {
  const dist = priceDistance(entry, other);
  const pip = pipSize(symbol, entry);
  if (!pip) return 0;
  return dist / pip;
}

export function computePositionRisk({
  symbol,
  direction = "long",
  balance,
  riskPct,
  entry,
  sl,
  tp,
}) {
  const bal = toNum(balance);
  const risk = toNum(riskPct);
  const e = toNum(entry);
  const stop = toNum(sl);
  const take = toNum(tp);
  const riskUsd = bal * (risk / 100);
  const slPips = e && stop ? distancePips(symbol, e, stop) : 0;
  const tpPips = e && take ? distancePips(symbol, e, take) : 0;
  const pv = pipValuePerLot(symbol, e || stop);
  const lots = slPips > 0 && pv > 0 ? riskUsd / (slPips * pv) : 0;
  const rr = slPips > 0 ? tpPips / slPips : 0;
  const potentialLoss = lots * slPips * pv;
  const potentialProfit = lots * tpPips * pv;
  const long = String(direction).toLowerCase() !== "short";
  return {
    riskUsd,
    slPips,
    tpPips,
    lots,
    rr,
    potentialLoss,
    potentialProfit,
    pipValue: pv,
    direction: long ? "long" : "short",
  };
}

export function computePipsValue({ symbol, price, lots, pips }) {
  const pv = pipValuePerLot(symbol, price);
  const nLots = toNum(lots);
  const nPips = toNum(pips);
  return {
    pipValue: pv,
    value: nLots * nPips * pv,
    oneLot: nPips * pv,
  };
}

export function computeMargin({ price, lots, leverage }) {
  const notional = toNum(lots) * STANDARD_LOT * toNum(price);
  const lev = Math.max(toNum(leverage), 1);
  return {
    notional,
    margin: notional / lev,
    usedPct: lev ? 100 / lev : 0,
  };
}

export function computeBreakEven({ entry, lots, commission, symbol, direction }) {
  const e = toNum(entry);
  const nLots = toNum(lots);
  const cost = toNum(commission);
  const pv = pipValuePerLot(symbol, e);
  const pips = nLots > 0 && pv > 0 ? cost / (nLots * pv) : 0;
  const pip = pipSize(symbol, e);
  const long = String(direction).toLowerCase() !== "short";
  const bePrice = e + (long ? 1 : -1) * pips * pip;
  return { bePips: pips, bePrice, cost };
}

export function computeProfit({ symbol, entry, exit, lots, direction }) {
  const e = toNum(entry);
  const x = toNum(exit);
  const nLots = toNum(lots);
  const long = String(direction).toLowerCase() !== "short";
  const pips = distancePips(symbol, e, x);
  const signed = (long ? x - e : e - x) >= 0 ? pips : -pips;
  const pv = pipValuePerLot(symbol, e);
  return { pips: signed, profit: signed * pv * nLots };
}

export function computeTpSl({ entry, slPips, rr, symbol, direction }) {
  const e = toNum(entry);
  const sl = toNum(slPips);
  const ratio = toNum(rr);
  const pip = pipSize(symbol, e);
  const long = String(direction).toLowerCase() !== "short";
  const slPrice = e + (long ? -1 : 1) * sl * pip;
  const tpPrice = e + (long ? 1 : -1) * sl * ratio * pip;
  return { slPrice, tpPrice, tpPips: sl * ratio };
}

export function computeSessionDuration(start, end) {
  const parse = (v) => {
    const [h, m] = String(v || "00:00").split(":").map((n) => parseInt(n, 10) || 0);
    return h * 60 + m;
  };
  let a = parse(start);
  let b = parse(end);
  if (b < a) b += 24 * 60;
  const mins = b - a;
  return { minutes: mins, hours: mins / 60, label: `${Math.floor(mins / 60)}h ${mins % 60}m` };
}

export function convertLots(lots, from = "standard") {
  const n = toNum(lots);
  const toStandard = from === "mini" ? n / 10 : from === "micro" ? n / 100 : n;
  return {
    standard: toStandard,
    mini: toStandard * 10,
    micro: toStandard * 100,
  };
}

export function formatNum(value, digits = 2) {
  const n = toNum(value, NaN);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pl-PL", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function emptyPosition() {
  return {
    instrument: "EURUSD",
    direction: "long",
    balance: "10000",
    riskPct: "1",
    entry: "",
    sl: "",
    tp: "",
  };
}
