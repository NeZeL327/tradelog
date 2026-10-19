/** Presentation helpers for the post-import result dialog. No I/O. */

export function importResultStatus({
  imported,
  skipped,
  errors,
  empty = false,
  errorMessage = "",
} = {}) {
  const nImported = asCount(imported);
  const nSkipped = asCount(skipped);
  const nErrors = asCount(errors);
  const hasText = Boolean(String(errorMessage || "").trim());

  if (hasText || empty) return "error";
  if (nImported === 0 && nErrors > 0) return "error";
  if (nImported === 0 && nSkipped === 0 && imported == null && skipped == null) return "error";
  if (nSkipped > 0 || nErrors > 0) return "warning";
  if (nImported > 0) return "success";
  return "error";
}

export function importResultTiles({ imported, skipped, errors, errorMessage } = {}) {
  const tiles = [];
  const throwOnly = Boolean(errorMessage) && imported == null && skipped == null && errors == null;
  if (throwOnly) return tiles;

  if (typeof imported === "number") {
    tiles.push({ id: "imported", value: imported });
  }
  if (typeof skipped === "number" && (skipped > 0 || (typeof imported === "number" && imported > 0))) {
    tiles.push({ id: "skipped", value: skipped });
  }
  if (typeof errors === "number" && errors > 0) {
    tiles.push({ id: "errors", value: errors });
  }
  return tiles;
}

export function summarizeImportedTrades(trades) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return { symbols: [], dateFrom: null, dateTo: null };
  }

  const symbols = [];
  const seen = new Set();
  const dates = [];

  for (const trade of trades) {
    const symbol = String(trade?.symbol || "").trim();
    if (symbol && !seen.has(symbol)) {
      seen.add(symbol);
      symbols.push(symbol);
    }
    const key = String(trade?.date || trade?.close_date || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) dates.push(key);
  }

  dates.sort();
  return {
    symbols,
    dateFrom: dates[0] || null,
    dateTo: dates[dates.length - 1] || null,
  };
}

export function splitImportError(raw) {
  const msg = String(raw || "").trim();
  if (!msg) return { friendlyKey: "importResultGenericError", technical: "" };

  const techIdx = msg.search(/Przykład wierszy:|Example rows:/i);
  const technical = techIdx >= 0 ? msg.slice(techIdx).trim() : "";
  const head = (techIdx >= 0 ? msg.slice(0, techIdx) : msg).trim();

  if (/zalogowany|logged in/i.test(head)) {
    return { friendlyKey: "importResultLogin", technical: technical || head };
  }
  if (/Wybierz konto|Select an account/i.test(head)) {
    return { friendlyKey: "importResultPickAccount", technical: technical || head };
  }
  if (/CSV|XML|XLSX/i.test(head) && /Wybierz raport|Choose|Select a history/i.test(head)) {
    return { friendlyKey: "importResultBadFile", technical: technical || head };
  }
  if (/buy\/sell|nie ma pozycji|Nie znaleziono|no positions/i.test(head)) {
    return {
      friendlyKey: "importResultEmptyHint",
      technical: technical || (head.length > 160 ? head : ""),
    };
  }
  if (head.length > 180) {
    return { friendlyKey: "importResultGenericError", technical: msg };
  }
  return { friendlyKey: null, friendlyText: head, technical };
}

export function polishUnitKind(n) {
  const abs = Math.abs(Number(n) || 0);
  if (abs === 1) return "one";
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
  return "many";
}

function asCount(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
