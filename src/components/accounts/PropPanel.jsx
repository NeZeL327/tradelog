import { Area, AreaChart, ReferenceLine, ResponsiveContainer, YAxis } from "recharts";
import { format } from "date-fns";
import { useLanguage } from "@/components/LanguageProvider";
import { usePnlDisplay } from "@/hooks/use-pnl-display";
import { CHART, chartSeriesProps } from "@/lib/chartTheme";
import { computePropStatus, limitTone } from "@/lib/propRules";

const TONE_COLOR = { ok: "var(--ds-pos)", warn: "var(--ds-warn)", danger: "var(--ds-neg)" };
const pct = (ratio) => (ratio == null || !Number.isFinite(ratio) ? "—" : `${Math.round(ratio * 100)}%`);

// Pasek zużycia: szerokość = min(100%, zużycie); kolor wg progu 70/90%.
function LimitBar({ label, value, detail, used, color, ariaLabel }) {
  const width = used == null ? 0 : Math.max(0, Math.min(1, used)) * 100;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="type-section">{label}</span>
        <span className="text-[12.5px] font-medium tabular-nums text-ds-text">{value}</span>
      </div>
      <div
        className="mt-1.5 h-[5px] w-full overflow-hidden rounded-full bg-ds-s3"
        role="progressbar"
        aria-label={ariaLabel || label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
      >
        <span className="block h-full rounded-full motion-bar-grow" style={{ width: `${width}%`, background: color }} />
      </div>
      {detail ? <p className="mt-1 text-[11px] text-ds-text3">{detail}</p> : null}
    </div>
  );
}

/** Panel limitów konta prop (szacunek z zapisanych transakcji). */
export default function PropPanel({ account, trades }) {
  const { t } = useLanguage();
  const pnl = usePnlDisplay();
  const status = computePropStatus(account, trades);
  if (!status.hasLimits) return null;

  const currency = account.currency || "";
  // Ta sama zasada USD/% co w reszcie aplikacji: % liczony od kapitału początkowego konta.
  const money = (value, signed = false) => {
    if (value == null || !Number.isFinite(value)) return "—";
    if (pnl.mode === "percent") {
      if (!status.initial) return "—";
      const p = (value / status.initial) * 100;
      return `${signed && p > 0 ? "+" : ""}${p.toFixed(2)}%`;
    }
    return `${signed && value > 0 ? "+" : ""}${value.toFixed(2)}${currency ? ` ${currency}` : ""}`;
  };
  const dayLabel = (key) => (key ? key.split("-").reverse().join(".") : "");

  const { daily, total, target, consistency } = status;
  const dailyUsed = daily ? Math.max(daily.todayUsed, 0) : null;

  return (
    <section className="space-y-3 border-t border-ds-line pt-3" aria-label={t("propPanelTitle")}>
      {daily ? (
        <LimitBar
          label={t("propDailyLimit")}
          value={`${money(daily.todayLoss)} / ${money(daily.limit)} · ${pct(dailyUsed)}`}
          used={dailyUsed}
          color={TONE_COLOR[limitTone(dailyUsed)]}
          ariaLabel={`${t("propDailyLimit")}: ${pct(dailyUsed)}`}
          detail={daily.worstDay
            ? `${t("propWorstDay")}: ${dayLabel(daily.worstDay.key)} · ${money(daily.worstDay.pl, true)} (${pct(daily.worstUsed)} ${t("propOfLimit")})`
            : t("propNoLossDays")}
        />
      ) : null}
      {total ? (
        <LimitBar
          label={t("propTotalLimit")}
          value={`${t("propLeft")} ${money(total.remaining)} · ${total.remainingPct.toFixed(2)}%`}
          used={total.used}
          color={TONE_COLOR[limitTone(total.used)]}
          ariaLabel={`${t("propTotalLimit")}: ${pct(total.used)}`}
          detail={`${t("propFloor")}: ${money(total.floor)}`}
        />
      ) : null}
      {target ? (
        <LimitBar
          label={t("propTarget")}
          value={`${money(status.netPL, true)} / ${money(target.target)} · ${pct(target.progress)}`}
          used={target.progress}
          color="var(--ds-pos)"
          ariaLabel={`${t("propTarget")}: ${pct(target.progress)}`}
          detail={target.remaining > 0 ? `${t("propToGo")}: ${money(target.remaining)}` : t("propTargetReached")}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <div className="min-w-0">
          <p className="type-section">{t("propTradingDays")}</p>
          <p className="mt-0.5 font-semibold tabular-nums text-ds-text">{status.tradingDays}</p>
        </div>
        <div className="min-w-0" title={t("propConsistencyHint")}>
          <p className="type-section">{t("propConsistency")}</p>
          <p className="mt-0.5 font-semibold tabular-nums text-ds-text">{pct(consistency.share)}</p>
        </div>
      </div>

      {status.curve.length > 1 ? (
        <div className="h-[64px]" aria-label={t("propCurve")} role="img">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={status.curve} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`prop-${account.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={CHART.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={[(min) => Math.min(min, total?.floor ?? min), (max) => max]} />
              {total ? <ReferenceLine y={total.floor} stroke={CHART.loss} strokeDasharray="4 4" strokeOpacity={0.7} /> : null}
              <Area type="monotone" dataKey="equity" stroke={CHART.accent} strokeWidth={1.5} fill={`url(#prop-${account.id})`} {...chartSeriesProps} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <p className="text-[10.5px] leading-snug text-ds-text3">
        {t("propDisclaimer")}
        {status.lastChange ? ` · ${t("propLastChange")}: ${format(status.lastChange, "dd.MM.yyyy HH:mm")}` : ""}
      </p>
    </section>
  );
}
