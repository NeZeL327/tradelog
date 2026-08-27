/** Shared CSV/XML/XLSX trade import parsers + deduplication for Accounts / Billing */

import { isXlsxFileName, xlsxArrayBufferToCsvText } from "./xlsx-to-rows.js";

export const IMPORT_BROKERS = [
  { id: "auto", label: "Auto (wykryj format)" },
  { id: "fundednext", label: "FundedNext (CSV)" },
  { id: "mt4", label: "MetaTrader 4 / MT5 (CSV / XML / XLSX)" },
  { id: "tradingview", label: "TradingView" },
  { id: "custom", label: "AiKeepTrade (polski szablon)" },
];

export const BROKER_LABELS = Object.fromEntries(
  IMPORT_BROKERS.map((b) => [b.id, b.label])
);

function countDelimiterOutsideQuotes(line, delimiter) {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      i++;
      continue;
    }
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === delimiter) count++;
  }
  return count;
}

export function detectCSVDelimiter(headerLine) {
  const semicolons = countDelimiterOutsideQuotes(headerLine, ";");
  const commas = countDelimiterOutsideQuotes(headerLine, ",");
  const tabs = countDelimiterOutsideQuotes(headerLine, "\t");

  if (tabs >= semicolons && tabs >= commas && tabs >= 3) return "\t";
  if (semicolons > commas && semicolons >= 3) return ";";
  return ",";
}

