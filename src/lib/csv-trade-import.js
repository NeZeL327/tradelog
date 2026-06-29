/** Shared CSV trade import parsers + deduplication for Accounts / Billing */

export const IMPORT_BROKERS = [
  { id: "auto", label: "Auto (wykryj format)" },
  { id: "fundednext", label: "FundedNext" },
  { id: "mt4", label: "MetaTrader 4 / MT5" },
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

export function parseCSVContent(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Plik CSV jest pusty");

  let delimiter = detectCSVDelimiter(lines[0]);
  let headerCells = parseCSVLine(lines[0], delimiter);
  headerCells = unwrapSingleColumnRow(headerCells, delimiter === ";" ? "," : delimiter);

  if (headerCells.length <= 2 && lines[0].includes(",")) {
    const commaHeaders = parseCSVLine(lines[0], ",");
    if (commaHeaders.length > headerCells.length) {
      headerCells = commaHeaders;
      delimiter = ",";
    }
  }

  const headers = headerCells.map((h) => h.replace(/"/g, "").replace(/^\uFEFF/, "").trim());

  const rows = lines.slice(1).filter((line) => {
    const unwrapped = unwrapSingleColumnRow(parseCSVLine(line, delimiter), delimiter === ";" ? "," : delimiter);
    const first = (unwrapped[0] || "").trim().toLowerCase();
    return first && !first.includes("total") && !first.includes("sum");
  });

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

function rowToMap(headers, line, delimiter) {
  let cells = parseCSVLine(line, delimiter).map((c) => c.replace(/"/g, "").replace(/^\uFEFF/, "").trim());
  cells = unwrapSingleColumnRow(cells, delimiter === ";" ? "," : delimiter);

  const map = {};
  headers.forEach((header, index) => {
    const key = String(header).replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, " ");
    map[key] = cells[index] ?? "";
  });
  return map;
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
  return getField(row, "swap", "swaps", "rollover", "overnight");
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
    "profit/loss"
  );
}

function parseDirection(value) {
  const v = (value || "").toLowerCase();
  if (v.includes("buy") || v.includes("long")) return "Long";
  if (v.includes("sell") || v.includes("short")) return "Short";
  return value || "Long";
}

export function parseNum(value) {
  if (value === "" || value == null) return null;

  let s = String(value).trim().replace(/\u00A0/g, "").replace(/\s/g, "");
  if (!s) return null;

  // (123.45) → -123.45
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
  // Niektóre eksporty CSV podają prowizję jako dodatnią kwotę kosztu
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
    stop_loss: parseNum(getField(r, "sl", "s/l", "stop loss")),
    take_profit: parseNum(getField(r, "tp", "t/p", "take profit")),
    pips: parseNum(getField(r, "pips")),
  };

  return finalizeTrade(trade);
}

function parseMT4Row(r, accountId, brokerId) {
  const type = (getField(r, "type", "side", "cmd") || "").toLowerCase();
  if (type && !type.includes("buy") && !type.includes("sell")) return null;

  const open = splitDateTime(getField(r, "open time", "time"));
  const close = splitDateTime(getField(r, "close time"));

  const lots = parseNum(getField(r, "lots", "lot", "size", "volume"));
  const trade = {
    ...baseTrade(accountId, brokerId),
    external_ticket: normalizeTicket(getField(r, "ticket id", "ticket", "id")),
    date: open.date,
    time: open.time,
    entry_time: open.time,
    close_date: close.date || "",
    exit_time: close.time,
    symbol: getField(r, "symbol").toUpperCase(),
    direction: parseDirection(getField(r, "type", "side", "cmd")),
    position_size: lots,
    quantity: lots,
    entry_price: parseNum(getField(r, "open price", "price")),
    exit_price: parseNum(getField(r, "close price", "close")),
    stop_loss: parseNum(getField(r, "sl", "s/l", "stop loss")),
    take_profit: parseNum(getField(r, "tp", "t/p", "take profit")),
    profit_loss: parseNum(getProfitField(r)),
    commission: parseNum(getFeeField(r)),
    swap: parseNum(getSwapField(r)),
  };

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

function normalizeTicket(value) {
  if (value === "" || value == null) return "";
  return String(value).trim().replace(/^#/, "");
}

/** Klucze dopasowania — im więcej trafień, tym pewniejsze wykrycie duplikatu. */
export function tradeImportFingerprints(trade) {
  const accountId = String(trade.account_id || "");
  const ticket = normalizeTicket(trade.external_ticket);
  const symbol = String(trade.symbol || "").toUpperCase().trim();

  const { date, time } = splitDateTime(
    trade.date ? `${trade.date} ${trade.entry_time || trade.time || "00:00:00"}` : ""
  );

  const vol = trade.position_size ?? trade.quantity ?? trade.volume_units;
  const volKey = vol != null ? Number(parseFloat(vol).toFixed(4)) : "";
  const entry = parseNum(trade.entry_price);
  const exit = parseNum(trade.exit_price);
  const pl = parseNum(trade.profit_loss) ?? parseNum(trade.profit_loss_gross);

  const keys = [];

  if (ticket) {
    keys.push(`ticket:${accountId}:${ticket}`);
  }

  if (date && symbol) {
    keys.push(`sym:${accountId}:${symbol}:${date}:${time}:${volKey}`);
    if (entry != null && exit != null) {
      keys.push(`px:${accountId}:${symbol}:${date}:${Number(entry)}:${Number(exit)}:${volKey}`);
    }
    if (pl != null) {
      keys.push(`pl:${accountId}:${symbol}:${date}:${time}:${volKey}:${Number(pl.toFixed(2))}`);
    }
  }

  keys.push(`legacy:${accountId}:${date}|${time}|${volKey}`);

  return keys;
}

/** @deprecated Użyj tradeImportFingerprints — zostawione dla kompatybilności. */
export function tradeDedupKey(trade) {
  const fps = tradeImportFingerprints(trade);
  return fps[fps.length - 1] || "";
}

export function filterNewTrades(parsedTrades, existingTrades, accountId) {
  const knownKeys = new Set();

  for (const t of existingTrades) {
    if (String(t.account_id) !== String(accountId)) continue;
    for (const key of tradeImportFingerprints(t)) {
      knownKeys.add(key);
    }
  }

  const newTrades = [];
  let skipped = 0;
  const batchKeys = new Set(knownKeys);

  for (const trade of parsedTrades) {
    const fingerprints = tradeImportFingerprints({ ...trade, account_id: accountId });
    const isDuplicate = fingerprints.some((key) => batchKeys.has(key));

    if (isDuplicate) {
      skipped++;
      continue;
    }

    newTrades.push(trade);
    fingerprints.forEach((key) => batchKeys.add(key));
  }

  return { newTrades, skipped };
}
