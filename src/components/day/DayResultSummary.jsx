import { CheckCircle2, CircleAlert } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { usePnlDisplay } from "@/hooks/use-pnl-display";
import KpiStrip from "@/components/common/KpiStrip";
import { accountBaseBalance } from "@/lib/pnlDisplay";
import { daySessionSummary } from "@/lib/daySummary";

/** Wynik dnia z zapisanych transakcji + zgodność z planem (tylko odczyt). */
export default function DayResultSummary({ plan, trades, account }) {
  const { t } = useLanguage();
  const pnl = usePnlDisplay();
  const s = daySessionSummary(plan, trades, account);
  const money = (value) => (value == null ? null : pnl.formatAmount(value, accountBaseBalance(account)));
  const checkText = (check) => {
    if (check.id === "tradeLimit") return `${t("dayCheckTrades")}: ${check.value} / ${check.target}`;
    if (check.id === "risk") return `${t("dayCheckRisk")}: ${check.value}% / ${check.target}%`;
    return `${t("dayCheckChecklist")}: ${check.value} / ${check.target}`;
  };

  return (
    <section className="space-y-3" aria-label={t("dayResultTitle")}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ds-text">{t("dayResultTitle")}</h2>
        <span className="text-[11.5px] text-ds-text3">{t("dayResultHint")}</span>
      </div>
      <KpiStrip
        columns="grid-cols-2 lg:grid-cols-4"
        items={[
          { key: "net", label: t("anNetResult"), value: money(s.netPL), tone: s.netPL > 0 ? "profit" : s.netPL < 0 ? "loss" : undefined },
          { key: "trades", label: t("trades"), value: String(s.trades), hint: s.tradeLimit != null ? `${t("dayPlanLimit")}: ${s.tradeLimit}` : undefined },
          { key: "wr", label: t("winRate"), value: s.winRate == null ? null : `${s.winRate}%`, hint: s.closed ? `${s.wins}W · ${s.losses}L` : undefined },
          {
            key: "compliance",
            label: t("dayCompliance"),
            value: s.compliance == null ? null : `${Math.round(s.compliance * 100)}%`,
            tone: s.compliance == null ? undefined : s.compliance === 1 ? "profit" : "warn",
            hint: t("dayComplianceHint"),
          },
        ]}
      />
      {s.checks.length ? (
        <ul className="flex flex-wrap gap-2">
          {s.checks.map((check) => (
            <li
              key={check.id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] ${check.ok ? "border-ds-line text-ds-text2" : "border-[color:color-mix(in_srgb,var(--ds-warn)_35%,transparent)] text-ds-warn"}`}
            >
              {check.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-ds-pos" aria-hidden="true" /> : <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />}
              {checkText(check)}
              <span className="sr-only">{check.ok ? t("dayCheckOk") : t("dayCheckBroken")}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
