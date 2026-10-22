import { serverToLocal } from "./brokerTime.js";

export const MT5_TIME_FIX_MARKER = "time_fix_v1";
export const MT5_TIME_FIX_CREATED_AT_FIELD = "createdAt";
/** Etap 2 landed locally ~14:20 Europe/Prague; rows created at/after this are treated as already converted. */
export const MT5_TIME_FIX_CUTOFF_ISO = "2026-10-22T12:20:00.000Z";
export const MT5_TIME_FIX_CUTOFF_MS = Date.parse(MT5_TIME_FIX_CUTOFF_ISO);
export const MT5_TIME_FIX_BACKUP_VERSION = "time_fix_v1";
export const MT5_TIME_CLOCK_FIELDS = Object.freeze([
  "date",
  "time",
  "entry_time",
  "close_date",
  "exit_time",
]);

export function createdAtMillis(trade) {
  const value = trade?.[MT5_TIME_FIX_CREATED_AT_FIELD];
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value.toMillis === "function") {
    const ms = value.toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value.toDate === "function") {
    const ms = value.toDate().getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value.seconds === "number") {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function clockFields(trade) {
  return {
    date: trade?.date || "",
    time: trade?.time || trade?.entry_time || "",
    entry_time: trade?.entry_time || trade?.time || "",
    close_date: trade?.close_date || "",
    exit_time: trade?.exit_time || "",
  };
}

function clocksEqual(a, b) {
  return MT5_TIME_CLOCK_FIELDS.every((key) => String(a?.[key] || "") === String(b?.[key] || ""));
}

function civilMs(dateStr, timeStr) {
  const d = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const t = String(timeStr || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!d || !t) return null;
  return Date.UTC(
    Number(d[1]),
    Number(d[2]) - 1,
    Number(d[3]),
    Number(t[1]),
    Number(t[2]),
    Number(t[3] || 0)
  );
}

function openShiftHours(before, after) {
  const from = civilMs(before.date, before.entry_time || before.time);
  const to = civilMs(after.date, after.entry_time || after.time);
  if (from == null || to == null) return null;
  return (from - to) / 3_600_000;
}

export function convertImportedMt4Times(trade) {
  const before = clockFields(trade);
  const openTime = before.entry_time || before.time;
  if (!before.date || !openTime) return null;
  const open = serverToLocal(before.date, openTime);
  if (!open.date) return null;

  let close = { date: before.close_date || open.date, time: before.exit_time };
  if (before.exit_time) {
    const localClose = serverToLocal(before.close_date || before.date, before.exit_time);
    if (localClose.date) close = localClose;
  }

  return {
    date: open.date,
    time: open.time,
    entry_time: open.time,
    close_date: close.date || open.date,
    exit_time: close.time || before.exit_time,
  };
}

export function classifyMt4TimeFixTrade(trade, cutoffMs = MT5_TIME_FIX_CUTOFF_MS) {
  if (trade?.deleted_at) return { reason: "deleted" };
  if (trade?.[MT5_TIME_FIX_MARKER] === true) return { reason: "already_fixed" };
  if (trade?.imported !== true) return { reason: "not_imported" };

  const broker = String(trade.import_broker || "");
  if (broker === "mt5") return { reason: "metaapi" };
  if (broker !== "mt4") return { reason: broker ? "other_broker" : "not_mt4" };

  const created = createdAtMillis(trade);
  if (created == null) return { reason: "created_at_unknown" };
  if (created >= cutoffMs) return { reason: "created_after_cutoff" };

  const after = convertImportedMt4Times(trade);
  if (!after) return { reason: "no_time" };
  const before = clockFields(trade);
  if (clocksEqual(before, after)) return { reason: "unchanged" };

  return {
    reason: "fix",
    before,
    after,
    shiftHours: openShiftHours(before, after),
    dayChanged: before.date !== after.date,
    closeDayChanged: (before.close_date || before.date) !== (after.close_date || after.date),
  };
}

function isShift(value, hours) {
  return value != null && Math.abs(value - hours) < 0.05;
}

export function planMt4ImportTimeFix(trades, opts = {}) {
  const cutoffMs = Number.isFinite(opts.cutoffMs) ? opts.cutoffMs : MT5_TIME_FIX_CUTOFF_MS;
  const toFix = [];
  const skipped = [];
  const byReason = {};

  for (const trade of trades || []) {
    const classified = classifyMt4TimeFixTrade(trade, cutoffMs);
    if (classified.reason !== "fix") {
      skipped.push({
        id: trade?.id,
        account_id: trade?.account_id || "",
        symbol: trade?.symbol || "",
        reason: classified.reason,
      });
      byReason[classified.reason] = (byReason[classified.reason] || 0) + 1;
      continue;
    }
    toFix.push({
      id: trade.id,
      account_id: trade.account_id || "",
      symbol: trade.symbol || "",
      before: classified.before,
      after: classified.after,
      shiftHours: classified.shiftHours,
      dayChanged: classified.dayChanged,
      closeDayChanged: classified.closeDayChanged,
    });
  }

  return {
    toFix,
    skipped,
    summary: {
      toFix: toFix.length,
      skipped: skipped.length,
      dayChanged: toFix.filter((row) => row.dayChanged || row.closeDayChanged).length,
      shift1h: toFix.filter((row) => isShift(row.shiftHours, 1)).length,
      shift2h: toFix.filter((row) => isShift(row.shiftHours, 2)).length,
      shiftOther: toFix.filter((row) => !isShift(row.shiftHours, 1) && !isShift(row.shiftHours, 2)).length,
      byReason,
    },
  };
}

export function buildTimeFixBackup({ userId, rows, cutoffIso }) {
  return {
    version: MT5_TIME_FIX_BACKUP_VERSION,
    created_at: new Date().toISOString(),
    cutoff_iso: cutoffIso || MT5_TIME_FIX_CUTOFF_ISO,
    created_at_field: MT5_TIME_FIX_CREATED_AT_FIELD,
    user_id: userId || "",
    trades: (rows || []).map((row) => ({
      id: row.id,
      account_id: row.account_id,
      symbol: row.symbol,
      before: row.before,
      after: row.after,
    })),
  };
}

export function parseTimeFixBackup(payload) {
  const data = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (!data || data.version !== MT5_TIME_FIX_BACKUP_VERSION || !Array.isArray(data.trades)) {
    throw new Error("Nieprawidłowy plik kopii zapasowej (time_fix_v1).");
  }
  return data;
}

export function patchesFromFixRows(rows) {
  return (rows || []).map((row) => ({
    id: row.id,
    fields: { ...row.after, [MT5_TIME_FIX_MARKER]: true },
  }));
}

export function patchesFromBackupRestore(backup) {
  return (backup?.trades || []).map((row) => ({
    id: row.id,
    fields: clockFields(row.before),
    deleteKeys: [MT5_TIME_FIX_MARKER],
  }));
}

export function sumTradePnl(trades) {
  return (trades || []).reduce((sum, trade) => {
    const n = Number(trade?.profit_loss);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function verifyTimeFix({ beforeTrades, afterTrades, backupRows }) {
  const sample = (backupRows || []).map((row) => {
    const live = (afterTrades || []).find((trade) => String(trade.id) === String(row.id));
    const actual = live ? clockFields(live) : null;
    return {
      id: row.id,
      symbol: row.symbol,
      expected: row.after,
      actual,
      match: actual ? clocksEqual(actual, row.after) : false,
    };
  });
  const pnlBefore = round2(sumTradePnl(beforeTrades));
  const pnlAfter = round2(sumTradePnl(afterTrades));
  return {
    countBefore: (beforeTrades || []).length,
    countAfter: (afterTrades || []).length,
    countUnchanged: (beforeTrades || []).length === (afterTrades || []).length,
    pnlBefore,
    pnlAfter,
    pnlUnchanged: pnlBefore === pnlAfter,
    sample,
    sampleAllMatch: sample.length > 0 && sample.every((row) => row.match),
  };
}
