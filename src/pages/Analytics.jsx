import React, { useState } from "react";
import { useAuth } from '@/lib/AuthContext';
import { getTrades, getTradingAccounts, getStrategies } from '@/lib/localStorage';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, TrendingUp, AlertCircle, Lightbulb, Target, Wallet, DollarSign, Activity, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ComposedChart } from "recharts";
import { ExportButton } from "../components/ExportButton";
import { ImportButton } from "../components/ImportButton";
import { useLanguage } from "@/components/LanguageProvider";

export default function Analytics() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [filterSymbol, setFilterSymbol] = useState("all");
  const [filterStrategy, setFilterStrategy] = useState("all");
  const [filterDirection, setFilterDirection] = useState("all");
  const [filterOutcome, setFilterOutcome] = useState("all");
  const [filterTimeframe, setFilterTimeframe] = useState("all");
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [timePeriod, setTimePeriod] = useState("daily");

  const { data: trades = [], isLoading } = useQuery({
    queryKey: ['trades'],
    queryFn: () => getTrades(user?.id),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => getTradingAccounts(user?.id),
  });

  const { data: strategies = [] } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => getStrategies(user?.id),
  });

  const normalizeDirection = (direction) => {
    if (!direction) return "";
    const normalized = direction.toLowerCase();
    if (normalized === "long" || normalized === "buy") return "Long";
    if (normalized === "short" || normalized === "sell") return "Short";
    return direction;
  };

  const uniqueSymbols = [...new Set(trades.map(t => t.symbol).filter(Boolean))];
  const uniqueDirections = [...new Set(trades.map(t => normalizeDirection(t.direction)).filter(Boolean))];
  const uniqueOutcomes = [...new Set(trades.map(t => t.outcome).filter(Boolean))];
  const uniqueTimeframes = [...new Set(trades.map(t => t.timeframe).filter(Boolean))];

  // Filter trades by selected filters
  const filteredTrades = trades.filter(t => (
    (selectedAccount === "all" || t.account_id === selectedAccount) &&
    (filterSymbol === "all" || t.symbol === filterSymbol) &&
    (filterStrategy === "all" || t.strategy_id === filterStrategy) &&
    (filterDirection === "all" || normalizeDirection(t.direction) === filterDirection) &&
    (filterOutcome === "all" || t.outcome === filterOutcome) &&
    (filterTimeframe === "all" || t.timeframe === filterTimeframe)
  ));

  // Symbol analysis
  const symbolStats = {};
  filteredTrades.forEach(trade => {
    if (!symbolStats[trade.symbol]) {
      symbolStats[trade.symbol] = { wins: 0, total: 0, pl: 0 };
    }
    symbolStats[trade.symbol].total++;
    if (trade.outcome === "Win") symbolStats[trade.symbol].wins++;
    symbolStats[trade.symbol].pl += parseFloat(trade.profit_loss) || 0;
  });

  const symbolData = Object.entries(symbolStats)
    .map(([symbol, stats]) => ({
      symbol,
      winRate: ((stats.wins / stats.total) * 100).toFixed(1),
      avgPL: (stats.pl / stats.total).toFixed(2),
      totalPL: stats.pl.toFixed(2),
      trades: stats.total
    }))
    .sort((a, b) => parseFloat(b.totalPL) - parseFloat(a.totalPL))
    .slice(0, 10);

  // Strategy analysis
  const strategyStats = {};
  filteredTrades.forEach(trade => {
    const strategy = strategies.find(s => s.id === trade.strategy_id);
    const strategyName = strategy?.name || "Bez strategii";
    
    if (!strategyStats[strategyName]) {
      strategyStats[strategyName] = { wins: 0, total: 0, pl: 0 };
    }
    strategyStats[strategyName].total++;
    if (trade.outcome === "Win") strategyStats[strategyName].wins++;
    strategyStats[strategyName].pl += parseFloat(trade.profit_loss) || 0;
  });

  const strategyData = Object.entries(strategyStats).map(([name, stats]) => ({
    name,
    winRate: ((stats.wins / stats.total) * 100).toFixed(1),
    avgPL: (stats.pl / stats.total).toFixed(2),
    totalPL: stats.pl.toFixed(2),
    trades: stats.total
  }));

  // Timeframe analysis
  const timeframeStats = {};
  filteredTrades.forEach(trade => {
    if (trade.timeframe) {
      if (!timeframeStats[trade.timeframe]) {
        timeframeStats[trade.timeframe] = { wins: 0, total: 0, pl: 0 };
      }
      timeframeStats[trade.timeframe].total++;
      if (trade.outcome === "Win") timeframeStats[trade.timeframe].wins++;
      timeframeStats[trade.timeframe].pl += parseFloat(trade.profit_loss) || 0;
    }
  });

  const timeframeData = Object.entries(timeframeStats).map(([tf, stats]) => ({
    timeframe: tf,
    winRate: ((stats.wins / stats.total) * 100).toFixed(1),
    avgPL: (stats.pl / stats.total).toFixed(2),
    trades: stats.total
  }));

  // Direction analysis
  const directionStats = { Long: { wins: 0, total: 0, pl: 0 }, Short: { wins: 0, total: 0, pl: 0 } };
  filteredTrades.forEach(trade => {
    const direction = normalizeDirection(trade.direction);
    if (directionStats[direction]) {
      directionStats[direction].total++;
      if (trade.outcome === "Win") directionStats[direction].wins++;
      directionStats[direction].pl += parseFloat(trade.profit_loss) || 0;
    }
  });

  const directionData = Object.entries(directionStats).map(([dir, stats]) => ({
    direction: dir,
    winRate: stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : 0,
    avgPL: stats.total > 0 ? (stats.pl / stats.total).toFixed(2) : 0,
    totalPL: stats.pl.toFixed(2),
    trades: stats.total
  }));

  // Session analysis
  const sessionStats = {};
  filteredTrades.forEach(trade => {
    if (trade.session) {
      if (!sessionStats[trade.session]) {
        sessionStats[trade.session] = { wins: 0, total: 0, pl: 0 };
      }
      sessionStats[trade.session].total++;
      if (trade.outcome === "Win") sessionStats[trade.session].wins++;
      sessionStats[trade.session].pl += parseFloat(trade.profit_loss) || 0;
    }
  });

  const sessionData = Object.entries(sessionStats).map(([session, stats]) => ({
    session,
    winRate: ((stats.wins / stats.total) * 100).toFixed(1),
    avgPL: (stats.pl / stats.total).toFixed(2),
    trades: stats.total
  }));

  // Setup quality analysis
  const setupStats = {};
  filteredTrades.forEach(trade => {
    if (trade.setup_quality) {
      if (!setupStats[trade.setup_quality]) {
        setupStats[trade.setup_quality] = { wins: 0, total: 0, pl: 0 };
      }
      setupStats[trade.setup_quality].total++;
      if (trade.outcome === "Win") setupStats[trade.setup_quality].wins++;
      setupStats[trade.setup_quality].pl += parseFloat(trade.profit_loss) || 0;
    }
  });

  const setupData = Object.entries(setupStats).map(([quality, stats]) => ({
    quality,
    winRate: ((stats.wins / stats.total) * 100).toFixed(1),
    avgPL: (stats.pl / stats.total).toFixed(2),
    trades: stats.total
  })).sort((a, b) => a.quality.localeCompare(b.quality));

  // Emotional state analysis
  const emotionalStats = {};
  filteredTrades.forEach(trade => {
    if (trade.emotional_state) {
      if (!emotionalStats[trade.emotional_state]) {
        emotionalStats[trade.emotional_state] = { wins: 0, total: 0, pl: 0 };
      }
      emotionalStats[trade.emotional_state].total++;
      if (trade.outcome === "Win") emotionalStats[trade.emotional_state].wins++;
      emotionalStats[trade.emotional_state].pl += parseFloat(trade.profit_loss) || 0;
    }
  });

  const emotionalData = Object.entries(emotionalStats).map(([state, stats]) => ({
    state,
    winRate: ((stats.wins / stats.total) * 100).toFixed(1),
    avgPL: (stats.pl / stats.total).toFixed(2),
    trades: stats.total
  }));

  // Equity curve
  let cumulative = 0;
  const equityCurve = filteredTrades.slice().reverse().map((trade, index) => {
    cumulative += parseFloat(trade.profit_loss) || 0;
    return {
      trade: index + 1,
      equity: cumulative.toFixed(2),
      date: trade.date
    };
  });

  // Period performance (daily, weekly, monthly, yearly)
  const periodStats = {};
  filteredTrades.forEach(trade => {
    let period;
    if (timePeriod === "daily") {
      period = trade.date.substring(0, 10); // YYYY-MM-DD
    } else if (timePeriod === "weekly") {
      const date = new Date(trade.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      period = weekStart.toISOString().substring(0, 10);
    } else if (timePeriod === "monthly") {
      period = trade.date.substring(0, 7); // YYYY-MM
    } else if (timePeriod === "yearly") {
      period = trade.date.substring(0, 4); // YYYY
    }
    
    if (!periodStats[period]) {
      periodStats[period] = { wins: 0, total: 0, pl: 0 };
    }
    periodStats[period].total++;
    if (trade.outcome === "Win") periodStats[period].wins++;
    periodStats[period].pl += parseFloat(trade.profit_loss) || 0;
  });

  const periodData = Object.entries(periodStats)
    .map(([period, stats]) => ({
      period,
      pl: stats.pl.toFixed(2),
      trades: stats.total,
      winRate: ((stats.wins / stats.total) * 100).toFixed(1)
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const bestPeriod = periodData.length
    ? periodData.reduce((best, current) => (Number(current.pl) > Number(best.pl) ? current : best), periodData[0])
    : null;
  const bestWinRatePeriod = periodData.length
    ? periodData.reduce((best, current) => (Number(current.winRate) > Number(best.winRate) ? current : best), periodData[0])
    : null;

  // Account comparison
  const accountData = accounts.map(account => {
    const accountTrades = trades.filter(t => t.account_id === account.id);
    const wins = accountTrades.filter(t => t.outcome === "Win").length;
    const totalPL = accountTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0);
    
    return {
      name: account.name,
      winRate: accountTrades.length > 0 ? ((wins / accountTrades.length) * 100).toFixed(1) : 0,
      totalPL: totalPL.toFixed(2),
      trades: accountTrades.length,
      roi: account.initial_balance > 0 ? ((totalPL / parseFloat(account.initial_balance)) * 100).toFixed(2) : 0
    };
  }).filter(a => a.trades > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];

  const outcomeCounts = {
    wins: filteredTrades.filter(t => t.outcome === 'Win').length,
    losses: filteredTrades.filter(t => t.outcome === 'Loss').length,
    breakeven: filteredTrades.filter(t => t.outcome === 'Breakeven').length
  };
  const outcomeTotal = outcomeCounts.wins + outcomeCounts.losses + outcomeCounts.breakeven;
  const outcomeChartData = [
    {
      name: t('wins'),
      count: outcomeCounts.wins,
      rate: outcomeTotal ? (outcomeCounts.wins / outcomeTotal) * 100 : 0,
      fill: '#22c55e'
    },
    {
      name: t('breakeven'),
      count: outcomeCounts.breakeven,
      rate: outcomeTotal ? (outcomeCounts.breakeven / outcomeTotal) * 100 : 0,
      fill: '#94a3b8'
    },
    {
      name: t('losses'),
      count: outcomeCounts.losses,
      rate: outcomeTotal ? (outcomeCounts.losses / outcomeTotal) * 100 : 0,
      fill: '#f43f5e'
    }
  ];

  const directionEdgeData = directionData.map((entry) => ({
    direction: entry.direction,
    netPL: Number(entry.totalPL),
    winRate: Number(entry.winRate),
    trades: entry.trades
  }));

  const outcomeTop = outcomeTotal
    ? outcomeChartData.reduce((best, current) => (current.count > best.count ? current : best), outcomeChartData[0])
    : null;
  const directionTop = directionEdgeData.length
    ? directionEdgeData.reduce((best, current) => (current.netPL > best.netPL ? current : best), directionEdgeData[0])
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-[#0f0f16] dark:via-[#14141f] dark:to-[#1a1a2e] p-6">
      <div className="max-w-screen-2xl w-full mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{t('advancedAnalytics')}</h1>
            <p className="text-slate-600 dark:text-slate-400">{t('detailedAnalysisOfAllAspects')}</p>
          </div>
          
          <div className="flex gap-3 items-center">
            <ImportButton 
              onImportSuccess={() => window.location.reload()} 
              accounts={accounts} 
              strategies={strategies} 
            />
            <ExportButton 
              trades={filteredTrades} 
              accounts={accounts} 
              strategies={strategies} 
              type="analytics"
              analytics={{
                totalPL: filteredTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0),
                winRate: filteredTrades.length > 0 ? (filteredTrades.filter(t => t.outcome === "Win").length / filteredTrades.filter(t => t.outcome).length) * 100 : 0,
                profitFactor: (() => {
                  const wins = filteredTrades.filter(t => parseFloat(t.profit_loss) > 0).reduce((sum, t) => sum + parseFloat(t.profit_loss), 0);
                  const losses = Math.abs(filteredTrades.filter(t => parseFloat(t.profit_loss) < 0).reduce((sum, t) => sum + parseFloat(t.profit_loss), 0));
                  return losses > 0 ? wins / losses : wins > 0 ? 999 : 0;
                })(),
                avgWin: (() => {
                  const winTrades = filteredTrades.filter(t => parseFloat(t.profit_loss) > 0);
                  return winTrades.length > 0 ? winTrades.reduce((sum, t) => sum + parseFloat(t.profit_loss), 0) / winTrades.length : 0;
                })(),
                avgLoss: (() => {
                  const lossTrades = filteredTrades.filter(t => parseFloat(t.profit_loss) < 0);
                  return lossTrades.length > 0 ? lossTrades.reduce((sum, t) => sum + parseFloat(t.profit_loss), 0) / lossTrades.length : 0;
                })()
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-7 gap-3 items-end">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">{t('account')}</span>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allAccounts')}</SelectItem>
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">{t('symbol')}</span>
            <Select value={filterSymbol} onValueChange={setFilterSymbol}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder={t('symbol')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                {uniqueSymbols.map(sym => (
                  <SelectItem key={sym} value={sym}>{sym}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">{t('strategy')}</span>
            <Select value={filterStrategy} onValueChange={setFilterStrategy}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder={t('strategy')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                {strategies.map(strategy => (
                  <SelectItem key={strategy.id} value={strategy.id}>{strategy.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">{t('direction')}</span>
            <Select value={filterDirection} onValueChange={setFilterDirection}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder={t('direction')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                {uniqueDirections.map(dir => (
                  <SelectItem key={dir} value={dir}>{dir}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">{t('outcome')}</span>
            <Select value={filterOutcome} onValueChange={setFilterOutcome}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder={t('outcome')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                {uniqueOutcomes.map(out => (
                  <SelectItem key={out} value={out}>{out}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center">{t('timeframe')}</span>
            <Select value={filterTimeframe} onValueChange={setFilterTimeframe}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder={t('timeframe')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                {uniqueTimeframes.map(tf => (
                  <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-center opacity-0">{t('reset')}</span>
            <Button
              variant="outline"
              className="h-10 w-full border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400"
              onClick={() => {
                setFilterSymbol("all");
                setFilterStrategy("all");
                setFilterDirection("all");
                setFilterOutcome("all");
                setFilterTimeframe("all");
              }}
            >
              {t('reset')}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-white dark:bg-[#1a1a2e] shadow-lg">
            <TabsTrigger value="overview">{t('overview')}</TabsTrigger>
            <TabsTrigger value="symbols">{t('symbols')}</TabsTrigger>
            <TabsTrigger value="strategies">{t('strategiesAnalytics')}</TabsTrigger>
            <TabsTrigger value="accounts">{t('accountsAnalytics')}</TabsTrigger>
            <TabsTrigger value="psychology">{t('psychology')}</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Outcome + Direction Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-white via-white to-slate-50 dark:from-[#151527] dark:via-[#14141f] dark:to-[#0f172a] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                <CardHeader>
                  <CardTitle className="dark:text-white">{t('outcomeDistribution')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {outcomeChartData.map((entry) => (
                      <div
                        key={entry.name}
                        className="rounded-xl border border-slate-200/60 bg-white/70 dark:bg-slate-500/10 dark:border-slate-500/20 p-3"
                      >
                        <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">{entry.name}</p>
                        <p className="text-2xl font-semibold text-slate-900 dark:text-white">{entry.count}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{entry.rate.toFixed(0)}%</p>
                      </div>
                    ))}
                  </div>

                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={outcomeChartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" />
                      <YAxis yAxisId="left" stroke="#64748b" allowDecimals={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="#64748b" tickFormatter={(value) => `${value}%`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', color: '#e2e8f0' }}
                        formatter={(value, name) => [
                          name === 'rate' ? `${Number(value).toFixed(1)}%` : value,
                          name === 'rate' ? t('winRate') : t('trades')
                        ]}
                      />
                      <Bar dataKey="count" yAxisId="left" radius={[10, 10, 0, 0]}>
                        {outcomeChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                      <Line type="monotone" dataKey="rate" yAxisId="right" stroke="#38bdf8" strokeWidth={2} dot={{ r: 4, fill: '#38bdf8' }} />
                    </ComposedChart>
                  </ResponsiveContainer>

                  <div className="rounded-lg border border-slate-200/60 bg-white/70 dark:bg-slate-900/40 dark:border-slate-700/60 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                    {outcomeTop
                      ? `${t('insightOutcomeMost')} ${outcomeTop.name}`
                      : t('insightOutcomeEmpty')}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-white via-white to-slate-50 dark:from-[#151527] dark:via-[#14141f] dark:to-[#0f172a] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                <CardHeader>
                  <CardTitle className="dark:text-white">{t('directionDistribution')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {directionEdgeData.map((entry) => (
                      <div
                        key={entry.direction}
                        className="rounded-xl border border-slate-200/60 bg-white/70 dark:bg-slate-500/10 dark:border-slate-500/20 p-3"
                      >
                        <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">{entry.direction}</p>
                        <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                          {entry.netPL >= 0 ? '+' : ''}{entry.netPL.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t('winRate')}: {entry.winRate}%
                        </p>
                      </div>
                    ))}
                  </div>

                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={directionEdgeData} layout="vertical" margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" stroke="#64748b" />
                      <YAxis type="category" dataKey="direction" stroke="#64748b" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', color: '#e2e8f0' }}
                        formatter={(value) => [Number(value).toFixed(2), t('netPL')]}
                      />
                      <Bar dataKey="netPL" radius={[10, 10, 10, 10]}>
                        {directionEdgeData.map((entry) => (
                          <Cell key={entry.direction} fill={entry.netPL >= 0 ? '#38bdf8' : '#fb7185'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="rounded-lg border border-slate-200/60 bg-white/70 dark:bg-slate-900/40 dark:border-slate-700/60 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                    {directionTop
                      ? `${t('insightDirectionBest')} ${directionTop.direction} · ${directionTop.winRate}% ${t('winRate')}`
                      : t('insightDirectionEmpty')}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Equity Curve */}
            <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 dark:text-white">
                  <Activity className="w-5 h-5" />
                  {t('equityCurve')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={equityCurve}>
                    <defs>
                      <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="trade" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorEquity)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Period Performance */}
            <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <CardTitle className="dark:text-white">
                    {t('results')} {timePeriod === "weekly" ? t('weekly') : timePeriod === "monthly" ? t('monthly') : t('yearly')}
                  </CardTitle>
                  <Select value={timePeriod} onValueChange={setTimePeriod}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">{t('weekly')}</SelectItem>
                      <SelectItem value="monthly">{t('monthly')}</SelectItem>
                      <SelectItem value="yearly">{t('yearly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                  <div className="rounded-xl border border-slate-200/60 bg-white/80 dark:bg-slate-500/10 dark:border-slate-500/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">{t('bestPeriod')}</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {bestPeriod ? bestPeriod.period : '--'}
                    </p>
                    <p className={`text-xs ${bestPeriod && Number(bestPeriod.pl) >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {bestPeriod ? `${Number(bestPeriod.pl) >= 0 ? '+' : ''}${bestPeriod.pl}` : '--'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/60 bg-white/80 dark:bg-slate-500/10 dark:border-slate-500/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">{t('maxWinRate')}</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {bestWinRatePeriod ? `${bestWinRatePeriod.winRate}%` : '--'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {bestWinRatePeriod ? bestWinRatePeriod.period : '--'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/60 bg-white/80 dark:bg-slate-500/10 dark:border-slate-500/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">{t('totalPeriods')}</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{periodData.length}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('results')}</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={periodData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" stroke="#64748b" angle={timePeriod === "weekly" ? -45 : 0} textAnchor={timePeriod === "weekly" ? "end" : "middle"} height={timePeriod === "weekly" ? 80 : 30} />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                    <Bar dataKey="pl" fill="#3b82f6" name="P&L" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Direction & Timeframe */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                <CardHeader>
                  <CardTitle className="dark:text-white">{t('longVsShort')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={directionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="direction" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                      <Legend />
                      <Bar dataKey="winRate" fill="#3b82f6" name="Win Rate (%)" />
                      <Bar dataKey="avgPL" fill="#10b981" name="Średni P&L" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                <CardHeader>
                  <CardTitle className="dark:text-white">{t('timeframeAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={timeframeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="timeframe" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                      <Legend />
                      <Bar dataKey="winRate" fill="#8b5cf6" name="Win Rate (%)" />
                      <Bar dataKey="trades" fill="#f59e0b" name="Liczba transakcji" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Session Analysis */}
            {sessionData.length > 0 && (
              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                <CardHeader>
                  <CardTitle className="dark:text-white">{t('sessionsAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={sessionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="session" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                      <Legend />
                      <Bar dataKey="winRate" fill="#06b6d4" name="Win Rate (%)" />
                      <Bar dataKey="avgPL" fill="#ec4899" name="Średni P&L" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Symbols Tab */}
          <TabsContent value="symbols" className="space-y-6">
            <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
              <CardHeader>
                <CardTitle className="dark:text-white">{t('top10Symbols')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={symbolData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" />
                    <YAxis dataKey="symbol" type="category" stroke="#64748b" width={80} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="totalPL" fill="#10b981" name={t('totalPLLabel')} />
                    <Bar dataKey="winRate" fill="#3b82f6" name="Win Rate (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {symbolData.map((symbol) => (
                <Card 
                  key={symbol.symbol} 
                  className={`bg-white dark:bg-[#1a1a2e] shadow-lg border cursor-pointer transition-all hover:shadow-xl hover:scale-105 ${
                    selectedSymbol === symbol.symbol ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 dark:border-[#2d2d40]'
                  }`}
                  onClick={() => setSelectedSymbol(symbol.symbol)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg dark:text-white">{symbol.symbol}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 dark:text-slate-400">{t('winRate')}:</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">{symbol.winRate}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 dark:text-slate-400">{t('avgPLLabel')}:</span>
                      <span className={`font-bold ${parseFloat(symbol.avgPL) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(symbol.avgPL) > 0 ? '+' : ''}{symbol.avgPL}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 dark:text-slate-400">{t('totalPLLabel')}:</span>
                      <span className={`font-bold ${parseFloat(symbol.totalPL) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(symbol.totalPL) > 0 ? '+' : ''}{symbol.totalPL}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 dark:text-slate-400">{t('trades')}:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{symbol.trades}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Detailed Symbol Analysis */}
            {selectedSymbol && (
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 shadow-2xl border-2 border-blue-300 dark:border-blue-700">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-2xl text-blue-900 dark:text-blue-300">
                      {t('detailedAnalysisSymbol')}: {selectedSymbol}
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedSymbol(null)}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {(() => {
                    const symbolTrades = filteredTrades.filter(t => t.symbol === selectedSymbol);
                    
                    // Account breakdown
                    const accountBreakdown = {};
                    symbolTrades.forEach(trade => {
                      const account = accounts.find(a => a.id === trade.account_id);
                      const accountName = account?.name || "Nieznane";
                      if (!accountBreakdown[accountName]) {
                        accountBreakdown[accountName] = { wins: 0, total: 0, pl: 0 };
                      }
                      accountBreakdown[accountName].total++;
                      if (trade.outcome === "Win") accountBreakdown[accountName].wins++;
                      accountBreakdown[accountName].pl += parseFloat(trade.profit_loss) || 0;
                    });

                    const accountBreakdownData = Object.entries(accountBreakdown).map(([name, stats]) => ({
                      name,
                      winRate: ((stats.wins / stats.total) * 100).toFixed(1),
                      pl: stats.pl.toFixed(2),
                      trades: stats.total
                    }));

                    // Strategy breakdown
                    const strategyBreakdown = {};
                    symbolTrades.forEach(trade => {
                      const strategy = strategies.find(s => s.id === trade.strategy_id);
                      const strategyName = strategy?.name || "Bez strategii";
                      if (!strategyBreakdown[strategyName]) {
                        strategyBreakdown[strategyName] = { wins: 0, total: 0, pl: 0 };
                      }
                      strategyBreakdown[strategyName].total++;
                      if (trade.outcome === "Win") strategyBreakdown[strategyName].wins++;
                      strategyBreakdown[strategyName].pl += parseFloat(trade.profit_loss) || 0;
                    });

                    const strategyBreakdownData = Object.entries(strategyBreakdown).map(([name, stats]) => ({
                      name,
                      winRate: ((stats.wins / stats.total) * 100).toFixed(1),
                      pl: stats.pl.toFixed(2),
                      trades: stats.total
                    }));

                    // Direction breakdown
                    const directionBreakdown = { Long: { wins: 0, total: 0, pl: 0 }, Short: { wins: 0, total: 0, pl: 0 } };
                    symbolTrades.forEach(trade => {
                      const direction = normalizeDirection(trade.direction);
                      if (directionBreakdown[direction]) {
                        directionBreakdown[direction].total++;
                        if (trade.outcome === "Win") directionBreakdown[direction].wins++;
                        directionBreakdown[direction].pl += parseFloat(trade.profit_loss) || 0;
                      }
                    });

                    const directionBreakdownData = Object.entries(directionBreakdown)
                      .filter(([_, stats]) => stats.total > 0)
                      .map(([dir, stats]) => ({
                        direction: dir,
                        winRate: ((stats.wins / stats.total) * 100).toFixed(1),
                        pl: stats.pl.toFixed(2),
                        trades: stats.total
                      }));

                    // Timeframe breakdown
                    const timeframeBreakdown = {};
                    symbolTrades.forEach(trade => {
                      if (trade.timeframe) {
                        if (!timeframeBreakdown[trade.timeframe]) {
                          timeframeBreakdown[trade.timeframe] = { wins: 0, total: 0, pl: 0 };
                        }
                        timeframeBreakdown[trade.timeframe].total++;
                        if (trade.outcome === "Win") timeframeBreakdown[trade.timeframe].wins++;
                        timeframeBreakdown[trade.timeframe].pl += parseFloat(trade.profit_loss) || 0;
                      }
                    });

                    const timeframeBreakdownData = Object.entries(timeframeBreakdown).map(([tf, stats]) => ({
                      timeframe: tf,
                      winRate: ((stats.wins / stats.total) * 100).toFixed(1),
                      pl: stats.pl.toFixed(2),
                      trades: stats.total
                    }));

                    // Best and worst trades
                    const sortedTrades = [...symbolTrades].sort((a, b) => 
                      (parseFloat(b.profit_loss) || 0) - (parseFloat(a.profit_loss) || 0)
                    );
                    const bestTrade = sortedTrades[0];
                    const worstTrade = sortedTrades[sortedTrades.length - 1];

                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Account Breakdown */}
                          <Card className="bg-white">
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Wallet className="w-4 h-4" />
                                Według kont
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {accountBreakdownData.map(item => (
                                  <div key={item.name} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                                    <div>
                                      <p className="font-semibold text-sm text-slate-900">{item.name}</p>
                                      <p className="text-xs text-slate-600">{item.trades} transakcji</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-sm text-blue-600">{item.winRate}%</p>
                                      <p className={`text-xs font-semibold ${parseFloat(item.pl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {parseFloat(item.pl) > 0 ? '+' : ''}{item.pl}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Strategy Breakdown */}
                          <Card className="bg-white dark:bg-slate-900">
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2 dark:text-white">
                                <Brain className="w-4 h-4" />
                                {t('byStrategies')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {strategyBreakdownData.map(item => (
                                  <div key={item.name} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                    <div>
                                      <p className="font-semibold text-sm text-slate-900 dark:text-white">{item.name}</p>
                                      <p className="text-xs text-slate-600 dark:text-slate-400">{item.trades} transakcji</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-sm text-blue-600 dark:text-blue-400">{item.winRate}%</p>
                                      <p className={`text-xs font-semibold ${parseFloat(item.pl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {parseFloat(item.pl) > 0 ? '+' : ''}{item.pl}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Direction Breakdown */}
                          <Card className="bg-white">
                            <CardHeader>
                              <CardTitle className="text-base">{t('longVsShort')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={directionBreakdownData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                  <XAxis dataKey="direction" stroke="#64748b" />
                                  <YAxis stroke="#64748b" />
                                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                                  <Legend />
                                  <Bar dataKey="winRate" fill="#3b82f6" name="Win Rate (%)" />
                                  <Bar dataKey="trades" fill="#10b981" name="Transakcje" />
                                </BarChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>

                          {/* Timeframe Breakdown */}
                          <Card className="bg-white">
                            <CardHeader>
                              <CardTitle className="text-base">Według timeframe</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={timeframeBreakdownData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                  <XAxis dataKey="timeframe" stroke="#64748b" />
                                  <YAxis stroke="#64748b" />
                                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                                  <Legend />
                                  <Bar dataKey="winRate" fill="#8b5cf6" name="Win Rate (%)" />
                                  <Bar dataKey="trades" fill="#f59e0b" name="Transakcje" />
                                </BarChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Best and Worst Trades */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {bestTrade && (
                            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
                              <CardHeader>
                                <CardTitle className="text-base text-green-900 flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4" />
                                  {t('bestTradeSingle')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600">{t('date')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{bestTrade.date}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('direction')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{normalizeDirection(bestTrade.direction)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('profitLoss')}:</span>
                                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                    +{parseFloat(bestTrade.profit_loss).toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('setup')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{bestTrade.setup_quality}</span>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {worstTrade && parseFloat(worstTrade.profit_loss) < 0 && (
                            <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 border border-red-200 dark:border-red-800">
                              <CardHeader>
                                <CardTitle className="text-base text-red-900 dark:text-red-300 flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  Najgorsza transakcja
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">Data:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{worstTrade.date}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('direction')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{normalizeDirection(worstTrade.direction)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('profitLoss')}:</span>
                                  <span className="text-lg font-bold text-red-600 dark:text-red-400">
                                    {parseFloat(worstTrade.profit_loss).toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('setup')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{worstTrade.setup_quality}</span>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Strategies Tab */}
          <TabsContent value="strategies" className="space-y-6">
            <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
              <CardHeader>
                <CardTitle className="dark:text-white">{t('strategiesComparison')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={strategyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" angle={-45} textAnchor="end" height={100} />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="winRate" fill="#3b82f6" name="Win Rate (%)" />
                    <Bar dataKey="avgPL" fill="#10b981" name={t('avgPLLabel')} />
                    <Bar dataKey="trades" fill="#8b5cf6" name={t('noOfTrades')} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {strategyData.map((strategy) => (
                <Card 
                  key={strategy.name} 
                  className={`bg-white dark:bg-[#1a1a2e] shadow-lg border cursor-pointer transition-all hover:shadow-xl hover:scale-105 ${
                    selectedStrategy === strategy.name ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 dark:border-[#2d2d40]'
                  }`}
                  onClick={() => setSelectedStrategy(strategy.name)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg dark:text-white">{strategy.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{strategy.winRate}%</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{t('winRate')}</p>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                        <p className={`text-2xl font-bold ${parseFloat(strategy.avgPL) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {parseFloat(strategy.avgPL) > 0 ? '+' : ''}{strategy.avgPL}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{t('avgPLLabel')}</p>
                        </div>
                        </div>
                        <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <span className="text-sm text-slate-600 dark:text-slate-400">{t('totalPLLabel')}:</span>
                      <span className={`font-bold ${parseFloat(strategy.totalPL) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(strategy.totalPL) > 0 ? '+' : ''}{strategy.totalPL}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      <span className="text-sm text-slate-600 dark:text-slate-400">{t('trades')}:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{strategy.trades}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Detailed Strategy Analysis */}
            {selectedStrategy && (
              <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 shadow-2xl border-2 border-purple-300 dark:border-purple-700">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-2xl text-purple-900 dark:text-purple-300">
                      {t('detailedAnalysisSymbol')}: {selectedStrategy}
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedStrategy(null)}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {(() => {
                    const strategyTrades = filteredTrades.filter(t => {
                      const strategy = strategies.find(s => s.id === t.strategy_id);
                      return (strategy?.name || "Bez strategii") === selectedStrategy;
                    });
                    
                    // Account breakdown
                    const accountBreakdown = {};
                    strategyTrades.forEach(trade => {
                      const account = accounts.find(a => a.id === trade.account_id);
                      const accountName = account?.name || "Nieznane";
                      if (!accountBreakdown[accountName]) {
                        accountBreakdown[accountName] = { wins: 0, total: 0, pl: 0 };
                      }
                      accountBreakdown[accountName].total++;
                      if (trade.outcome === "Win") accountBreakdown[accountName].wins++;
                      accountBreakdown[accountName].pl += parseFloat(trade.profit_loss) || 0;
                    });

                    const accountBreakdownData = Object.entries(accountBreakdown).map(([name, stats]) => ({
                      name,
                      winRate: ((stats.wins / stats.total) * 100).toFixed(1),
                      pl: stats.pl.toFixed(2),
                      trades: stats.total
                    }));

                    // Symbol breakdown
                    const symbolBreakdown = {};
                    strategyTrades.forEach(trade => {
                      if (!symbolBreakdown[trade.symbol]) {
                        symbolBreakdown[trade.symbol] = { wins: 0, total: 0, pl: 0 };
                      }
                      symbolBreakdown[trade.symbol].total++;
                      if (trade.outcome === "Win") symbolBreakdown[trade.symbol].wins++;
                      symbolBreakdown[trade.symbol].pl += parseFloat(trade.profit_loss) || 0;
                    });

                    const symbolBreakdownData = Object.entries(symbolBreakdown).map(([symbol, stats]) => ({
                      symbol,
                      winRate: ((stats.wins / stats.total) * 100).toFixed(1),
                      pl: stats.pl.toFixed(2),
                      trades: stats.total
                    })).sort((a, b) => parseFloat(b.pl) - parseFloat(a.pl));

                    // Direction breakdown
                    const directionBreakdown = { Long: { wins: 0, total: 0, pl: 0 }, Short: { wins: 0, total: 0, pl: 0 } };
                    strategyTrades.forEach(trade => {
                      const direction = normalizeDirection(trade.direction);
                      if (directionBreakdown[direction]) {
                        directionBreakdown[direction].total++;
                        if (trade.outcome === "Win") directionBreakdown[direction].wins++;
                        directionBreakdown[direction].pl += parseFloat(trade.profit_loss) || 0;
                      }
                    });

                    const directionBreakdownData = Object.entries(directionBreakdown)
                      .filter(([_, stats]) => stats.total > 0)
                      .map(([dir, stats]) => ({
                        direction: dir,
                        winRate: ((stats.wins / stats.total) * 100).toFixed(1),
                        pl: stats.pl.toFixed(2),
                        trades: stats.total
                      }));

                    // Timeframe breakdown
                    const timeframeBreakdown = {};
                    strategyTrades.forEach(trade => {
                      if (trade.timeframe) {
                        if (!timeframeBreakdown[trade.timeframe]) {
                          timeframeBreakdown[trade.timeframe] = { wins: 0, total: 0, pl: 0 };
                        }
                        timeframeBreakdown[trade.timeframe].total++;
                        if (trade.outcome === "Win") timeframeBreakdown[trade.timeframe].wins++;
                        timeframeBreakdown[trade.timeframe].pl += parseFloat(trade.profit_loss) || 0;
                      }
                    });

                    const timeframeBreakdownData = Object.entries(timeframeBreakdown).map(([tf, stats]) => ({
                      timeframe: tf,
                      winRate: ((stats.wins / stats.total) * 100).toFixed(1),
                      pl: stats.pl.toFixed(2),
                      trades: stats.total
                    }));

                    // Best and worst trades
                    const sortedTrades = [...strategyTrades].sort((a, b) => 
                      (parseFloat(b.profit_loss) || 0) - (parseFloat(a.profit_loss) || 0)
                    );
                    const bestTrade = sortedTrades[0];
                    const worstTrade = sortedTrades[sortedTrades.length - 1];

                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Account Breakdown */}
                          <Card className="bg-white">
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Wallet className="w-4 h-4" />
                                Według kont
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {accountBreakdownData.map(item => (
                                  <div key={item.name} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                                    <div>
                                      <p className="font-semibold text-sm text-slate-900">{item.name}</p>
                                      <p className="text-xs text-slate-600">{item.trades} transakcji</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-sm text-blue-600">{item.winRate}%</p>
                                      <p className={`text-xs font-semibold ${parseFloat(item.pl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {parseFloat(item.pl) > 0 ? '+' : ''}{item.pl}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Symbol Breakdown */}
                          <Card className="bg-white dark:bg-slate-900">
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2 dark:text-white">
                                <TrendingUp className="w-4 h-4" />
                                {t('bySymbols')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                              {symbolBreakdownData.map(item => (
                               <div key={item.symbol} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                 <div>
                                   <p className="font-semibold text-sm text-slate-900 dark:text-white">{item.symbol}</p>
                                   <p className="text-xs text-slate-600 dark:text-slate-400">{item.trades} {t('trades')}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-sm text-blue-600 dark:text-blue-400">{item.winRate}%</p>
                                      <p className={`text-xs font-semibold ${parseFloat(item.pl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {parseFloat(item.pl) > 0 ? '+' : ''}{item.pl}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Direction Breakdown */}
                          <Card className="bg-white">
                            <CardHeader>
                              <CardTitle className="text-base">{t('longVsShort')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={directionBreakdownData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                  <XAxis dataKey="direction" stroke="#64748b" />
                                  <YAxis stroke="#64748b" />
                                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                                  <Legend />
                                  <Bar dataKey="winRate" fill="#3b82f6" name="Win Rate (%)" />
                                  <Bar dataKey="trades" fill="#10b981" name="Transakcje" />
                                </BarChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>

                          {/* Timeframe Breakdown */}
                          <Card className="bg-white">
                            <CardHeader>
                              <CardTitle className="text-base">Według timeframe</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={timeframeBreakdownData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                  <XAxis dataKey="timeframe" stroke="#64748b" />
                                  <YAxis stroke="#64748b" />
                                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                                  <Legend />
                                  <Bar dataKey="winRate" fill="#8b5cf6" name="Win Rate (%)" />
                                  <Bar dataKey="trades" fill="#f59e0b" name="Transakcje" />
                                </BarChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Best and Worst Trades */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {bestTrade && (
                            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border border-green-200 dark:border-green-800">
                              <CardHeader>
                                <CardTitle className="text-base text-green-900 dark:text-green-300 flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4" />
                                  {t('bestTradeSingle')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('date')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{bestTrade.date}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('symbol')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{bestTrade.symbol}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('direction')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{bestTrade.direction}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('profitLoss')}:</span>
                                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                    +{parseFloat(bestTrade.profit_loss).toFixed(2)}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {worstTrade && parseFloat(worstTrade.profit_loss) < 0 && (
                            <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 border border-red-200 dark:border-red-800">
                              <CardHeader>
                                <CardTitle className="text-base text-red-900 dark:text-red-300 flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  {t('worstTradeSingle')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('date')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{worstTrade.date}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('symbol')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{worstTrade.symbol}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('direction')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{worstTrade.direction}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-slate-600 dark:text-slate-400">{t('profitLoss')}:</span>
                                  <span className="text-lg font-bold text-red-600 dark:text-red-400">
                                    {parseFloat(worstTrade.profit_loss).toFixed(2)}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="space-y-6">
            {/* Account Type Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                <CardHeader>
                  <CardTitle className="dark:text-white">Rozkład typów kont</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Live', value: accounts.filter(a => a.account_type === 'Live').length, fill: '#10b981' },
                          { name: 'Demo', value: accounts.filter(a => a.account_type === 'Demo').length, fill: '#3b82f6' },
                          { name: 'Challenge', value: accounts.filter(a => a.account_type === 'Challenge').length, fill: '#8b5cf6' },
                          { name: 'Funded', value: accounts.filter(a => a.account_type === 'Funded').length, fill: '#f59e0b' }
                        ].filter(item => item.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {[
                          { name: 'Live', value: accounts.filter(a => a.account_type === 'Live').length, fill: '#10b981' },
                          { name: 'Demo', value: accounts.filter(a => a.account_type === 'Demo').length, fill: '#3b82f6' },
                          { name: 'Challenge', value: accounts.filter(a => a.account_type === 'Challenge').length, fill: '#8b5cf6' },
                          { name: 'Funded', value: accounts.filter(a => a.account_type === 'Funded').length, fill: '#f59e0b' }
                        ].filter(item => item.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                <CardHeader>
                  <CardTitle className="dark:text-white">Status kont</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { status: 'Aktywne', count: accounts.filter(a => a.status === 'Active').length, fill: '#10b981' },
                      { status: 'Nieaktywne', count: accounts.filter(a => a.status === 'Inactive').length, fill: '#64748b' },
                      { status: 'Zawieszone', count: accounts.filter(a => a.status === 'Suspended').length, fill: '#f59e0b' },
                      { status: 'Zamknięte', count: accounts.filter(a => a.status === 'Closed').length, fill: '#ef4444' }
                    ].filter(item => item.count > 0)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="status" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
              <CardHeader>
                <CardTitle className="dark:text-white">{t('accountsComparison')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={accountData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                    <Legend />
                    <Bar dataKey="winRate" fill="#3b82f6" name="Win Rate (%)" />
                    <Bar dataKey="roi" fill="#10b981" name={t('roi')} />
                    <Bar dataKey="trades" fill="#8b5cf6" name={t('noOfTrades')} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accountData.map((account) => (
                <Card key={account.name} className="bg-gradient-to-br from-white to-slate-50 dark:from-[#1a1a2e] dark:to-[#14141f] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 dark:text-white">
                      <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      {account.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-blue-100 dark:bg-blue-950 rounded-lg text-center">
                        <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{account.winRate}%</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Win Rate</p>
                      </div>
                      <div className="p-3 bg-green-100 dark:bg-green-950 rounded-lg text-center">
                        <p className={`text-xl font-bold ${parseFloat(account.roi) >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                          {parseFloat(account.roi) > 0 ? '+' : ''}{account.roi}%
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">ROI</p>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-slate-600 dark:text-slate-400">{t('totalPLLabel')}:</span>
                        <span className={`font-bold ${parseFloat(account.totalPL) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(account.totalPL) > 0 ? '+' : ''}{account.totalPL}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">{t('trades')}:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{account.trades}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Psychology Tab */}
          <TabsContent value="psychology" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                <CardHeader>
                  <CardTitle className="dark:text-white">{t('setupQuality')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={setupData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="quality" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                      <Legend />
                      <Bar dataKey="winRate" fill="#f59e0b" name="Win Rate (%)" />
                      <Bar dataKey="avgPL" fill="#10b981" name={t('avgPLLabel')} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                <CardHeader>
                  <CardTitle className="dark:text-white">{t('emotionalState')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={emotionalData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="state" stroke="#64748b" angle={-45} textAnchor="end" height={100} />
                      <YAxis stroke="#64748b" />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                      <Legend />
                      <Bar dataKey="winRate" fill="#ec4899" name="Win Rate (%)" />
                      <Bar dataKey="avgPL" fill="#8b5cf6" name={t('avgPLLabel')} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border border-amber-200 dark:border-amber-800 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-amber-900 dark:text-amber-300">{t('setupQualityDetails')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {setupData.map((item) => (
                    <div key={item.quality} className="flex justify-between items-center p-3 bg-white/70 dark:bg-slate-800/70 rounded-lg">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">{item.quality}</span>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{item.trades} {t('trades')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-blue-600 dark:text-blue-400">{item.winRate}%</p>
                        <p className={`text-xs ${parseFloat(item.avgPL) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {t('avg')}: {item.avgPL}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950 dark:to-purple-950 border border-pink-200 dark:border-pink-800 shadow-xl">
                <CardHeader>
                  <CardTitle className="text-purple-900 dark:text-purple-300">{t('emotionalAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {emotionalData.map((item) => (
                    <div key={item.state} className="flex justify-between items-center p-3 bg-white/70 dark:bg-slate-800/70 rounded-lg">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">{item.state}</span>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{item.trades} {t('trades')}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-blue-600 dark:text-blue-400">{item.winRate}%</p>
                        <p className={`text-xs ${parseFloat(item.avgPL) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {t('avg')}: {item.avgPL}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}