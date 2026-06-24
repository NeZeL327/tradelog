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

export function parseCSVLine(line) {
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
    } else if (ch === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

export function parseCSVContent(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Plik CSV jest pusty");

  const headers = parseCSVLine(lines[0]).map((h) => h.replace(/"/g, "").trim());
  const rows = lines.slice(1).filter((line) => {
    const firstCell = parseCSVLine(line)[0]?.trim().toLowerCase() || "";
    return firstCell && !firstCell.includes("total") && !firstCell.includes("sum");
  });

  return { headers, rows };
}

export function splitDateTime(dt) {
  if (!dt) return { date: "", time: "" };
  const normalized = String(dt).trim().replace(/\./g, "-").replace("T", " ");
  const [dateRaw, timeRaw = ""] = normalized.split(/\s+/);
  let date = dateRaw || "";

  if (date.includes("/")) {
    const [d, m, y] = date.split("/");
    date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const time = timeRaw.slice(0, 8);
  return { date, time };
}

function rowToMap(headers, line) {
  const cells = parseCSVLine(line).map((c) => c.replace(/"/g, "").trim());
  const map = {};
  headers.forEach((header, index) => {
    map[header.toLowerCase()] = cells[index] ?? "";
  });
  return map;
}

function parseDirection(value) {
  const v = (value || "").toLowerCase();
  if (v.includes("buy") || v.includes("long")) return "Long";
  if (v.includes("sell") || v.includes("short")) return "Short";
  return value || "Long";
}

function parseNum(value) {
  if (value === "" || value == null) return null;
  const n = parseFloat(String(value).replace(/\s/g, ""));
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

function finalizeTrade(obj) {
  const profit = parseNum(obj.profit_loss) ?? 0;
  if (obj.profit_loss != null && !obj.outcome) {
    obj.outcome = profit >= 0 ? "Win" : "Loss";
  }
  if (obj.profit_loss != null && obj.entry_price && obj.position_size && !obj.profit_loss_percent) {
    const denom = obj.entry_price * obj.position_size;
    if (denom) obj.profit_loss_percent = ((profit / denom) * 100).toFixed(2);
  }
  return obj;
}

export function detectBrokerFormat(headers) {
  const h = headers.map((x) => x.toLowerCase()).join(",");
  if (h.includes("ticket id") && h.includes("open price") && h.includes("pips")) return "fundednext";
  if (h.includes("ticket") && h.includes("swap") && (h.includes("open time") || h.includes("time"))) return "mt4";
  if (h.includes("trade id") || h.includes("instrument") || h.includes("qty")) return "tradingview";
  if (headers.includes("Data") && headers.includes("Symbol") && headers.includes("Kierunek")) return "custom";
  return "mt4";
}

function parseFundedNextRow(r, accountId, brokerId) {
  const type = (r.type || "").toLowerCase();
  if (type && type !== "buy" && type !== "sell") return null;

  const open = splitDateTime(r["open time"]);
  const close = splitDateTime(r["close time"]);
  const lots = parseNum(r.lots);
  const volume = parseNum(r.volume);
  const positionSize = lots ?? (volume != null ? volume / 100 : null);

  const trade = {
    ...baseTrade(accountId, brokerId),
    external_ticket: r["ticket id"] || r.ticket || "",
    date: open.date,
    time: open.time,
    entry_time: open.time,
    close_date: close.date || open.date,
    exit_time: close.time,
    symbol: (r.symbol || "").toUpperCase(),
    direction: parseDirection(r.type),
    position_size: positionSize,
    volume_units: volume,
    entry_price: parseNum(r["open price"]),
    exit_price: parseNum(r["close price"]),
    profit_loss: parseNum(r.profit),
    commission: parseNum(r.commission),
    swap: parseNum(r.swap),
    stop_loss: parseNum(r.sl),
    take_profit: parseNum(r.tp),
    pips: parseNum(r.pips),
  };

  return finalizeTrade(trade);
}

function parseMT4Row(r, accountId, brokerId) {
  const type = (r.type || r.side || r.cmd || "").toLowerCase();
  if (type && !type.includes("buy") && !type.includes("sell")) return null;

  const open = splitDateTime(r["open time"] || r.time);
  const close = splitDateTime(r["close time"]);

  const trade = {
    ...baseTrade(accountId, brokerId),
    external_ticket: r["ticket id"] || r.ticket || r.id || "",
    date: open.date,
    time: open.time,
    entry_time: open.time,
    close_date: close.date || "",
    exit_time: close.time,
    symbol: (r.symbol || "").toUpperCase(),
    direction: parseDirection(r.type || r.side || r.cmd),
    position_size: parseNum(r.lots) ?? parseNum(r.volume) ?? parseNum(r.size),
    entry_price: parseNum(r["open price"]) ?? parseNum(r.price),
    exit_price: parseNum(r["close price"]) ?? parseNum(r.close),
    stop_loss: parseNum(r.sl) ?? parseNum(r["s/l"]) ?? parseNum(r["stop loss"]),
    take_profit: parseNum(r.tp) ?? parseNum(r["t/p"]) ?? parseNum(r["take profit"]),
    profit_loss: parseNum(r.profit),
    commission: parseNum(r.commission),
    swap: parseNum(r.swap),
  };

  return finalizeTrade(trade);
}

function parseTradingViewRow(r, accountId, brokerId) {
  const open = splitDateTime(r["date/time opened"] || r.opened || r.date || "");
  const close = splitDateTime(r["date/time closed"] || r.closed || "");

  const trade = {
    ...baseTrade(accountId, brokerId),
    date: open.date,
    time: open.time,
    entry_time: open.time,
    close_date: close.date,
    exit_time: close.time,
    symbol: (r.symbol || r.instrument || r.ticker || "").toUpperCase(),
    direction: parseDirection(r.side || r.type || "buy"),
    position_size: parseNum(r.qty) ?? parseNum(r.contracts) ?? parseNum(r.quantity),
    entry_price: parseNum(r["entry price"]) ?? parseNum(r.entry),
    exit_price: parseNum(r["exit price"]) ?? parseNum(r.exit),
    profit_loss: parseNum(r.profit) ?? parseNum(r["p&l"]),
    commission: parseNum(r.commission),
    notes: "Imported from TradingView",
  };

  return finalizeTrade(trade);
}

function parseCustomRow(headers, line, accountId, brokerId) {
  const cells = parseCSVLine(line).map((c) => c.replace(/"/g, "").trim());
  const obj = { ...baseTrade(accountId, brokerId) };

  headers.forEach((header, index) => {
    const value = cells[index];
    if (!value) return;
    switch (header) {
      case "Data":
        obj.date = value;
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
        break;
      case "P&L":
        obj.profit_loss = parseNum(value);
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

  if (obj.date && !obj.time) {
    const split = splitDateTime(obj.date);
    if (split.time) {
      obj.time = split.time;
      obj.entry_time = split.time;
      obj.date = split.date;
    }
  }

  return finalizeTrade(obj);
}

export function parseTradesFromCSV(content, { accountId, brokerId = "auto" }) {
  const { headers, rows } = parseCSVContent(content);
  const format = brokerId === "auto" ? detectBrokerFormat(headers) : brokerId;

  const trades = rows
    .map((line) => {
      const r = rowToMap(headers, line);
      switch (format) {
        case "fundednext":
          return parseFundedNextRow(r, accountId, format);
        case "tradingview":
          return parseTradingViewRow(r, accountId, format);
        case "custom":
          return parseCustomRow(headers, line, accountId, format);
        case "mt4":
        default:
          return parseMT4Row(r, accountId, format);
      }
    })
    .filter((t) => t && t.symbol && t.date);

  return { trades, format };
}

export function tradeDedupKey(trade) {
  const { date, time } = splitDateTime(
    trade.date ? `${trade.date} ${trade.entry_time || trade.time || "00:00:00"}` : ""
  );
  const vol = trade.position_size ?? trade.quantity ?? trade.volume_units;
  const volKey = vol != null ? Number(parseFloat(vol).toFixed(4)) : "";
  return `${date}|${time}|${volKey}`;
}

export function filterNewTrades(parsedTrades, existingTrades, accountId) {
  const keys = new Set();
  const tickets = new Set();

  for (const t of existingTrades) {
    if (String(t.account_id) !== String(accountId)) continue;
    keys.add(tradeDedupKey(t));
    if (t.external_ticket) tickets.add(String(t.external_ticket));
  }

  const newTrades = [];
  let skipped = 0;

  for (const trade of parsedTrades) {
    const key = tradeDedupKey(trade);
    const ticket = trade.external_ticket ? String(trade.external_ticket) : "";
    if (keys.has(key) || (ticket && tickets.has(ticket))) {
      skipped++;
      continue;
    }
    newTrades.push(trade);
    keys.add(key);
    if (ticket) tickets.add(ticket);
  }

  return { newTrades, skipped };
}