export function parseCSVLine(line, delimiter = ",") {
  const result = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && inQuotes && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function unwrapSingleColumnRow(cells, fallbackDelimiter = ",") {
  if (cells.length !== 1) return cells;
  const raw = cells[0]?.replace(/^\uFEFF/, "").trim() || "";
  if (!raw.includes(fallbackDelimiter)) return cells;
  const reparsed = parseCSVLine(raw, fallbackDelimiter);
  return reparsed.length > 1 ? reparsed : cells;
}

/** MT4/MT5 reports often have account info above the real header row (EN + PL). */
function findCsvHeaderLineIndex(lines) {
  const limit = Math.min(lines.length, 200);
  for (let i = 0; i < limit; i++) {
    const lower = lines[i].replace(/^\uFEFF/, "").toLowerCase();
    if (!lower.includes(",") && !lower.includes(";") && !lower.includes("\t")) continue;

    // Skip section titles like "Pozycje,,,,,"
    const compact = lower.replace(/,/g, "").trim();
    if (
      compact === "pozycje" ||
      compact === "zlecenia" ||
      compact === "deale" ||
      compact === "orders" ||
      compact === "positions" ||
      compact === "deals" ||
      compact.startsWith("raport historii")
    ) {
      continue;
    }

    const hasTicket =
      lower.includes("ticket") ||
      lower.includes("deal") ||
      lower.includes("order") ||
      /(^|,)pozycja(,|$)/.test(lower);
    const hasOpen =
      lower.includes("open time") ||
      lower.includes("open date") ||
      lower.includes("czas otwarcia") ||
      lower.includes("czas") ||
      /(^|,)time(,|$)/.test(lower);
    const hasSymbol =
      lower.includes("symbol") ||
      lower.includes("item") ||
      lower.includes("instrument") ||
      lower.includes("para");
    const hasType =
      lower.includes("type") ||
      lower.includes("side") ||
      lower.includes("kierunek") ||
      lower.includes("direction") ||
      /(^|,)typ(,|$)/.test(lower);
    const hasProfit =
      lower.includes("profit") ||
      lower.includes("p&l") ||
      lower.includes("pnl") ||
      lower.includes("zysk");
    const hasVolume =
      lower.includes("volume") ||
      lower.includes("wolumen") ||
      lower.includes("wielkość") ||
      lower.includes("wielkosc") ||
      lower.includes("lots") ||
      lower.includes("size");
    const hasFunded = lower.includes("ticket id") && (lower.includes("open price") || lower.includes("open time"));
    const hasCustom = lower.includes("data") && lower.includes("symbol") && lower.includes("kierunek");
    const hasTv = lower.includes("trade id") || (lower.includes("entry price") && lower.includes("exit price"));
    const hasMt5Deal = lower.includes("deal") && hasProfit && (hasVolume || hasSymbol);
    // Polish MT: Czas, Pozycja, Symbol, Typ, Wolumen, Cena, … Zysk
    const hasPolishMt =
      lower.includes("czas") &&
      (hasType || hasProfit) &&
      (hasSymbol || hasTicket || hasVolume);

    // Skip Deals table headers — we only want closed Positions (matches FundedNext CSV)
    if (
      lower.includes("transakcja") ||
      (lower.includes("kierunek") && (lower.includes("deal") || lower.includes("wolumen"))) ||
      (lower.includes("direction") && lower.includes("deal"))
    ) {
      continue;
    }

    if (hasFunded) return i;
    if (hasCustom) return i;
    if (hasTv) return i;
    if (hasPolishMt) return i;
    if (hasMt5Deal) return i;
    if (hasTicket && (hasOpen || hasSymbol) && (hasType || hasProfit)) return i;
    if (hasOpen && hasType && hasSymbol) return i;
    if (hasTicket && hasProfit && hasSymbol) return i;
  }
  return 0;
}

function isMtSectionTitle(firstCell) {
  const first = String(firstCell || "").trim().toLowerCase();
  if (!first) return false;
  const compact = first.replace(/[:\s]+$/g, "");
  return (
    compact === "pozycje" ||
    compact === "zlecenia" ||
    compact === "deale" ||
    compact === "orders" ||
    compact === "positions" ||
    compact === "deals" ||
    compact === "orders history" ||
    compact === "working orders" ||
    compact === "open positions" ||
    compact === "results" ||
    compact === "wyniki" ||
    compact === "historia zleceń" ||
    compact === "historia zlecen" ||
    compact.startsWith("zlecenia ") ||
    compact.startsWith("deale ") ||
    compact.startsWith("pozycje ")
  );
}

function isMtMetaOrNoiseRow(firstCell) {
  const first = String(firstCell || "").trim().toLowerCase();
  if (!first) return true;
  if (isMtSectionTitle(first)) return true;
  return (
    first.includes("total") ||
    first.includes("sum") ||
    first.includes("balance") ||
    first.includes("credit") ||
    first.includes("suma") ||
    first.includes("wynik") ||
    first.startsWith("raport") ||
    first.startsWith("nazwa") ||
    first.startsWith("rachunek") ||
    first.startsWith("firma") ||
    first.startsWith("data:") ||
    first === "czas" ||
    first === "ticket" ||
    first === "ticket id"
  );
}

export function parseCSVContent(content) {
  const allLines = content.split(/\r?\n/).map((l) => l.replace(/^\uFEFF/, ""));
  const lines = allLines.filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Plik CSV jest pusty");

  const headerIndexInFiltered = findCsvHeaderLineIndex(lines);
  const dataLines = lines.slice(headerIndexInFiltered);
  if (dataLines.length < 2) throw new Error("Plik CSV nie zawiera wierszy transakcji");

  let delimiter = detectCSVDelimiter(dataLines[0]);
  let headerCells = parseCSVLine(dataLines[0], delimiter);
  headerCells = unwrapSingleColumnRow(headerCells, delimiter === ";" ? "," : delimiter);

  if (headerCells.length <= 2 && dataLines[0].includes(",")) {
    const commaHeaders = parseCSVLine(dataLines[0], ",");
    if (commaHeaders.length > headerCells.length) {
      headerCells = commaHeaders;
      delimiter = ",";
    }
  }

  const headers = headerCells.map((h) => h.replace(/"/g, "").replace(/^\uFEFF/, "").trim());

  // Prefer closed Positions only — stop before Orders/Deals sections (MT5 ReportHistory).
  // Otherwise deal rows become fake "new" trades vs FundedNext CSV.
  const rows = [];
  for (const line of dataLines.slice(1)) {
    const unwrapped = unwrapSingleColumnRow(parseCSVLine(line, delimiter), delimiter === ";" ? "," : delimiter);
    const first = (unwrapped[0] || "").trim();
    const firstLower = first.toLowerCase();

    if (isMtSectionTitle(firstLower)) break;

    // New header row of another table (e.g. Deals) → stop
    const joined = unwrapped.join(",").toLowerCase();
    if (
      rows.length > 0 &&
      ((joined.includes("transakcja") && joined.includes("symbol")) ||
        (joined.includes("deal") && joined.includes("direction")) ||
        (firstLower === "czas" && joined.includes("typ") && joined.includes("symbol")))
    ) {
      break;
    }

    if (isMtMetaOrNoiseRow(firstLower)) continue;
    if (unwrapped.length < 3 && !/\d/.test(first)) continue;
    rows.push(line);
  }

  return { headers, rows, delimiter };
}

function normalizeDatePart(dateRaw) {
  if (!dateRaw) return "";
  const d = String(dateRaw).trim();

  const ymd = d.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  }

  const dmy = d.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  return d.replace(/\./g, "-");
}

export function splitDateTime(dt) {
  if (!dt) return { date: "", time: "" };

  const normalized = String(dt).trim().replace(/\u00A0/g, " ").replace("T", " ");
  const [dateRaw, ...timeParts] = normalized.split(/\s+/);
  const timeRaw = timeParts.join(" ").trim();

  const date = normalizeDatePart(dateRaw);
  const time = timeRaw.replace(/,/g, ":").slice(0, 8);

  return { date, time };
}

/**
 * MT4/MT5 CSV often repeats Price/Cena and Time/Czas (open then close).
 * Keep both — same idea as FundedNext Open Price / Close Price columns.
 * Also normalize "S / L" → "s/l", "T / P" → "t/p" (Excel/MT spacing).
 */
function normalizeHeaderName(header) {
  return String(header || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeHeaderKey(baseKey, seenCounts) {
  const key = normalizeHeaderName(baseKey);
  const count = seenCounts[key] || 0;
  seenCounts[key] = count + 1;
  if (count === 0) {
    if (key === "price" || key === "cena") return "open price";
    if (key === "czas" || key === "time") return "open time";
    return key;
  }
  if (key === "price" || key === "cena" || key === "open price") return "close price";
  if (key === "time" || key === "czas" || key === "open time") return "close time";
  return `${key} ${count + 1}`;
}

function rowToMap(headers, line, delimiter) {
  let cells = parseCSVLine(line, delimiter).map((c) => c.replace(/"/g, "").replace(/^\uFEFF/, "").trim());
  cells = unwrapSingleColumnRow(cells, delimiter === ";" ? "," : delimiter);

  const map = {};
  const seenCounts = {};
  headers.forEach((header, index) => {
    const key = dedupeHeaderKey(header, seenCounts);
    map[key] = cells[index] ?? "";
  });
  return map;
}

/** SL/TP: MT uses 0 when not set — treat as empty (like missing). */
function parseOptionalLevel(value) {
  const n = parseNum(value);
  if (n == null || n === 0) return null;
  return n;
}

function getStopLossField(row) {
  return getField(
    row,
    "s/l",
    "sl",
    "stop loss",
    "stoploss",
    "stop",
    "sl price",
    "price sl"
  );
}

function getTakeProfitField(row) {
  return getField(
    row,
    "t/p",
    "tp",
    "take profit",
    "takeprofit",
    "take",
    "tp price",
    "price tp"
  );
}

function getField(row, ...keys) {
  const normalizedKeys = keys.map((k) => k.toLowerCase().trim());

  for (const key of normalizedKeys) {
    const val = row[key];
    if (val !== undefined && val !== "") return val;
  }

  for (const [header, val] of Object.entries(row)) {
    if (val === undefined || val === "") continue;
    const h = String(header).toLowerCase().trim();
    for (const key of normalizedKeys) {
      if (h === key || h.includes(key) || key.includes(h)) return val;
    }
  }

  return "";
}

function getFeeField(row, ...extraPatterns) {
  return getField(
    row,
    "commission",
    "commissions",
    "comm",
    "prowizja",
    "fee",
    "fees",
    "brokerage",
    ...extraPatterns
  );
}

function getSwapField(row) {
  return getField(row, "swap", "swaps", "rollover", "overnight", "swap points");
}

function getProfitField(row) {
  return getField(
    row,
    "profit",
    "p&l",
    "pnl",
    "net profit",
    "net p&l",
    "zysk",
    "profit/loss",
    "wynik"
  );
}

function parseDirection(value) {
  const v = (value || "").toLowerCase();
  if (
    v === "0" ||
    v === "op_buy" ||
    v.includes("buy") ||
    v.includes("long") ||
    v.includes("kupno") ||
    v.includes("kup ")
  ) {
    return "Long";
  }
  if (
    v === "1" ||
    v === "op_sell" ||
    v.includes("sell") ||
    v.includes("short") ||
    v.includes("sprzeda")
  ) {
    return "Short";
  }
  return value || "Long";
}

export function parseNum(value) {
  if (value === "" || value == null) return null;

  let s = String(value).trim().replace(/\u00A0/g, "").replace(/\s/g, "");
  if (!s) return null;

  const paren = s.match(/^\((.+)\)$/);
  if (paren) s = `-${paren[1]}`;

  s = s.replace(/\u2212/g, "-");
  s = s.replace(/[^\d.,+\-]/g, "");
  if (!s || s === "-" || s === "+") return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    const idx = s.lastIndexOf(",");
    const before = s.slice(0, idx);
    const after = s.slice(idx + 1);
    if (/^-?\d+$/.test(before) && /^\d+$/.test(after)) {
      s = `${before}.${after}`;
    } else {
      s = s.replace(/,/g, "");
    }
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function baseTrade(accountId, brokerId) {
  return {
    account_id: String(accountId),
    status: "Closed",
    imported: true,
    import_broker: brokerId,
  };
}

function normalizeImportedCommission(value) {
  const n = parseNum(value);
  if (n == null || n === 0) return 0;
  return n < 0 ? n : -Math.abs(n);
}

function finalizeTrade(obj) {
  const gross = parseNum(obj.profit_loss);
  let commission = obj.imported ? normalizeImportedCommission(obj.commission) : (parseNum(obj.commission) ?? 0);
  const swap = parseNum(obj.swap) ?? 0;

  if (obj.imported && commission !== 0) {
    obj.commission = commission;
  }

  let profit = gross;
  if (obj.imported && gross != null) {
    obj.profit_loss_gross = gross;
    profit = gross + commission + swap;
    obj.profit_loss = profit;
    obj.fees_included_in_pl = true;
  } else if (gross != null) {
    profit = gross;
  } else {
    profit = 0;
  }

  if (obj.profit_loss != null && !obj.outcome) {
    obj.outcome = profit > 0 ? "Win" : profit < 0 ? "Loss" : "Breakeven";
  }

  if (obj.stop_loss != null && obj.stop_loss_amount == null) {
    obj.stop_loss_amount = obj.stop_loss;
  }
  if (obj.take_profit != null && obj.take_profit_amount == null) {
    obj.take_profit_amount = obj.take_profit;
  }

  if (obj.position_size != null && obj.quantity == null) {
    obj.quantity = obj.position_size;
  }

  if (
    obj.profit_loss != null &&
    obj.entry_price &&
    obj.position_size &&
    !obj.profit_loss_percent
  ) {
    const denom = obj.entry_price * obj.position_size;
    if (denom) {
      const pct = (profit / denom) * 100;
      if (Math.abs(pct) < 10000) obj.profit_loss_percent = pct.toFixed(2);
    }
  }

  return obj;
}

export function detectBrokerFormat(headers) {
  const h = headers.map((x) => x.toLowerCase()).join(",");
  if (h.includes("ticket id") && (h.includes("open price") || h.includes("open time"))) return "fundednext";
  if (h.includes("ticket") && h.includes("swap") && (h.includes("open time") || h.includes("time"))) return "mt4";
  if (h.includes("trade id") || h.includes("instrument") || h.includes("qty")) return "tradingview";
  if (headers.includes("Data") && headers.includes("Symbol") && headers.includes("Kierunek")) return "custom";
  return "mt4";
}

function parseFundedNextRow(r, accountId, brokerId) {
  const type = (getField(r, "type") || "").toLowerCase();
  if (type && type !== "buy" && type !== "sell") return null;

  const open = splitDateTime(getField(r, "open time", "time", "open date"));
  const close = splitDateTime(getField(r, "close time", "close date"));

  const lots = parseNum(getField(r, "lots", "lot", "size"));
  const volume = parseNum(getField(r, "volume"));
  const positionSize = lots ?? (volume != null ? volume / 100 : null);

  const trade = {
    ...baseTrade(accountId, brokerId),
    external_ticket: normalizeTicket(getField(r, "ticket id", "ticket", "id")),
    date: open.date,
    time: open.time,
    entry_time: open.time,
    close_date: close.date || open.date,
    exit_time: close.time,
    symbol: getField(r, "symbol", "instrument").toUpperCase(),
    direction: parseDirection(getField(r, "type", "side")),
    position_size: positionSize,
    quantity: positionSize,
    volume_units: volume,
    entry_price: parseNum(getField(r, "open price", "price", "entry")),
    exit_price: parseNum(getField(r, "close price", "close", "exit")),
    profit_loss: parseNum(getProfitField(r)),
    commission: parseNum(getFeeField(r)),
    swap: parseNum(getSwapField(r)),
    stop_loss: parseOptionalLevel(getField(r, "sl", "s/l", "stop loss")),
    take_profit: parseOptionalLevel(getField(r, "tp", "t/p", "take profit")),
    pips: parseNum(getField(r, "pips")),
  };

  return finalizeTrade(trade);
}

/**
 * MetaTrader 4/5 (EN + PL headers) → same journal fields as FundedNext.
 * PL: Czas, Pozycja, Symbol, Typ, Wolumen, Cena, Prowizja, Swap, Zysk
 */
function parseMT4Row(r, accountId, brokerId) {
  const typeRaw = getField(r, "type", "typ", "side", "cmd", "direction", "kierunek");
  const type = String(typeRaw || "").toLowerCase().trim();

  if (
    type &&
    (type.includes("balance") ||
      type.includes("credit") ||
      type.includes("deposit") ||
      type.includes("withdrawal") ||
      type.includes("tax") ||
      type.includes("saldo") ||
      type.includes("kredyt") ||
      type.includes("wpłata") ||
      type.includes("wplata") ||
      type.includes("wypłata") ||
      type.includes("wyplata") ||
      type === "buy limit" ||
      type === "sell limit" ||
      type === "buy stop" ||
      type === "sell stop")
  ) {
    return null;
  }

  const isBuySell =
    !type ||
    type.includes("buy") ||
    type.includes("sell") ||
    type.includes("kupno") ||
    type.includes("sprzeda") ||
    type.includes("long") ||
    type.includes("short") ||
    type === "0" ||
    type === "1" ||
    type === "in" ||
    type === "out";

  if (type && !isBuySell) return null;

  const open = splitDateTime(
    getField(
      r,
      "open time",
      "czas otwarcia",
      "opentime",
      "open date",
      "czas",
      "time",
      "date/time",
      "datetime"
    )
  );
  const close = splitDateTime(
    getField(r, "close time", "czas zamknięcia", "czas zamkniecia", "closetime", "close date")
  );

  const lots = parseNum(
    getField(r, "lots", "lot", "size", "wolumen", "volume", "wielkość", "wielkosc", "ilość", "ilosc")
  );
  const volume = parseNum(getField(r, "volume", "wolumen"));
  const positionSize = lots ?? volume;

  const symbol = getField(r, "symbol", "item", "instrument", "para").toUpperCase();
  if (!symbol || !open.date) return null;

  const trade = {
    ...baseTrade(accountId, brokerId),
    external_ticket: normalizeTicket(
      getField(r, "ticket id", "ticket", "pozycja", "order", "deal", "position", "zlecenie", "id")
    ),
    date: open.date,
    time: open.time,
    entry_time: open.time,
    close_date: close.date || open.date,
    exit_time: close.time || open.time,
    symbol,
    direction: parseDirection(typeRaw),
    position_size: positionSize,
    quantity: positionSize,
    entry_price: parseNum(
      getField(r, "open price", "price open", "openprice", "cena otwarcia", "cena", "price")
    ),
    exit_price: parseNum(
      getField(r, "close price", "price close", "closeprice", "cena zamknięcia", "cena zamkniecia", "exit price")
    ),
    profit_loss: parseNum(getProfitField(r)),
    commission: parseNum(getFeeField(r)),
    swap: parseNum(getSwapField(r)),
    stop_loss: parseOptionalLevel(getStopLossField(r)),
    take_profit: parseOptionalLevel(getTakeProfitField(r)),
    pips: parseNum(getField(r, "pips", "pipsy")),
  };

  if (volume != null && lots == null) {
    trade.volume_units = volume;
  }

  if (trade.exit_price == null) {
    trade.exit_price = parseNum(getField(r, "close price", "price 2", "cena 2"));
  }

  return finalizeTrade(trade);
}

function parseTradingViewRow(r, accountId, brokerId) {
  const open = splitDateTime(getField(r, "date/time opened", "opened", "date"));
  const close = splitDateTime(getField(r, "date/time closed", "closed"));

  const qty = parseNum(getField(r, "qty", "contracts", "quantity"));
  const trade = {
    ...baseTrade(accountId, brokerId),
    date: open.date,
    time: open.time,
    entry_time: open.time,
    close_date: close.date,
    exit_time: close.time,
    symbol: getField(r, "symbol", "instrument", "ticker").toUpperCase(),
    direction: parseDirection(getField(r, "side", "type", "buy")),
    position_size: qty,
    quantity: qty,
    entry_price: parseNum(getField(r, "entry price", "entry")),
    exit_price: parseNum(getField(r, "exit price", "exit")),
    profit_loss: parseNum(getProfitField(r)),
    commission: parseNum(getFeeField(r)),
    notes: "Imported from TradingView",
  };

  return finalizeTrade(trade);
}

function parseCustomRow(headers, line, accountId, brokerId, delimiter) {
  let cells = parseCSVLine(line, delimiter).map((c) => c.replace(/"/g, "").trim());
  cells = unwrapSingleColumnRow(cells, delimiter === ";" ? "," : delimiter);
  const obj = { ...baseTrade(accountId, brokerId) };

  headers.forEach((header, index) => {
    const value = cells[index];
    if (!value) return;
    switch (header) {
      case "Data":
        {
          const split = splitDateTime(value);
          obj.date = split.date || normalizeDatePart(value);
          if (split.time) {
            obj.time = split.time;
            obj.entry_time = split.time;
          }
        }
        break;
      case "Status":
        obj.status = value || "Closed";
        break;
      case "Symbol":
        obj.symbol = value.toUpperCase();
        break;
      case "Kierunek":
        obj.direction = value;
        break;
      case "Entry":
        obj.entry_price = parseNum(value);
        break;
      case "Exit":
        obj.exit_price = parseNum(value);
        break;
      case "Pozycja":
        obj.position_size = parseNum(value);
        obj.quantity = obj.position_size;
        break;
      case "P&L":
        obj.profit_loss = parseNum(value);
        break;
      case "Prowizja":
      case "Commission":
        obj.commission = parseNum(value);
        break;
      case "Swap":
        obj.swap = parseNum(value);
        break;
      case "P&L %":
        obj.profit_loss_percent = parseNum(value);
        break;
      case "Wynik":
        obj.outcome = value;
        break;
      case "Setup":
        obj.setup_quality = value;
        break;
      case "Timeframe":
        obj.timeframe = value;
        break;
      default:
        break;
    }
  });

  return finalizeTrade(obj);
}

export function parseTradesFromCSV(content, { accountId, brokerId = "auto" }) {
  const { headers, rows, delimiter } = parseCSVContent(content);
  const format = brokerId === "auto" ? detectBrokerFormat(headers) : brokerId;

  const trades = rows
    .map((line) => {
      const r = rowToMap(headers, line, delimiter);
      switch (format) {
        case "fundednext":
          return parseFundedNextRow(r, accountId, format);
        case "tradingview":
          return parseTradingViewRow(r, accountId, format);
        case "custom":
          return parseCustomRow(headers, line, accountId, format, delimiter);
        case "mt4":
        default:
          return parseMT4Row(r, accountId, format);
      }
    })
    .filter((t) => t && t.symbol && t.date);

  return { trades, format, delimiter };
}

// ─── MT4 / MT5 XML ───────────────────────────────────────────────────────────

export function isXmlContent(content, fileName = "") {
  const name = String(fileName || "").toLowerCase();
  if (name.endsWith(".xml")) return true;
  const trimmed = String(content || "").trim().replace(/^\uFEFF/, "");
  return trimmed.startsWith("<?xml") || (/^<[A-Za-z_?]/.test(trimmed) && trimmed.includes("</"));
}

function normalizeXmlKey(name) {
  return String(name || "")
    .replace(/^[a-z]+:/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function elementToRowMap(el) {
  const map = {};

  for (const attr of Array.from(el.attributes || [])) {
    const key = normalizeXmlKey(attr.name);
    if (key && attr.value !== "") map[key] = attr.value;
  }

  for (const child of Array.from(el.children || [])) {
    if (child.children?.length) continue;
    const key = normalizeXmlKey(child.tagName);
    const val = (child.textContent || "").trim();
    if (key && val !== "" && map[key] === undefined) map[key] = val;
  }

  return map;
}

function collectXmlTradeNodes(doc) {
  const selectors = [
    "Order", "order",
    "Deal", "deal",
    "Position", "position",
    "Trade", "trade",
    "Row", "row",
  ];
  const seen = new Set();
  const nodes = [];

  for (const sel of selectors) {
    for (const el of Array.from(doc.querySelectorAll(sel))) {
      if (seen.has(el)) continue;
      const tag = (el.tagName || "").toLowerCase();
      if (["orders", "deals", "positions", "trades", "history", "report"].includes(tag)) continue;
      seen.add(el);
      nodes.push(el);
    }
  }

  return nodes;
}

function parseMtXmlRow(r, accountId, brokerId) {
  const typeRaw = getField(r, "type", "side", "cmd", "direction", "entry");
  const type = String(typeRaw || "").toLowerCase();
  if (type.includes("balance") || type.includes("credit") || type.includes("deposit")) return null;
  return parseMT4Row(r, accountId, brokerId);
}

/** SpreadsheetML (Excel XML) used by some MT exporters */
function parseSpreadsheetMlTrades(doc, accountId, brokerId) {
  const rows = Array.from(doc.getElementsByTagName("Row"));
  if (rows.length < 2) return [];

  const cellText = (row) => {
    const cells = Array.from(row.getElementsByTagName("Cell"));
    return cells.map((cell) => {
      const data = cell.getElementsByTagName("Data")[0];
      return ((data || cell).textContent || "").trim();
    });
  };

  let headerIdx = -1;
  let headers = [];
  for (let i = 0; i < Math.min(rows.length, 80); i++) {
    const cells = cellText(rows[i]).filter(Boolean);
    if (!cells.length) continue;
    const lower = cells.join(",").toLowerCase();
    if (lower.includes("ticket") || (lower.includes("open") && lower.includes("symbol"))) {
      headerIdx = i;
      const seenCounts = {};
      headers = cells.map((h) =>
        dedupeHeaderKey(h.toLowerCase().replace(/\s+/g, " "), seenCounts)
      );
      break;
    }
  }
  if (headerIdx < 0) return [];

  const trades = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells = cellText(rows[i]);
    if (cells.length < 3) continue;
    const map = {};
    headers.forEach((h, idx) => {
      map[h] = cells[idx] ?? "";
    });
    const trade = parseMtXmlRow(map, accountId, brokerId);
    if (trade?.symbol && trade?.date) trades.push(trade);
  }
  return trades;
}

export function parseTradesFromXML(content, { accountId, brokerId = "auto" }) {
  const format = brokerId === "auto" || brokerId === "fundednext" ? "mt4" : brokerId;
  if (typeof DOMParser === "undefined") {
    throw new Error("Przeglądarka nie obsługuje parsowania XML");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Nieprawidłowy plik XML MetaTrader");
  }

  if (doc.getElementsByTagName("Workbook").length || doc.getElementsByTagName("Worksheet").length) {
    const trades = parseSpreadsheetMlTrades(doc, accountId, format);
    if (!trades.length) {
      throw new Error("XML nie zawiera transakcji buy/sell (MT4/MT5)");
    }
    return { trades, format: "mt4", delimiter: "xml" };
  }

  const nodes = collectXmlTradeNodes(doc);
  const trades = nodes
    .map((el) => parseMtXmlRow(elementToRowMap(el), accountId, format))
    .filter((t) => t && t.symbol && t.date);

  if (!trades.length) {
    throw new Error(
      "Nie znaleziono transakcji w XML. Użyj raportu historii MT4/MT5 (Order/Deal) lub CSV."
    );
  }

  return { trades, format: "mt4", delimiter: "xml" };
}

/**
 * Unified entry: CSV / XML / XLSX (MT4/MT5 Excel 2007 Open XML).
 * FundedNext CSV parser unchanged. Dedup uses existing account trades (any prior import).
 */
export async function parseTradesFromUpload(file, { accountId, brokerId = "auto" }) {
  const fileName = file?.name || "";
  const name = String(fileName).toLowerCase();

  if (isXlsxFileName(name)) {
    if (brokerId === "fundednext") {
      throw new Error("FundedNext obsługuje CSV — dla XLSX wybierz Auto lub MetaTrader 4/5.");
    }
    const buffer = await file.arrayBuffer();
    const csvText = await xlsxArrayBufferToCsvText(buffer);
    const lineCount = csvText.split(/\r?\n/).filter((l) => l.trim()).length;
    if (lineCount < 2) {
      throw new Error(
        `Plik XLSX odczytany, ale ma za mało wierszy (${lineCount}). Zapisz w MT jako CSV i spróbuj ponownie.`
      );
    }
    const parsed = parseTradesFromCSV(csvText, {
      accountId,
      brokerId: brokerId === "auto" ? "mt4" : brokerId,
    });
    if (!parsed.trades.length) {
      // Surface raw content hint for debugging MT layouts
      const previewLines = csvText.split(/\r?\n/).filter((l) => l.trim()).slice(0, 8);
      const err = new Error(
        `Odczytano ${lineCount} wierszy z XLSX, ale żadnego buy/sell. Sprawdź czy to historia pozycji (nie sami balans). Przykład wierszy: ${previewLines.join(" | ").slice(0, 280)}`
      );
      err.rawLineCount = lineCount;
      err.rawPreview = previewLines;
      throw err;
    }
    return { ...parsed, rawLineCount: lineCount };
  }

  const content = await file.text();
  return parseTradesFromFile(content, { accountId, brokerId, fileName });
}

/**
 * Unified entry for text content: CSV or MT4/MT5 XML.
 */
export function parseTradesFromFile(content, { accountId, brokerId = "auto", fileName = "" }) {
  const name = String(fileName || "").toLowerCase();
  const xml = isXmlContent(content, name);

  if (xml) {
    if (brokerId === "fundednext") {
      throw new Error("FundedNext obsługuje tylko CSV — wybierz plik CSV lub format Auto / MT4-MT5.");
    }
    return parseTradesFromXML(content, { accountId, brokerId: brokerId === "auto" ? "mt4" : brokerId });
  }

  return parseTradesFromCSV(content, { accountId, brokerId });
}

function normalizeTicket(value) {
  if (value === "" || value == null) return "";
  return String(value).trim().replace(/^#/, "");
}

/** Strip broker suffixes so FundedNext EURUSD matches MT EURUSDm. */
function normalizeSymbolKey(symbol) {
  return String(symbol || "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/(MICRO|RAW|PRO|ECN|SK|M)$/g, (suf, _i, s) => {
      // Keep symbols that are only the suffix; strip trailing broker marks
      if (s.length <= suf.length + 2) return suf;
      return "";
    });
}

/** Normalize to HH:mm:ss so re-imports match FundedNext / MT files. */
function normalizeTimeKey(time) {
  if (!time && time !== 0) return "";
  const m = String(time).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return String(time).trim().slice(0, 8);
  const hh = String(Math.min(23, Number(m[1]))).padStart(2, "0");
  const mm = String(Math.min(59, Number(m[2]))).padStart(2, "0");
  const ss = String(Math.min(59, Number(m[3] ?? 0))).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function roundPriceKey(value) {
  const n = parseNum(value);
  if (n == null) return "";
  return Number(n.toFixed(5));
}

/**
 * Dedup fingerprints. Keep keys time-specific — never symbol+date+vol alone
 * (many same-day GBPUSD 0.96 scalps were false "duplicates").
 */
export function tradeImportFingerprints(trade) {
  const accountId = String(trade.account_id || "");
  const ticket = normalizeTicket(
    trade.external_ticket || trade.ticket_id || trade.ticket
  );
  const symbol = normalizeSymbolKey(trade.symbol);

  const { date, time: rawTime } = splitDateTime(
    trade.date ? `${trade.date} ${trade.entry_time || trade.time || "00:00:00"}` : ""
  );
  const time = normalizeTimeKey(rawTime || trade.entry_time || trade.time || "");
  const timeMin = time ? time.slice(0, 5) : "";

  const vol = trade.position_size ?? trade.quantity ?? trade.volume_units;
  const volKey = vol != null && Number.isFinite(Number(vol)) ? Number(parseFloat(vol).toFixed(4)) : "";
  const entry = roundPriceKey(trade.entry_price);
  const exit = roundPriceKey(trade.exit_price);
  const net = parseNum(trade.profit_loss);

  const keys = [];

  // 1) Ticket / Pozycja — strongest across FundedNext ↔ MT
  if (ticket) {
    keys.push(`ticket:${accountId}:${ticket}`);
  }

  // 2) Date + open time + lots (FundedNext classic)
  if (date && time && volKey !== "") {
    keys.push(`dtvol:${accountId}:${date}|${time}|${volKey}`);
  }

  // 3) Symbol + full datetime + volume / prices / net
  if (date && symbol && time) {
    keys.push(`sym:${accountId}:${symbol}:${date}:${time}:${volKey}`);

    if (entry !== "" && exit !== "" && volKey !== "") {
      keys.push(`px:${accountId}:${symbol}:${date}:${entry}:${exit}:${volKey}`);
    }
    if (net != null && timeMin) {
      keys.push(`net:${accountId}:${symbol}:${date}:${timeMin}:${Number(net.toFixed(2))}`);
    }
  }

  return keys;
}

/** @deprecated Użyj tradeImportFingerprints — zostawione dla kompatybilności. */
export function tradeDedupKey(trade) {
  const fps = tradeImportFingerprints(trade);
  return fps[fps.length - 1] || "";
}

/**
 * Dedup against journal on this account.
 * Ticket match is authoritative; otherwise time-based fingerprints
 * (symbol+date+lots alone is NOT used — same-day scalps were false duplicates).
 */
export function filterNewTrades(parsedTrades, existingTrades, accountId) {
  const knownKeys = new Set();
  const knownTickets = new Set();
  const account = String(accountId || "");

  for (const t of existingTrades || []) {
    const tradeAccount = String(t.account_id ?? t.accountId ?? "");
    if (tradeAccount && tradeAccount !== account) continue;
    for (const key of tradeImportFingerprints({ ...t, account_id: account || tradeAccount })) {
      knownKeys.add(key);
    }
    const ticket = normalizeTicket(t.external_ticket || t.ticket_id || t.ticket);
    if (ticket) {
      knownTickets.add(ticket);
      knownKeys.add(`ticket:${account}:${ticket}`);
    }
  }

  const newTrades = [];
  let skipped = 0;
  const batchKeys = new Set(knownKeys);
  const batchTickets = new Set(knownTickets);

  for (const trade of parsedTrades) {
    const ticket = normalizeTicket(trade.external_ticket || trade.ticket_id || trade.ticket);
    const fingerprints = tradeImportFingerprints({ ...trade, account_id: account });

    const isDuplicate =
      (ticket && batchTickets.has(ticket)) ||
      fingerprints.some((key) => batchKeys.has(key));

    if (isDuplicate) {
      skipped++;
      continue;
    }

    newTrades.push(trade);
    fingerprints.forEach((key) => batchKeys.add(key));
    if (ticket) batchTickets.add(ticket);
  }

  return { newTrades, skipped };
}
