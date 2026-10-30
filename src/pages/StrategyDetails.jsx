import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from '@/lib/AuthContext';
import { getStrategies, getTrades, getTradingAccounts } from '@/lib/localStorage';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { createPageUrl } from "@/utils";
import { getActiveAccountIds, getTradeRealizedPL, isClosedTrade } from "@/lib/utils";
import { CHART, chartTooltipStyle, chartGridProps, chartSeriesProps, chartBarRadius } from "@/lib/chartTheme";
import { PageHeader } from "@/components/common/PageShell";
import KpiStrip from "@/components/common/KpiStrip";
import SectionCard from "@/components/common/SectionCard";
import { useLanguage } from "@/components/LanguageProvider";
import { usePnlDisplay } from "@/hooks/use-pnl-display";
import { balanceForTrades } from "@/lib/pnlDisplay";
import { getTradeTimeSource, zonedWallTimeToDate } from "@/lib/userSettings";
import { sessionOfInstant } from "@/lib/analyticsStats";
import { groupSummary, rulesFromText, strategyEquity, summarizeTrades } from "@/lib/strategyStats";
import QuoteLine from "@/components/QuoteLine";

export default function StrategyDetails() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  // Karty strategii otwierają szczegóły przez ?id=…; trasa nie ma parametru :id.
  const id = params.id || searchParams.get("id") || "";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const pnl = usePnlDisplay();

  const { data: strategy } = useQuery({
    queryKey: ['strategy', id],
    enabled: Boolean(user?.id && id),
    queryFn: async () => {
      if (!user?.id || !id) return null;
      const strategies = await getStrategies(user.id);
      return strategies.find(s => String(s.id) === String(id)) || null;
    }
  });

  const { data: trades = [] } = useQuery({
    queryKey: ['trades', user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => getTrades(user?.id)
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => getTradingAccounts(user?.id)
  });

  if (!user?.id || !id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <p>Ładowanie strategii...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p>Strategia nie znaleziona</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Transakcje tej strategii: zamknięte, z aktywnych kont (jak na liście strategii).
  const activeAccountIds = getActiveAccountIds(accounts);
  const strategyTrades = trades.filter(
    (t) => String(t.strategy_id) === String(id) && isClosedTrade(t) && activeAccountIds.has(String(t.account_id))
  );
  const summary = summarizeTrades(strategyTrades);
  const wins = strategyTrades.filter((t) => t.outcome === "Win").length;
  const losses = strategyTrades.filter((t) => t.outcome === "Loss").length;
  const balance = balanceForTrades(strategyTrades, accounts);
  const money = (value) => (value == null ? "—" : pnl.formatAmount(value, balance));
  const tone = (value) => (value > 0 ? "profit" : value < 0 ? "loss" : undefined);

  const equity = strategyEquity(strategyTrades);
  const rules = rulesFromText(strategy.rules);
  const tradeTimeSource = getTradeTimeSource();
  const bySymbol = groupSummary(strategyTrades, (t) => t.symbol || null);
  const bySession = groupSummary(strategyTrades, (t) =>
    sessionOfInstant(zonedWallTimeToDate(t.date, t.entry_time || t.open_time || t.time, tradeTimeSource))
  ).map((row) => ({ ...row, label: t(`anSession_${row.key}`) }));

  // Wynik po miesiącach (tylko P&L na osi; liczba transakcji w podpowiedzi).
  const monthMap = new Map();
  for (const trade of strategyTrades) {
    const key = String(trade.date || "").slice(0, 7);
    if (!key) continue;
    const row = monthMap.get(key) || { month: key, pl: 0, trades: 0 };
    row.pl += getTradeRealizedPL(trade) ?? 0;
    row.trades += 1;
    monthMap.set(key, row);
  }
  const monthlyData = [...monthMap.values()]
    .sort((x, y) => x.month.localeCompare(y.month))
    .map((row) => ({ ...row, pl: Math.round(row.pl * 100) / 100 }));

  const kpiItems = [
    { key: "net", label: t('stColNet'), value: summary.trades ? money(summary.netPL) : null, tone: tone(summary.netPL) },
    { key: "wr", label: t('winRate'), value: summary.winRate == null ? null : `${summary.winRate}%`, hint: `${wins}W · ${losses}L` },
    { key: "exp", label: t('expectancy'), value: money(summary.expectancy), tone: tone(summary.expectancy), hint: t('anPerTrade') },
    { key: "pf", label: t('profitFactor'), value: summary.profitFactor != null ? summary.profitFactor.toFixed(2) : summary.grossProfit > 0 ? "∞" : null },
    { key: "trades", label: t('trades'), value: String(summary.trades) },
    { key: "rating", label: t('stRating'), value: strategy.performance_rating ? `${strategy.performance_rating} / 5` : null },
  ];

  const GroupTable = ({ rows, labelKey = "key" }) => (
    <table className="w-full min-w-[420px] text-[13px]">
      <thead>
        <tr className="border-b border-ds-line text-ds-text3">
          <th className="py-2 text-left font-medium">{t('stColGroup')}</th>
          <th className="py-2 text-right font-medium">{t('trades')}</th>
          <th className="py-2 text-right font-medium">{t('winRate')}</th>
          <th className="py-2 text-right font-medium">{t('expectancy')}</th>
          <th className="py-2 text-right font-medium">{t('stColNet')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-ds-line last:border-0">
            <td className="py-2 text-ds-text">{row[labelKey]}</td>
            <td className="py-2 text-right tabular-nums text-ds-text2">{row.trades}</td>
            <td className="py-2 text-right tabular-nums text-ds-text2">{row.winRate == null ? "—" : `${row.winRate}%`}</td>
            <td className={`py-2 text-right tabular-nums ${row.expectancy > 0 ? "text-ds-pos" : row.expectancy < 0 ? "text-ds-neg" : "text-ds-text2"}`}>{money(row.expectancy)}</td>
            <td className={`py-2 text-right tabular-nums ${row.netPL > 0 ? "text-ds-pos" : row.netPL < 0 ? "text-ds-neg" : "text-ds-text2"}`}>{money(row.netPL)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="w-full min-h-0 space-y-3 dashboard-surface">
      <div className="max-w-none mx-0 space-y-3">
        <PageHeader
          title={strategy.name}
          subtitle={strategy.category}
          actions={(
            <>
              <QuoteLine className="hidden lg:flex shrink-0" />
              <Button variant="outline" onClick={() => navigate(createPageUrl('Strategies'))} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t('stBack')}
              </Button>
            </>
          )}
        />
        <KpiStrip items={kpiItems} columns="grid-cols-2 sm:grid-cols-3 xl:grid-cols-6" />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SectionCard title={t('stEquity')} className="lg:col-span-2" bodyClassName="p-4 pt-2">
            {equity.length > 1 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={equity} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id="colorCum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART.line} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART.line} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="n" stroke="var(--ds-text3)" tick={{ fill: 'var(--ds-text3)', fontSize: 11 }} minTickGap={24} />
                  <YAxis stroke="var(--ds-text3)" tick={{ fill: 'var(--ds-text3)', fontSize: 11 }} width={60} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelFormatter={(label, payload) => {
                      const point = payload?.[0]?.payload;
                      return point ? `${t('anTradeNo')} ${point.n} · ${point.date.split("-").reverse().join(".")}` : label;
                    }}
                    formatter={(value) => [money(value), t('anEquity')]}
                  />
                  <Area {...chartSeriesProps} type="monotone" dataKey="equity" stroke={CHART.line} strokeWidth={2} fillOpacity={1} fill="url(#colorCum)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-[13px] text-ds-text3">{t('stNoTradesYet')}</p>
            )}
          </SectionCard>

          <SectionCard title={t('stRules')} description={rules.length ? t('stRulesDesc') : undefined}>
            {rules.length ? (
              <ul className="space-y-2">
                {rules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[13px] leading-relaxed text-ds-text">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ds-text3" aria-hidden="true" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ds-text3">{t('stNoRules')}</p>
            )}
          </SectionCard>
        </div>

        {strategyTrades.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SectionCard title={t('stBySymbol')} bodyClassName="p-4 overflow-x-auto">
              <GroupTable rows={bySymbol} />
            </SectionCard>
            <SectionCard title={t('anBySession')} description={t('anBySessionDesc')} bodyClassName="p-4 overflow-x-auto">
              {bySession.length ? <GroupTable rows={bySession} labelKey="label" /> : <p className="text-[13px] text-ds-text3">{t('anSessionUnknown')}</p>}
            </SectionCard>
          </div>
        ) : null}

        {monthlyData.length > 0 ? (
          <SectionCard title={t('stMonthly')} bodyClassName="p-4 pt-2">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="month" stroke="var(--ds-text3)" tick={{ fill: 'var(--ds-text3)', fontSize: 11 }} />
                <YAxis stroke="var(--ds-text3)" tick={{ fill: 'var(--ds-text3)', fontSize: 11 }} width={60} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload;
                    return row ? `${label} · ${row.trades} ${t('trades')}` : label;
                  }}
                  formatter={(value) => [money(value), t('netPL')]}
                />
                <Bar {...chartSeriesProps} dataKey="pl" radius={chartBarRadius} maxBarSize={48}>
                  {monthlyData.map((row) => (
                    <Cell key={row.month} fill={row.pl >= 0 ? CHART.profit : CHART.loss} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        ) : null}

        {/* Setup i wskaźniki (opisy z dokumentu strategii, bez zmian) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {strategy.setup_description && (
            <Card>
              <CardHeader>
                <CardTitle>Setup handlowy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap text-sm">{strategy.setup_description}</p>
              </CardContent>
            </Card>
          )}

          {strategy.entry_indicators && (
            <Card>
              <CardHeader>
                <CardTitle>Wskaźniki wejścia</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap text-sm">{strategy.entry_indicators}</p>
              </CardContent>
            </Card>
          )}

          {strategy.exit_indicators && (
            <Card>
              <CardHeader>
                <CardTitle>Wskaźniki wyjścia</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground whitespace-pre-wrap text-sm">{strategy.exit_indicators}</p>
              </CardContent>
            </Card>
          )}

          {strategy.risk_management && (
            <Card>
              <CardHeader>
                <CardTitle>Zarządzanie ryzykiem</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {strategy.risk_management.max_risk_percent && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Max ryzyko na transakcję</p>
                    <p className="text-lg font-bold text-foreground">{strategy.risk_management.max_risk_percent}%</p>
                  </div>
                )}
                {strategy.risk_management.position_size_method && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Rozmiar pozycji</p>
                    <p className="text-sm text-foreground">{strategy.risk_management.position_size_method}</p>
                  </div>
                )}
                {strategy.risk_management.stop_loss_method && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Stop Loss</p>
                    <p className="text-sm text-foreground">{strategy.risk_management.stop_loss_method}</p>
                  </div>
                )}
                {strategy.risk_management.take_profit_method && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Take Profit</p>
                    <p className="text-sm text-foreground">{strategy.risk_management.take_profit_method}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Komentarz */}
        {strategy.comments && (
          <Card className="border border-ds-line bg-card">
            <CardHeader>
              <CardTitle className="text-foreground text-lg">Opinia o strategii</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground whitespace-pre-wrap">{strategy.comments}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}