import { getTradeRealizedPL } from "@/lib/utils";

export function accountBaseBalance(account) {
  const initial = Number(account?.initial_balance);
  if (Number.isFinite(initial) && initial > 0) return initial;
  const current = Number(account?.current_balance);
  if (Number.isFinite(current) && current > 0) return current;
  return 0;
}

export function balanceForAccount(accounts, accountId) {
  const list = Array.isArray(accounts) ? accounts : [];
  if (accountId) {
    const found = list.find((account) => String(account.id) === String(accountId));
    const one = accountBaseBalance(found);
    if (one > 0) return one;
  }
  return list.reduce((sum, account) => sum + accountBaseBalance(account), 0);
}

export function balanceForTrades(trades, accounts) {
  const ids = new Set((trades || []).map((trade) => String(trade?.account_id || "")).filter(Boolean));
  const list = (accounts || []).filter((account) => ids.size === 0 || ids.has(String(account.id)));
  return list.reduce((sum, account) => sum + accountBaseBalance(account), 0);
}

export function sumTradePl(trades) {
  return (trades || []).reduce((sum, trade) => sum + (getTradeRealizedPL(trade) ?? 0), 0);
}

export function formatPnlAmount(value, { mode = "money", currency = "", balance = 0 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (mode === "percent") {
    if (!Number.isFinite(balance) || balance <= 0) return "—";
    const pct = (n / balance) * 100;
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(2)}%`;
  }
  const sign = n > 0 ? "+" : "";
  const unit = currency ? ` ${currency}` : "";
  return `${sign}${n.toFixed(2)}${unit}`;
}
