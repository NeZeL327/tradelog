import { useState, useCallback } from "react";
import { collection, getDocs, addDoc, serverTimestamp, orderBy, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createTrade } from "@/lib/localStorage";
import { toast } from "sonner";

// ─── Firestore serializer ─────────────────────────────────────────────────────
const serializeDoc = (doc) => {
  const data = {};
  for (const [key, val] of Object.entries(doc)) {
    if (val && typeof val.toDate === "function") data[key] = val.toDate().toISOString();
    else data[key] = val;
  }
  return data;
};

// ─── CSV helpers ──────────────────────────────────────────────────────────────
const escapeCSV = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const toCSVRow = (row) => row.map(escapeCSV).join(",");

const parseCSVLine = (line) => {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
    else if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(cur); cur = ""; }
    else cur += ch;
  }
  result.push(cur);
  return result;
};

const parseCSV = (text) => {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((l) => {
    const cols = parseCSVLine(l);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cols[i] ?? "").trim(); });
    return obj;
  });
  return { headers, rows };
};

// ─── Export: All Data (JSON backup) ──────────────────────────────────────────
const USER_COLLECTIONS = ["trades", "accounts", "strategies", "goals", "notes", "notebooks", "sections"];

export function useDataExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null); // { rows, format, file }
  const [importHistory, setImportHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // ── JSON backup ────────────────────────────────────────────────────────────
  const exportAllData = useCallback(async (userId) => {
    if (!userId) { toast.error("Brak zalogowanego użytkownika"); return; }
    setIsExporting(true);
    try {
      const backup = { exportedAt: new Date().toISOString(), userId: String(userId), version: "1.0", collections: {} };
      await Promise.all(
        USER_COLLECTIONS.map(async (name) => {
          try {
            const snap = await getDocs(collection(db, "users", String(userId), name));
            backup.collections[name] = snap.docs.map((d) => ({ id: d.id, ...serializeDoc(d.data()) }));
          } catch { backup.collections[name] = []; }
        })
      );
      triggerDownload(JSON.stringify(backup, null, 2), `aikeeptrade-backup-${today()}.json`, "application/json");
      const total = Object.values(backup.collections).reduce((s, a) => s + a.length, 0);
      toast.success(`Pobrano kopię zapasową (${total} rekordów)`);
    } catch (err) {
      console.error("Export JSON error:", err);
      toast.error("Nie udało się pobrać kopii zapasowej");
    } finally { setIsExporting(false); }
  }, []);

  // ── CSV export (trades only) ───────────────────────────────────────────────
  const exportTradesCSV = useCallback(async (userId) => {
    if (!userId) { toast.error("Brak zalogowanego użytkownika"); return; }
    setIsExportingCSV(true);
    try {
      const snap = await getDocs(
        query(collection(db, "users", String(userId), "trades"), orderBy("date", "desc"))
      );
      const trades = snap.docs
        .map((d) => ({ id: d.id, ...serializeDoc(d.data()) }))
        .filter((t) => !t.deleted_at);

      const HEADERS = [
        "date", "time", "symbol", "direction", "quantity",
        "entry_price", "exit_price", "profit_loss", "commission",
        "strategy", "tags", "notes", "status", "account_id"
      ];
      const rows = [
        toCSVRow(HEADERS),
        ...trades.map((t) => toCSVRow([
          t.date ?? "",
          t.time ?? "",
          t.symbol ?? "",
          t.direction ?? t.type ?? "",
          t.quantity ?? t.size ?? "",
          t.entry_price ?? t.open ?? "",
          t.exit_price ?? t.close ?? "",
          t.profit_loss ?? t.profit ?? "",
          t.commission ?? "",
          t.strategy ?? "",
          Array.isArray(t.tags) ? t.tags.join("|") : (t.tags ?? ""),
          t.notes ?? "",
          t.status ?? "",
          t.account_id ?? "",
        ]))
      ];
      triggerDownload(rows.join("\n"), `trades-${today()}.csv`, "text/csv");
      toast.success(`Eksportowano ${trades.length} transakcji`);
    } catch (err) {
      console.error("Export CSV error:", err);
      toast.error("Nie udało się eksportować CSV");
    } finally { setIsExportingCSV(false); }
  }, []);

  // ── Import: detect format + parse ─────────────────────────────────────────
  const parseFileForPreview = useCallback(async (file) => {
    const text = await readFile(file);
    const format = detectFormat(text);
    const parsed = parseFormat(text, format);
    setImportPreview({ rows: parsed, format, file, text });
    return { rows: parsed, format };
  }, []);

  const clearPreview = useCallback(() => setImportPreview(null), []);

  // ── Import: commit to Firestore ────────────────────────────────────────────
  const commitImport = useCallback(async (userId, preview) => {
    if (!userId || !preview) return;
    setIsImporting(true);
    let success = 0;
    let errors = 0;
    const errorList = [];

    try {
      for (const row of preview.rows) {
        try {
          if (!row.symbol && !row.date) { errors++; continue; }
          await createTrade(userId, {
            date: row.date || new Date().toISOString().slice(0, 10),
            time: row.time || "",
            symbol: (row.symbol || "").toUpperCase(),
            direction: normalizeDirection(row.direction || row.type),
            quantity: parseFloat(row.quantity || row.size || "0") || 0,
            entry_price: parseFloat(row.entry_price || row.open || "0") || 0,
            exit_price: parseFloat(row.exit_price || row.close || "0") || null,
            profit_loss: parseFloat(row.profit_loss || row.profit || "0") || null,
            commission: parseFloat(row.commission || "0") || 0,
            strategy: row.strategy || "",
            tags: parseTags(row.tags),
            notes: row.notes || "",
            status: row.status || (row.exit_price ? "closed" : "open"),
            account_id: row.account_id || null,
            imported: true,
            import_format: preview.format,
          });
          success++;
        } catch (e) {
          errors++;
          errorList.push(e.message);
        }
      }

      // Save import history record
      try {
        await addDoc(collection(db, "users", String(userId), "import_history"), {
          importedAt: serverTimestamp(),
          format: preview.format,
          fileName: preview.file?.name || "unknown",
          totalRows: preview.rows.length,
          successRows: success,
          errorRows: errors,
        });
      } catch { /* non-critical */ }

      if (success > 0) toast.success(`Zaimportowano ${success} transakcji${errors > 0 ? `, ${errors} błędów` : ""}`);
      else toast.error(`Import nieudany (${errors} błędów)`);

      setImportPreview(null);
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Nie udało się zaimportować danych");
    } finally { setIsImporting(false); }

    return { success, errors };
  }, []);

  // ── Import history ─────────────────────────────────────────────────────────
  const loadImportHistory = useCallback(async (userId) => {
    if (!userId) return;
    setIsLoadingHistory(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "users", String(userId), "import_history"),
          orderBy("importedAt", "desc"),
          limit(10)
        )
      );
      setImportHistory(snap.docs.map((d) => ({ id: d.id, ...serializeDoc(d.data()) })));
    } catch { setImportHistory([]); }
    finally { setIsLoadingHistory(false); }
  }, []);

  return {
    // JSON backup
    exportAllData, isExporting,
    // CSV export
    exportTradesCSV, isExportingCSV,
    // Import
    parseFileForPreview, clearPreview, commitImport,
    importPreview, isImporting,
    // History
    loadImportHistory, importHistory, isLoadingHistory,
    // Format info (for UI labels)
    FORMAT_LABELS,
  };
}

