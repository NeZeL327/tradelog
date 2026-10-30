import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/lib/AuthContext";
import { getStrategies, getTrades, getTradingAccounts } from "@/lib/localStorage";
import { useLanguage } from "@/components/LanguageProvider";
import { usePnlDisplay } from "@/hooks/use-pnl-display";
import { Button } from "@/components/ui/button";
import PageShell from "@/components/common/PageShell";
import KpiStrip from "@/components/common/KpiStrip";
import SectionCard from "@/components/common/SectionCard";
import { balanceForTrades } from "@/lib/pnlDisplay";
import { getActiveAccountIds, tradeBelongsToActiveAccount } from "@/lib/utils";
import { getTradeTimeSource, zonedWallTimeToDate } from "@/lib/userSettings";
import { CHART, chartGridProps, chartSeriesProps, chartTooltipStyle } from "@/lib/chartTheme";
import { PERIOD_KINDS, buildPeriodReport, periodIncludesFuture, periodLabel, periodRange, shiftPeriod } from "@/lib/periodReport";

const fmtDay = (key) => (key ? key.split("-").reverse().join(".") : "—");

/** Raport okresowy: tylko odczyt z istniejących transakcji (aktywne konta). Notatki bez zapisu do czasu zgody. */
export default function Reports() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const pnl = usePnlDisplay();
  const [range, setRange] = useState(() => periodRange("month"));

  const { data: trades = [] } = useQuery({ queryKey: ["trades", user?.id], queryFn: () => getTrades(user?.id), enabled: !!user?.id });
  const { data: accounts = [] } = useQuery({ queryKey: ["accounts", user?.id], queryFn: () => getTradingAccounts(user?.id), enabled: !!user?.id });
  const { data: strategies = [] } = useQuery({ queryKey: ["strategies", user?.id], queryFn: () => getStrategies(user?.id), enabled: !!user?.id });

  const activeIds = getActiveAccountIds(accounts);
  const activeTrades = trades.filter((trade) => tradeBelongsToActiveAccount(trade, activeIds));
  const timeSource = getTradeTimeSource();
  const balance = balanceForTrades(activeTrades, accounts);
  const report = buildPeriodReport(activeTrades, range, {
    getInstant: (trade) => zonedWallTimeToDate(trade?.date, trade?.entry_time || trade?.open_time || trade?.time, timeSource),
    strategies,
    startBalance: balance,
  });
  const money = (value, signed = true) => {
    if (value == null || !Number.isFinite(value)) return "—";
    const text = pnl.formatAmount(value, balance);
    return signed ? text : text.replace(/^\+/, "");
  };
  const tone = (value) => (value > 0 ? "profit" : value < 0 ? "loss" : undefined);
  const { kpis } = report;
  const has = report.trades > 0;
  const months = t("rpMonths").split(",");
  const label = periodLabel(range, { months, weekWord: t("rpWeek") });
  const nextDisabled = periodIncludesFuture(range);

  const kpiItems = [
    { key: "net", label: t("anNetResult"), value: has ? money(kpis.netPL) : null, tone: tone(kpis.netPL) },
    { key: "trades", label: t("trades"), value: String(report.trades), hint: `${report.tradingDays} ${t("rpTradingDays")}` },
    { key: "wr", label: t("winRate"), value: has && kpis.wins + kpis.losses > 0 ? `${kpis.winRate}%` : null, hint: has ? `${kpis.wins}W · ${kpis.losses}L` : undefined },
    { key: "pf", label: t("profitFactor"), value: has ? (kpis.profitFactor == null ? "∞" : kpis.profitFactor.toFixed(2)) : null },
    { key: "exp", label: t("expectancy"), value: has ? money(kpis.expectancy) : null, tone: tone(kpis.expectancy), hint: t("anPerTrade") },
    { key: "dd", label: t("maxDrawdown"), value: has ? money(kpis.maxDrawdown) : null, tone: kpis.maxDrawdown < 0 ? "loss" : undefined },
  ];

  const GroupTable = ({ rows, nameOf }) => (
    <table className="w-full min-w-[420px] text-[13px]">
      <thead>
        <tr className="border-b border-ds-line text-ds-text3">
          <th className="py-2 text-left font-medium">{t("stColGroup")}</th>
          <th className="py-2 text-right font-medium">{t("trades")}</th>
          <th className="py-2 text-right font-medium">{t("winRate")}</th>
          <th className="py-2 text-right font-medium">{t("stColNet")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-ds-line last:border-0">
            <td className="py-2 text-ds-text">{nameOf(row)}</td>
            <td className="py-2 text-right tabular-nums text-ds-text2">{row.trades}</td>
            <td className="py-2 text-right tabular-nums text-ds-text2">{row.winRate == null ? "—" : `${row.winRate}%`}</td>
            <td className={`py-2 text-right tabular-nums ${row.netPL > 0 ? "text-ds-pos" : row.netPL < 0 ? "text-ds-neg" : "text-ds-text2"}`}>{money(row.netPL)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const actions = (
    <div className="no-print flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-[10px] border border-ds-line bg-ds-s2 p-0.5" role="group" aria-label={t("rpPeriodKind")}>
        {PERIOD_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={range.kind === kind}
            onClick={() => setRange(periodRange(kind))}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${range.kind === kind ? "bg-ds-s3 text-ds-text" : "text-ds-text3 hover:text-ds-text"}`}
          >
            {t(`rpKind_${kind}`)}
          </button>
        ))}
      </div>
      <div className="inline-flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label={t("rpPrev")} onClick={() => setRange((current) => shiftPeriod(current, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[9rem] text-center text-[13px] font-medium tabular-nums text-ds-text" aria-live="polite">{label}</span>
        <Button variant="outline" size="icon" aria-label={t("rpNext")} disabled={nextDisabled} onClick={() => setRange((current) => shiftPeriod(current, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <Button variant="outline" onClick={() => window.print()} className="gap-2">
        <Printer className="h-4 w-4" />
        {t("rpPrint")}
      </Button>
    </div>
  );

  return (
    <PageShell title={`${t("rpTitle")} · ${label}`} subtitle={t("rpSub")} actions={actions} kpis={<KpiStrip items={kpiItems} columns="grid-cols-2 sm:grid-cols-3 xl:grid-cols-6" />}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard title={t("rpEquity")} className="lg:col-span-2" bodyClassName="p-4 pt-2">
          {report.equity.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={report.equity} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="reportEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART.line} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART.line} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="key" stroke={CHART.axis} tickFormatter={(key) => fmtDay(key).slice(0, 5)} minTickGap={24} />
                <YAxis stroke={CHART.axis} width={64} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  labelFormatter={(key, payload) => {
                    const point = payload?.[0]?.payload;
                    return point ? `${fmtDay(point.key)} · ${t("rpDayResult")} ${money(point.pl)}` : key;
                  }}
                  formatter={(value) => [money(value), t("rpCumulative")]}
                />
                <Area {...chartSeriesProps} type="monotone" dataKey="equity" stroke={CHART.line} strokeWidth={2} fill="url(#reportEquity)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-12 text-center text-[13px] text-ds-text3">{t("rpNoTrades")}</p>
          )}
        </SectionCard>

        <SectionCard title={t("rpBestWorst")}>
          <dl className="space-y-4">
            <div>
              <dt className="type-section">{t("rpBestDay")}</dt>
              <dd className="mt-1 flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-ds-text2">{report.bestDay ? fmtDay(report.bestDay.key) : "—"}</span>
                <span className="text-[16px] font-semibold tabular-nums text-ds-pos">{report.bestDay ? money(report.bestDay.pl) : "—"}</span>
              </dd>
            </div>
            <div>
              <dt className="type-section">{t("rpWorstDay")}</dt>
              <dd className="mt-1 flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-ds-text2">{report.worstDay ? fmtDay(report.worstDay.key) : "—"}</span>
                <span className="text-[16px] font-semibold tabular-nums text-ds-neg">{report.worstDay ? money(report.worstDay.pl) : "—"}</span>
              </dd>
            </div>
            <div>
              <dt className="type-section">{t("streaks")}</dt>
              <dd className="mt-1 text-[13px] tabular-nums text-ds-text">{has ? `${kpis.maxWinStreak} / ${kpis.maxLossStreak}` : "—"} <span className="text-ds-text3">· {t("anStreakHint")}</span></dd>
            </div>
          </dl>
        </SectionCard>
      </div>

      {has ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard title={t("rpByStrategy")} bodyClassName="p-4 overflow-x-auto">
            <GroupTable rows={report.byStrategy} nameOf={(row) => row.name || t("rpNoStrategy")} />
          </SectionCard>
          <SectionCard title={t("anBySession")} description={t("anBySessionDesc")} bodyClassName="p-4 overflow-x-auto">
            {report.bySession.length ? (
              <GroupTable rows={report.bySession} nameOf={(row) => t(`anSession_${row.key}`)} />
            ) : (
              <p className="text-[13px] text-ds-text3">{t("anSessionUnknown")}</p>
            )}
          </SectionCard>
        </div>
      ) : null}

      <SectionCard title={t("rpNotes")} description={t("rpNotesPending")} className="no-print">
        <textarea
          disabled
          rows={4}
          aria-label={t("rpNotes")}
          placeholder={t("rpNotesPlaceholder")}
          className="w-full cursor-not-allowed resize-none rounded-[10px] border border-ds-line bg-ds-s2 p-3 text-[13px] text-ds-text3 placeholder:text-ds-text3"
        />
      </SectionCard>
    </PageShell>
  );
}
