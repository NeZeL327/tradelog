import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useUserSettings } from "@/hooks/use-user-settings";
import { getTradingAccounts, updateUser } from "@/lib/localStorage";
import { HEADER_ACCOUNT_STORAGE_KEY } from "@/lib/dayPlanStorage";
import {
  applyRuntimeSettings,
  loadLocalUserSettings,
  saveLocalUserSettings,
} from "@/lib/userSettings";
import {
  balanceForAccount,
  balanceForTrades,
  formatPnlAmount,
  sumTradePl,
} from "@/lib/pnlDisplay";
import { getTradeRealizedPL } from "@/lib/utils";

export function usePnlDisplay() {
  const { user, patchUser } = useAuth();
  const settings = useUserSettings();
  const [accountId, setAccountId] = useState("");

  useEffect(() => {
    if (!user?.id) return undefined;
    const sync = () => {
      setAccountId(localStorage.getItem(HEADER_ACCOUNT_STORAGE_KEY(user.id)) || "");
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [user?.id]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: () => getTradingAccounts(user.id),
    enabled: !!user?.id,
  });

  const mode = settings.pnl_view === "percent" ? "percent" : "money";
  const selected = accounts.find((account) => String(account.id) === String(accountId));
  const currencies = [...new Set(accounts.map((account) => account.currency).filter(Boolean))];
  const currency = selected?.currency || (currencies.length === 1 ? currencies[0] : "");
  const currencyLabel = (selected?.currency || currencies[0] || settings.default_currency || "USD").toUpperCase();

  const formatAmount = (value, balance) =>
    formatPnlAmount(value, { mode, currency, balance });

  const formatTrade = (trade) => {
    const pl = getTradeRealizedPL(trade);
    if (pl == null) return "—";
    return formatAmount(pl, balanceForAccount(accounts, trade?.account_id));
  };

  const formatTrades = (trades) =>
    formatAmount(sumTradePl(trades), balanceForTrades(trades, accounts));

  const formatAverage = (trades) => {
    const list = trades || [];
    const avg = list.length ? sumTradePl(list) / list.length : 0;
    return formatAmount(avg, balanceForTrades(list, accounts));
  };

  const setMode = (nextMode) => {
    const next = nextMode === "percent" ? "percent" : "money";
    if (next === mode) return;
    saveLocalUserSettings({ ...loadLocalUserSettings(), pnl_view: next });
    applyRuntimeSettings({ ...settings, pnl_view: next });
    patchUser?.({ pnl_view: next });
    if (user?.id) {
      updateUser(user.id, { pnl_view: next }).catch((err) => {
        console.error("pnl view save error:", err);
      });
    }
  };

  return { mode, currency, currencyLabel, formatAmount, formatTrade, formatTrades, formatAverage, setMode, accounts };
}