// ─── Format detection ─────────────────────────────────────────────────────────
const FORMAT_LABELS = {
  generic:     "Własny format (CSV)",
  mt4:         "MetaTrader 4 / MT5",
  tradingview: "TradingView",
};

function detectFormat(text) {
  const firstLine = text.split(/\r?\n/)[0].toLowerCase();
  if (firstLine.includes("ticket") && firstLine.includes("swap")) return "mt4";
  if (firstLine.includes("order #") || firstLine.includes("contracts") && firstLine.includes("entry price")) return "tradingview";
  return "generic";
}

// ─── Format parsers ───────────────────────────────────────────────────────────
function parseFormat(text, format) {
  switch (format) {
    case "mt4": return parseMT4(text);
    case "tradingview": return parseTradingView(text);
    default: return parseGeneric(text);
  }
}

function parseGeneric(text) {
  const { rows } = parseCSV(text);
  return rows.map((r) => ({
    date: r.date || "",
    time: r.time || "",
    symbol: r.symbol || "",
    direction: normalizeDirection(r.direction || r.type || ""),
    quantity: r.quantity || r.size || "",
    entry_price: r.entry_price || r.open || "",
    exit_price: r.exit_price || r.close || "",
    profit_loss: r.profit_loss || r.profit || "",
    commission: r.commission || "",
    strategy: r.strategy || "",
    tags: r.tags || "",
    notes: r.notes || "",
    status: r.status || (r.exit_price ? "closed" : "open"),
    account_id: r.account_id || "",
  })).filter((r) => r.symbol || r.date);
}

