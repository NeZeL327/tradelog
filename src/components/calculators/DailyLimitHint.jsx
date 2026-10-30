import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { getTrades, getTradingAccounts } from "@/lib/localStorage";
import { HEADER_ACCOUNT_STORAGE_KEY } from "@/lib/dayPlanStorage";
import { computePropStatus, dailyLimitFit } from "@/lib/propRules";

/**
 * Podpowiedź pod kalkulatorem pozycji: ryzyko jako % konta wybranego w górnym pasku i czy zmieści się
 * w pozostałym dziennym limicie (z panelu limitów konta). Tylko odczyt; formuły kalkulatora bez zmian.
 */
export default function DailyLimitHint({ riskAmount }) {
  const { user } = useAuth();
  const [accountId, setAccountId] = useState("");
  useEffect(() => {
    if (!user?.id) return undefined;
    const sync = () => setAccountId(localStorage.getItem(HEADER_ACCOUNT_STORAGE_KEY(user.id)) || "");
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [user?.id]);
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts", user?.id], queryFn: () => getTradingAccounts(user.id), enabled: !!user?.id });
  const { data: trades = [] } = useQuery({ queryKey: ["trades", user?.id], queryFn: () => getTrades(user.id), enabled: !!user?.id });

  const account = accounts.find((acc) => String(acc.id) === String(accountId));
  if (!account) return <p className="text-[12px] text-ds-text3">Wybierz konto w górnym pasku, żeby sprawdzić ryzyko względem limitu dziennego.</p>;
  const fit = dailyLimitFit(computePropStatus(account, trades), riskAmount);
  if (!fit) return <p className="text-[12px] text-ds-text3">Konto „{account.name}” nie ma limitu dziennego albo ryzyko wynosi 0.</p>;
  const cur = account.currency ? ` ${account.currency}` : "";
  return (
    <p className={`rounded-[10px] border px-3 py-2 text-[12.5px] ${fit.fits ? "border-ds-line text-ds-text2" : "border-[color:color-mix(in_srgb,var(--ds-warn)_40%,transparent)] text-ds-warn"}`} role="status">
      Ryzyko {fit.riskPctOfAccount ?? "—"}% konta „{account.name}” —{" "}
      {fit.fits ? "zmieści się" : "nie zmieści się"} w limicie dziennym (pozostało {fit.left.toFixed(2)}{cur}).
      <span className="text-ds-text3"> Szacunek z zapisanych transakcji.</span>
    </p>
  );
}
