import { Badge } from "@/components/ui/badge";
import { directionBadgeClass, directionLabel, getTradeRealizedPL, tradeOutcomeBadgeClass, tradeOutcomeDisplay, tradeStatusBadgeClass, tradeStatusDisplay } from "@/lib/utils";
import { formatTradeClock, formatTradeClockDate, getDateFormat } from "@/lib/userSettings";

export default function JournalMobileList({
  trades,
  t,
  accountNameById,
  strategyNameById,
  onView,
}) {
  const dateFormat = getDateFormat();

  if (!trades.length) {
    return (
      <p className="text-center text-sm text-muted-foreground py-10">{t("noTradesToDisplay") || "Brak transakcji"}</p>
    );
  }

  return (
    <ul className="divide-y divide-border/70 rounded-xl border border-border/70 overflow-hidden bg-card">
      {trades.map((trade) => {
        const pl = getTradeRealizedPL(trade);
        const plNum = Number(pl);
        const hasPl = Number.isFinite(plNum);
        const plUp = hasPl && plNum >= 0;
        return (
          <li key={trade.id}>
            <button
              type="button"
              onClick={() => onView(trade)}
              className="w-full text-left px-3 py-3 min-h-[3.25rem] active:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[15px] text-foreground truncate">{trade.symbol}</span>
                    <Badge className={`${directionBadgeClass(trade.direction)} text-[10px] px-1.5 py-0`}>
                      {directionLabel(trade.direction, t)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                    {formatTradeClockDate(trade, "entry", dateFormat) || trade.date || "—"}
                    {formatTradeClock(trade, "entry") ? ` · ${formatTradeClock(trade, "entry")}` : ""}
                    {accountNameById[String(trade.account_id)] ? ` · ${accountNameById[String(trade.account_id)]}` : ""}
                  </p>
                  {strategyNameById[String(trade.strategy_id)] && (
                    <p className="text-[11px] text-muted-foreground/80 truncate">{strategyNameById[String(trade.strategy_id)]}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold tabular-nums ${hasPl ? (plUp ? "text-emerald-500" : "text-rose-500") : "text-muted-foreground"}`}>
                    {hasPl ? `${plUp ? "+" : ""}${plNum.toFixed(2)}` : "—"}
                  </p>
                  <div className="mt-1 flex justify-end gap-1">
                    <Badge className={`${tradeStatusBadgeClass(trade.status)} text-[10px] px-1.5 py-0`}>
                      {tradeStatusDisplay(trade.status)}
                    </Badge>
                    {trade.outcome && (
                      <Badge variant="outline" className={`${tradeOutcomeBadgeClass(trade.outcome)} text-[10px] px-1.5 py-0`}>
                        {tradeOutcomeDisplay(trade.outcome)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