// MT4 Account History format:
// Ticket,Open Time,Type,Size,Symbol,Price,S/L,T/P,Close Time,Close Price,Commission,Taxes,Swap,Profit
function parseMT4(text) {
  const { rows } = parseCSV(text);
  return rows
    .filter((r) => {
      const type = (r.type || "").toLowerCase();
      return type === "buy" || type === "sell";
    })
    .map((r) => {
      const openTime = r["open time"] || r.time || "";
      const closeTime = r["close time"] || "";
      const [date, time] = splitDateTime(openTime);
      return {
        date,
        time,
        symbol: r.symbol || "",
        direction: normalizeDirection(r.type),
        quantity: r.size || r.volume || "",
        entry_price: r.price || r["open price"] || "",
        exit_price: r["close price"] || r["close"] || "",
        profit_loss: r.profit || "",
        commission: r.commission || "",
        strategy: "",
        tags: "",
        notes: `Imported from MT4 | Swap: ${r.swap || 0}`,
        status: closeTime ? "closed" : "open",
        account_id: "",
      };
    }).filter((r) => r.symbol);
}

// TradingView Paper Trading format:
// Order #,Date/Time Opened,Date/Time Closed,Contracts,Entry price,Exit Price,Commission,Profit,Profit %,Symbol
function parseTradingView(text) {
  const { rows } = parseCSV(text);
  return rows.map((r) => {
    const openDT = r["date/time opened"] || r["opened"] || "";
    const [date, time] = splitDateTime(openDT);
    const profit = parseFloat(r.profit || "0") || 0;
    return {
      date,
      time,
      symbol: (r.symbol || r.ticker || "").toUpperCase(),
      direction: profit >= 0 ? "buy" : "sell",
      quantity: r.contracts || r.qty || "",
      entry_price: r["entry price"] || r.entry || "",
      exit_price: r["exit price"] || r.exit || "",
      profit_loss: r.profit || "",
      commission: r.commission || "",
      strategy: "",
      tags: "",
      notes: `Imported from TradingView`,
      status: r["date/time closed"] ? "closed" : "open",
      account_id: "",
    };
  }).filter((r) => r.date || r.entry_price);
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function normalizeDirection(val) {
  const v = (val || "").toLowerCase().trim();
  if (v === "buy" || v === "long" || v === "b") return "buy";
  if (v === "sell" || v === "short" || v === "s") return "sell";
  return v || "buy";
}

function parseTags(val) {
  if (!val) return [];
  return String(val).split(/[|,;]/).map((t) => t.trim()).filter(Boolean);
}

function splitDateTime(dt) {
  if (!dt) return ["", ""];
  // "2024.01.15 09:30:00" or "2024-01-15 09:30:00" or "2024-01-15T09:30:00"
  const normalized = dt.replace(/\./g, "-").replace("T", " ");
  const parts = normalized.split(" ");
  return [parts[0] || "", parts[1] || ""];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

function triggerDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
