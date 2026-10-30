// Podsumowanie po sesji dla strony "Dzień": wynik dnia z zapisanych transakcji + zgodność z planem.
// Tylko odczyt — nic nie zapisuje; plan i transakcje bez zmian.
import { tradeDayKey } from "@/lib/calendarAggregates";
import { accountBaseBalance } from "@/lib/pnlDisplay";
import { getTradeMoneyRisk, getTradeRealizedPL, isClosedTrade } from "@/lib/utils";

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * plan: dokument planu dnia (account_id, date, parameters, checklist); trades: wszystkie transakcje;
 * account: konto planu (do % ryzyka). Zwraca liczby albo null, gdy nie da się policzyć.
 */
export function daySessionSummary(plan, trades, account) {
  const accountId = String(plan?.account_id || "");
  const dayKey = String(plan?.date || "").slice(0, 10);
  const dayTrades = (trades || []).filter(
    (trade) => String(trade?.account_id) === accountId && tradeDayKey(trade?.date) === dayKey
  );
  const closed = dayTrades.filter(isClosedTrade);
  let net = 0;
  let wins = 0;
  let losses = 0;
  for (const trade of closed) {
    net += getTradeRealizedPL(trade) ?? 0;
    if (trade?.outcome === "Win") wins += 1;
    else if (trade?.outcome === "Loss") losses += 1;
  }

  const tradeLimit = Number(plan?.parameters?.trade_limit);
  const limit = Number.isFinite(tradeLimit) && tradeLimit > 0 ? tradeLimit : null;
  const maxRiskPct = Number(plan?.parameters?.max_risk_percent);
  const riskCap = Number.isFinite(maxRiskPct) && maxRiskPct > 0 ? maxRiskPct : null;
  const balance = accountBaseBalance(account);

  // Ryzyko transakcji jako % kapitału konta; tylko transakcje ze znanym ryzykiem kwotowym.
  const risks = dayTrades
    .map((trade) => getTradeMoneyRisk(trade))
    .filter((risk) => risk != null)
    .map((risk) => (balance > 0 ? (risk / balance) * 100 : null))
    .filter((pct) => pct != null);
  const maxTakenRisk = risks.length ? round2(Math.max(...risks)) : null;
  const overRiskCount = riskCap != null ? risks.filter((pct) => pct > riskCap + 1e-9).length : null;

  const checklist = Array.isArray(plan?.checklist) ? plan.checklist : [];
  const checklistDone = checklist.filter((item) => item?.done).length;

  const checks = [
    limit != null ? { id: "tradeLimit", ok: dayTrades.length <= limit, value: dayTrades.length, target: limit } : null,
    riskCap != null && maxTakenRisk != null ? { id: "risk", ok: overRiskCount === 0, value: maxTakenRisk, target: riskCap } : null,
    checklist.length ? { id: "checklist", ok: checklistDone === checklist.length, value: checklistDone, target: checklist.length } : null,
  ].filter(Boolean);

  return {
    trades: dayTrades.length,
    closed: closed.length,
    netPL: closed.length ? round2(net) : null,
    wins,
    losses,
    winRate: wins + losses > 0 ? Number(((wins / (wins + losses)) * 100).toFixed(1)) : null,
    tradeLimit: limit,
    maxTakenRisk,
    riskCap,
    overRiskCount,
    checklistDone,
    checklistTotal: checklist.length,
    checks,
    // Zgodność z planem: odsetek spełnionych punktów; null, gdy plan nie ma żadnego mierzalnego punktu.
    compliance: checks.length ? checks.filter((check) => check.ok).length / checks.length : null,
  };
}
