/**
 * Dedup used by CSV import and MT5 sync.
 * No XLSX / browser imports — Cloud Functions can load this file.
 */

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

function splitDateTime(dt) {
  if (!dt) return { date: "", time: "" };

  const normalized = String(dt).trim().replace(/\u00A0/g, " ").replace("T", " ");
  const [dateRaw, ...timeParts] = normalized.split(/\s+/);
  const timeRaw = timeParts.join(" ").trim();

  const date = normalizeDatePart(dateRaw);
  const time = timeRaw.replace(/,/g, ":").slice(0, 8);

  return { date, time };
}

function parseNum(value) {
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

export function normalizeTicket(value) {
  if (value === "" || value == null) return "";
  return String(value).trim().replace(/^#/, "");
}

function normalizeSymbolKey(symbol) {
  return String(symbol || "")
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/(MICRO|RAW|PRO|ECN|SK|M)$/g, (suf, _i, s) => {
      if (s.length <= suf.length + 2) return suf;
      return "";
    });
}

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

  if (ticket) {
    keys.push(`ticket:${accountId}:${ticket}`);
  }

  if (date && time && volKey !== "") {
    keys.push(`dtvol:${accountId}:${date}|${time}|${volKey}`);
  }

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

export function tradeDedupKey(trade) {
  const fps = tradeImportFingerprints(trade);
  return fps[fps.length - 1] || "";
}

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
