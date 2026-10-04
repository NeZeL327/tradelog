// 1. Read an MT4/MT5 history file.
// 2. Keep only trades that are not already on this account.
// 3. Save them and stamp the last sync time.
import { createTradesBatch, updateTradingAccount } from "@/lib/localStorage";
import { filterNewTrades, parseTradesFromUpload } from "@/lib/csv-trade-import";

const HISTORY_EXTENSIONS = [".csv", ".xml", ".xlsx", ".xlsm"];

export function isMtHistoryFile(file) {
  const name = String(file?.name || "").toLowerCase();
  return HISTORY_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export async function importMtHistoryFile({ userId, account, file, existingTrades = [] }) {
  if (!userId) throw new Error("Musisz być zalogowany.");
  if (!account?.id) throw new Error("Wybierz konto do synchronizacji.");
  if (!isMtHistoryFile(file)) {
    throw new Error("Wybierz raport historii CSV, XML lub XLSX z MT4/MT5.");
  }

  const { trades } = await parseTradesFromUpload(file, {
    accountId: account.id,
    brokerId: "mt4",
  });
  const { newTrades, skipped } = filterNewTrades(trades, existingTrades, account.id);

  if (!trades.length) {
    return { imported: 0, skipped, empty: true };
  }
  if (!newTrades.length) {
    return { imported: 0, skipped, empty: false };
  }

  await createTradesBatch(userId, newTrades);
  const syncedAt = new Date().toISOString();
  const previous = account.mt_link || {};
  await updateTradingAccount(userId, account.id, {
    mt_link: {
      platform: previous.platform || "MT5",
      login: previous.login || account.account_number || "",
      server: previous.server || account.broker || "",
      connected_at: previous.connected_at || syncedAt,
      last_sync_at: syncedAt,
      last_sync_count: newTrades.length,
    },
  });

  return { imported: newTrades.length, skipped, empty: false };
}
