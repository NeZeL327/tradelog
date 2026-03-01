import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/lib/AuthContext';
import { getTrades, getTradingAccounts, getStrategies } from '@/lib/localStorage';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TrendingUp, TrendingDown, Target, Award, Calendar, BarChart3, Eye, ChevronDown, ChevronUp, Filter, CalendarDays, Wallet } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter } from "recharts";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday, subDays } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import TradeCard from "../components/TradeCard";
import TradeFormNew from "../components/TradeFormNew";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { directionLabel, isClosedTrade, normalizeDirection, tradeOutcomeChartColor, tradePnLBarColor, tradeStatusBadgeClass } from "@/lib/utils";

export default function Dashboard() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const dateLocale = language === "pl" ? pl : enUS;
  const dayLocale = language === "pl" ? "pl-PL" : "en-US";
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [editingTrade, setEditingTrade] = useState(null);
  const [expandedMetric, setExpandedMetric] = useState(null);
  const [plChartFilter, setPlChartFilter] = useState("all");
  const [plChartValue, setPlChartValue] = useState("all");
  const [accountBalanceAccount, setAccountBalanceAccount] = useState("all");
  const [accountBalanceFilterOpen, setAccountBalanceFilterOpen] = useState(false);
  const accountBalanceFilterRef = useRef(null);
  const [recentTradesAccountOpen, setRecentTradesAccountOpen] = useState(false);
  const recentTradesAccountRef = useRef(null);
  const [dashboardAccounts, setDashboardAccounts] = useState(["all"]);
  const [dashboardRanges, setDashboardRanges] = useState(["30d"]);
  const [rangeFilterOpen, setRangeFilterOpen] = useState(false);
  const rangeFilterRef = useRef(null);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const accountDropdownRef = useRef(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterSymbols, setFilterSymbols] = useState(["all"]);
  const [filterDirections, setFilterDirections] = useState(["all"]);
  const [filterOutcomes, setFilterOutcomes] = useState(["all"]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [yearSelectorOpen, setYearSelectorOpen] = useState(false);
  const yearSelectorRef = useRef(null);
  const [calendarAccountOpen, setCalendarAccountOpen] = useState(false);
  const calendarAccountRef = useRef(null);
  const { data: trades = [], isLoading, refetch } = useQuery({
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

  const handleViewTrade = (trade) => {
    if (!trade) return;
    const symbolTrades = trades.filter(t => t.symbol === trade.symbol && isClosedTrade(t));
    const wins = symbolTrades.filter(t => t.outcome === "Win").length;
    const total = symbolTrades.length;
    const totalPLForSymbol = symbolTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0);
    const avgPLForSymbol = total ? (totalPLForSymbol / total) : 0;

    const account = accounts.find(a => String(a.id) === String(trade.account_id));
    const strategy = strategies.find(s => String(s.id) === String(trade.strategy_id));

    setSelectedTrade({
      ...trade,
      accountName: account?.name || "",
      strategyName: strategy?.name || "",
      symbolStats: {
        total,
        wins,
        winRate: total ? ((wins / total) * 100).toFixed(1) : "0.0",
        totalPL: totalPLForSymbol.toFixed(2),
        avgPL: avgPLForSymbol.toFixed(2)
      }
    });
  };


  const uniqueSymbols = [...new Set(trades.map(t => t.symbol).filter(Boolean))];
  const uniqueDirections = [...new Set(trades.map(t => normalizeDirection(t.direction)).filter(Boolean))];
  const uniqueOutcomes = [...new Set(trades.map(t => t.outcome).filter(Boolean))];

  const toggleMultiFilter = (setter, value) => {
    setter((prev) => {
      if (value === "all") return ["all"];
      const normalizedValue = String(value);
      const withoutAll = prev.filter((item) => item !== "all");
      const exists = withoutAll.includes(normalizedValue);
      const next = exists
        ? withoutAll.filter((item) => item !== normalizedValue)
        : [...withoutAll, normalizedValue];
      return next.length ? next : ["all"];
    });
  };

  const buildFilterLabel = (values, allLabel, resolver) => {
    if (values.includes("all")) return allLabel;
    return values.map((value) => resolver(value)).filter(Boolean).join(", ");
  };

  const filterSymbolLabel = buildFilterLabel(filterSymbols, t('all'), (value) => value);
  const filterDirectionLabel = buildFilterLabel(filterDirections, t('all'), (value) => directionLabel(value, t));
  const filterOutcomeLabel = buildFilterLabel(filterOutcomes, t('all'), (value) => value);
  const dashboardAccountLabel = buildFilterLabel(
    dashboardAccounts,
    t('allAccounts'),
    (value) => accounts.find((account) => String(account.id) === String(value))?.name
  );
  const dashboardRangeLabel = buildFilterLabel(
    dashboardRanges,
    t('last30Days'),
    (value) => (value === '7d' ? t('last7Days') : value === '90d' ? t('last90Days') : t('last30Days'))
  );

  const toggleDashboardAccount = (value) => toggleMultiFilter(setDashboardAccounts, value);
  const toggleDashboardRange = (value) => {
    setDashboardRanges((prev) => {
      const normalizedValue = String(value);
      const exists = prev.includes(normalizedValue);
      const next = exists
        ? prev.filter((item) => item !== normalizedValue)
        : [...prev, normalizedValue];
      return next.length ? next : ["30d"];
    });
  };

  const rangeStartDate = (() => {
    const selectedDays = dashboardRanges.map((value) => {
      if (value === "7d") return 7;
      if (value === "90d") return 90;
      return 30;
    });
    const maxDays = Math.max(...selectedDays);
    const d = new Date();
    d.setDate(d.getDate() - maxDays);
    return d;
  })();

  const filteredTrades = trades.filter(t => {
    const tradeDate = t.date ? new Date(t.date) : null;
    const inRange = tradeDate ? tradeDate >= rangeStartDate : true;
    return (
      (dashboardAccounts.includes("all") || dashboardAccounts.includes(String(t.account_id))) &&
      (filterSymbols.includes("all") || filterSymbols.includes(String(t.symbol))) &&
      (filterDirections.includes("all") || filterDirections.includes(String(normalizeDirection(t.direction)))) &&
      (filterOutcomes.includes("all") || filterOutcomes.includes(String(t.outcome))) &&
      inRange
    );
  });

  const closedTrades = filteredTrades.filter(isClosedTrade);

  // Calculate metrics
  const totalTrades = closedTrades.length;
  const wins = closedTrades.filter(t => t.outcome === "Win").length;
  const losses = closedTrades.filter(t => t.outcome === "Loss").length;
  const breakeven = closedTrades.filter(t => t.outcome === "Breakeven").length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0;
  
  const totalPL = closedTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0);
  const avgPL = totalTrades > 0 ? (totalPL / totalTrades).toFixed(2) : 0;
  const avgWin = wins > 0 ? (closedTrades.filter(t => t.outcome === "Win").reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0) / wins).toFixed(2) : 0;
  const avgLoss = losses > 0 ? (closedTrades.filter(t => t.outcome === "Loss").reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0) / losses).toFixed(2) : 0;
  
  const profitFactor = (avgLoss !== 0 && avgWin !== 0) ? Math.abs(avgWin / avgLoss).toFixed(2) : 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const dayTrades = closedTrades.filter(t => t.date === todayStr);
  const dayWins = dayTrades.filter(t => t.outcome === "Win").length;
  const dayWinRate = dayTrades.length > 0 ? ((dayWins / dayTrades.length) * 100).toFixed(1) : 0;
  const avgWinLossRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss).toFixed(2) : 0;

  const plRing = Math.min((Math.abs(totalPL) / 1000) * 100, 100);
  const winRateRing = Math.min(parseFloat(winRate) || 0, 100);
  const pfRing = Math.min((parseFloat(profitFactor) || 0) / 3 * 100, 100);
  const dayWinRing = Math.min(parseFloat(dayWinRate) || 0, 100);
  const avgWinLossRing = Math.min((parseFloat(avgWinLossRatio) || 0) / 3 * 100, 100);

  const dailyPLByDate = {};
  closedTrades.forEach(t => {
    if (t.date) {
      dailyPLByDate[t.date] = (dailyPLByDate[t.date] || 0) + (parseFloat(t.profit_loss) || 0);
    }
  });
  const dailyPLData = Object.entries(dailyPLByDate)
    .map(([date, pl]) => ({ date, pl }))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-10);

  const recentTradesTable = [...closedTrades]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(calendarDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const tradesByDate = {};
  closedTrades.forEach(trade => {
    if (trade.date) {
      if (!tradesByDate[trade.date]) tradesByDate[trade.date] = [];
      tradesByDate[trade.date].push(trade);
    }
  });

  const zellaScore = (() => {
    const maxDrawdown = Math.abs(Math.min(...closedTrades.map(t => parseFloat(t.profit_loss) || 0), 0));
    const recovery = maxDrawdown > 0 ? totalPL / maxDrawdown : totalPL;
    const profitFactorScore = Math.min((parseFloat(profitFactor) || 0) * 10, 100);
    const winRateScore = Math.min(parseFloat(winRate) || 0, 100);
    const consistencyScore = Math.min((totalTrades / 50) * 100, 100);
    const avgWinLossScore = Math.min((parseFloat(avgWinLossRatio) || 0) * 20, 100);
    return {
      total: Math.round((profitFactorScore + winRateScore + consistencyScore + avgWinLossScore) / 4),
      metrics: [
        { subject: t('zellaWinRate'), value: winRateScore },
        { subject: t('zellaProfit'), value: profitFactorScore },
        { subject: t('zellaConsistency'), value: consistencyScore },
        { subject: t('zellaDrawdown'), value: Math.min(recovery * 25, 100) },
        { subject: t('zellaAvgWL'), value: avgWinLossScore },
      ],
    };
  })();

  const progressDays = (() => {
    const days = [];
    for (let i = 34; i >= 0; i--) {
      const day = subDays(new Date(), i);
      const dateStr = format(day, 'yyyy-MM-dd');
      const count = (tradesByDate[dateStr] || []).length;
      days.push({ date: dateStr, count });
    }
    return days;
  })();

  // Outcome distribution
  const outcomeData = [
    { name: t('wins'), value: wins, color: tradeOutcomeChartColor('Win') },
    { name: t('losses'), value: losses, color: tradeOutcomeChartColor('Loss') },
    { name: t('breakeven'), value: breakeven, color: tradeOutcomeChartColor('Breakeven') }
  ];

  // Strategy performance
  const strategyStats = {};
  closedTrades.forEach(trade => {
    if (trade.strategy) {
      if (!strategyStats[trade.strategy]) {
        strategyStats[trade.strategy] = { wins: 0, total: 0, pl: 0 };
      }
      strategyStats[trade.strategy].total++;
      if (trade.outcome === "Win") strategyStats[trade.strategy].wins++;
      strategyStats[trade.strategy].pl += parseFloat(trade.profit_loss) || 0;
    }
  });

  const strategyData = Object.entries(strategyStats).map(([name, stats]) => ({
    name,
    winRate: ((stats.wins / stats.total) * 100).toFixed(1),
    trades: stats.total,
    pl: stats.pl.toFixed(2)
  }));

  // P&L over time (last 10 trades) with filters
  const getFilteredTradesForChart = () => {
    if (plChartFilter === "all" || plChartValue === "all") return closedTrades;
    
    if (plChartFilter === "account") {
      return closedTrades.filter(t => t.account_id === plChartValue);
    } else if (plChartFilter === "strategy") {
      return closedTrades.filter(t => t.strategy_id === plChartValue);
    } else if (plChartFilter === "symbol") {
      return closedTrades.filter(t => t.symbol === plChartValue);
    } else if (plChartFilter === "direction") {
      return closedTrades.filter(t => normalizeDirection(t.direction) === plChartValue);
    } else if (plChartFilter === "outcome") {
      return closedTrades.filter(t => t.outcome === plChartValue);
    }
    
    return closedTrades;
  };

  const recentTrades = [...getFilteredTradesForChart()].reverse().slice(0, 20);
  let cumulativePL = 0;
  const plOverTime = [
    { trade: '#0', pl: 0, symbol: '', date: '' },
    ...recentTrades.map((trade, index) => {
      cumulativePL += parseFloat(trade.profit_loss) || 0;
      return {
        trade: `#${index + 1}`,
        pl: Math.round(cumulativePL * 100) / 100,
        symbol: trade.symbol,
        date: trade.date
      };
    })
  ];

  const accountBalanceTrades = accountBalanceAccount === "all"
    ? closedTrades
    : closedTrades.filter((trade) => String(trade.account_id) === String(accountBalanceAccount));

  const selectedAccountBalanceLabel = accountBalanceAccount === "all"
    ? t('allAccounts')
    : (accounts.find(acc => String(acc.id) === String(accountBalanceAccount))?.name || t('myAccount'));

  useEffect(() => {
    if (!accountBalanceFilterOpen) return;

    const handleOutsideClick = (event) => {
      if (accountBalanceFilterRef.current && !accountBalanceFilterRef.current.contains(event.target)) {
        setAccountBalanceFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [accountBalanceFilterOpen]);

  useEffect(() => {
    if (!rangeFilterOpen) return;

    const handleOutsideClick = (event) => {
      if (rangeFilterRef.current && !rangeFilterRef.current.contains(event.target)) {
        setRangeFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [rangeFilterOpen]);

  useEffect(() => {
    if (!accountDropdownOpen) return;

    const handleOutsideClick = (event) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
        setAccountDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [accountDropdownOpen]);

  useEffect(() => {
    if (!yearSelectorOpen) return;
    const handleOutsideClick = (event) => {
      if (yearSelectorRef.current && !yearSelectorRef.current.contains(event.target)) {
        setYearSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [yearSelectorOpen]);

  useEffect(() => {
    if (!calendarAccountOpen) return;

    const handleOutsideClick = (event) => {
      if (calendarAccountRef.current && !calendarAccountRef.current.contains(event.target)) {
        setCalendarAccountOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [calendarAccountOpen]);

  const handlePrevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  const handleMonthChange = (monthIndex) => {
    setCalendarDate(new Date(calendarDate.getFullYear(), monthIndex, 1));
  };

  let accountBalanceCum = 0;
  const accountBalanceOverTime = [
    { trade: '#0', pl: 0, symbol: '', date: '' },
    ...[...accountBalanceTrades].reverse().slice(0, 20).map((trade, index) => {
      accountBalanceCum += parseFloat(trade.profit_loss) || 0;
      return {
        trade: `#${index + 1}`,
        pl: Math.round(accountBalanceCum * 100) / 100,
        symbol: trade.symbol,
        date: trade.date
      };
    })
  ];

  // Daily cumulative P&L (grouped by date, sorted chronologically)
  const dailyCumulativeByDate = {};
  [...getFilteredTradesForChart()]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach(t => {
      if (t.date) {
        const dateKey = t.date.substring(0, 10);
        if (!dailyCumulativeByDate[dateKey]) dailyCumulativeByDate[dateKey] = 0;
        dailyCumulativeByDate[dateKey] += parseFloat(t.profit_loss) || 0;
      }
    });
  let dailyCum = 0;
  const dailyCumulativeData = [
    { date: '', pl: 0 },
    ...Object.entries(dailyCumulativeByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayPl]) => {
        dailyCum += dayPl;
        return { date: date.substring(5), pl: Math.round(dailyCum * 100) / 100 };
      })
  ];

  let running = 0;
  let peak = 0;
  const drawdownData = [...filteredTrades]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((trade, index) => {
      running += parseFloat(trade.profit_loss) || 0;
      peak = Math.max(peak, running);
      const drawdown = running - peak;
      return {
        trade: index + 1,
        drawdown: parseFloat(drawdown.toFixed(2)),
      };
    });

  const tradeTimeData = filteredTrades
    .filter(t => t.open_time || t.time)
    .map(t => {
      const time = t.open_time || t.time;
      const hour = time ? parseInt(time.split(":")[0], 10) : 0;
      return {
        hour,
        pl: parseFloat(t.profit_loss) || 0,
      };
    });

  const longTrades = trades.filter(t => normalizeDirection(t.direction) === "Long");
  const shortTrades = trades.filter(t => normalizeDirection(t.direction) === "Short");

  // Best and worst trades
  const sortedByPL = [...filteredTrades].sort((a, b) => (parseFloat(b.profit_loss) || 0) - (parseFloat(a.profit_loss) || 0));
  const bestTrade = sortedByPL[0];
  const worstTrade = sortedByPL[sortedByPL.length - 1];

  // Additional analytics for expandable sections
  const winningTrades = filteredTrades.filter(t => t.outcome === "Win");
  const losingTrades = filteredTrades.filter(t => t.outcome === "Loss");
  
  // P&L by day of week
  const dayPL = {};
  filteredTrades.forEach(t => {
    if (t.date) {
      const day = new Date(t.date).toLocaleDateString(dayLocale, { weekday: 'long' });
      if (!dayPL[day]) dayPL[day] = 0;
      dayPL[day] += parseFloat(t.profit_loss) || 0;
    }
  });
  
  // P&L by symbol
  const symbolPL = {};
  trades.forEach(t => {
    if (!symbolPL[t.symbol]) symbolPL[t.symbol] = { pl: 0, wins: 0, total: 0 };
    symbolPL[t.symbol].pl += parseFloat(t.profit_loss) || 0;
    symbolPL[t.symbol].total++;
    if (t.outcome === "Win") symbolPL[t.symbol].wins++;
  });
  
  // Win streaks
  let currentStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let currentLossStreak = 0;
  [...trades].reverse().forEach(t => {
    if (t.outcome === "Win") {
      currentStreak++;
      currentLossStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, currentStreak);
    } else if (t.outcome === "Loss") {
      currentLossStreak++;
      currentStreak = 0;
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-[#0f0f16] dark:via-[#14141f] dark:to-[#1a1a2e] dashboard-surface">
      <div className="w-full mx-auto space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white bordo:text-[#f9d5e5] mb-2">{t('dashboard')}</h1>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 bordo:text-[#d4a5b8]">{t('overviewOfYourTradingPerformance')}</p>
            </div>
            <div className="flex items-center gap-3 md:gap-4 flex-wrap justify-end">
              <div className="relative" ref={accountDropdownRef}>
                <button
                  onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                  className="relative h-9 md:h-10 w-[170px] md:w-[210px] px-3 rounded-md border border-input bg-transparent text-sm flex items-center justify-center hover:bg-accent shrink-0"
                >
                  <Wallet className="absolute left-3 w-4 h-4 text-slate-500" />
                  <span className="truncate text-center w-full px-6">{dashboardAccountLabel || t('allAccounts')}</span>
                  <ChevronDown className="absolute right-3 w-4 h-4 opacity-50" />
                </button>
                {accountDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border bg-popover p-1 shadow-md max-h-64 overflow-y-auto">
                    <button
                      onClick={() => { toggleDashboardAccount('all'); }}
                      className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${dashboardAccounts.includes('all') ? 'bg-accent' : ''}`}
                    >
                      <span className="truncate">{t('allAccounts')}</span>
                      <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${dashboardAccounts.includes('all') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                        {dashboardAccounts.includes('all') && (
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </button>
                    {accounts.map(acc => (
                      (() => {
                        const isSelected = dashboardAccounts.includes(String(acc.id));
                        return (
                      <button
                        key={acc.id}
                        onClick={() => { toggleDashboardAccount(acc.id); }}
                        className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? 'bg-accent' : ''}`}
                      >
                        <span className="truncate">{acc.name}</span>
                        <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                          {isSelected && (
                            <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                      </button>
                        );
                      })()
                    ))}
                  </div>
                )}
              </div>
              <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 md:h-10 px-3 md:px-4 gap-2 text-sm shrink-0">
                    <Filter className="w-4 h-4" />
                    {t('filters')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" side="bottom" className="w-[320px] sm:w-[420px] p-4">
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-2">{t('symbol')}</div>
                      <button
                        type="button"
                        className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm text-left"
                      >
                        <span className="truncate block">{filterSymbolLabel || t('all')}</span>
                      </button>
                      <div className="mt-2 rounded-md border bg-popover p-1 max-h-40 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => toggleMultiFilter(setFilterSymbols, 'all')}
                          className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${filterSymbols.includes('all') ? 'bg-accent' : ''}`}
                        >
                          <span>{t('all')}</span>
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${filterSymbols.includes('all') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                            {filterSymbols.includes('all') && (
                              <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                        </button>
                        {uniqueSymbols.map((sym) => {
                          const isSelected = filterSymbols.includes(String(sym));
                          return (
                            <button
                              key={sym}
                              type="button"
                              onClick={() => toggleMultiFilter(setFilterSymbols, sym)}
                              className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? 'bg-accent' : ''}`}
                            >
                              <span>{sym}</span>
                              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                                {isSelected && (
                                  <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-2">{t('direction')}</div>
                      <button
                        type="button"
                        className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm text-left"
                      >
                        <span className="truncate block">{filterDirectionLabel || t('all')}</span>
                      </button>
                      <div className="mt-2 rounded-md border bg-popover p-1 max-h-40 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => toggleMultiFilter(setFilterDirections, 'all')}
                          className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${filterDirections.includes('all') ? 'bg-accent' : ''}`}
                        >
                          <span>{t('all')}</span>
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${filterDirections.includes('all') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                            {filterDirections.includes('all') && (
                              <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                        </button>
                        {uniqueDirections.map((dir) => {
                          const isSelected = filterDirections.includes(String(dir));
                          return (
                            <button
                              key={dir}
                              type="button"
                              onClick={() => toggleMultiFilter(setFilterDirections, dir)}
                              className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? 'bg-accent' : ''}`}
                            >
                              <span>{directionLabel(dir, t)}</span>
                              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                                {isSelected && (
                                  <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-2">{t('outcome')}</div>
                      <button
                        type="button"
                        className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm text-left"
                      >
                        <span className="truncate block">{filterOutcomeLabel || t('all')}</span>
                      </button>
                      <div className="mt-2 rounded-md border bg-popover p-1 max-h-40 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => toggleMultiFilter(setFilterOutcomes, 'all')}
                          className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${filterOutcomes.includes('all') ? 'bg-accent' : ''}`}
                        >
                          <span>{t('all')}</span>
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${filterOutcomes.includes('all') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                            {filterOutcomes.includes('all') && (
                              <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                        </button>
                        {uniqueOutcomes.map((out) => {
                          const isSelected = filterOutcomes.includes(String(out));
                          return (
                            <button
                              key={out}
                              type="button"
                              onClick={() => toggleMultiFilter(setFilterOutcomes, out)}
                              className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? 'bg-accent' : ''}`}
                            >
                              <span>{out}</span>
                              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                                {isSelected && (
                                  <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => {
                        setFilterSymbols(["all"]);
                        setFilterDirections(["all"]);
                        setFilterOutcomes(["all"]);
                      }}>{t('reset')}</Button>
                      <Button onClick={() => setFiltersOpen(false)}>{t('apply')}</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <div className="relative" ref={rangeFilterRef}>
                <button
                  onClick={() => setRangeFilterOpen(!rangeFilterOpen)}
                  className="relative h-9 md:h-10 w-[170px] md:w-[210px] px-3 rounded-md border border-input bg-transparent text-sm flex items-center justify-center hover:bg-accent shrink-0"
                >
                  <CalendarDays className="absolute left-3 w-4 h-4 text-slate-500" />
                  <span className="truncate text-center w-full px-6">{dashboardRangeLabel || t('last30Days')}</span>
                  <ChevronDown className="absolute right-3 w-4 h-4 opacity-50" />
                </button>
                {rangeFilterOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border bg-popover p-1 shadow-md">
                    <button
                      onClick={() => { toggleDashboardRange('7d'); }}
                      className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${dashboardRanges.includes('7d') ? 'bg-accent' : ''}`}
                    >
                      <span>{t('last7Days')}</span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${dashboardRanges.includes('7d') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                        {dashboardRanges.includes('7d') && (
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </button>
                    <button
                      onClick={() => { toggleDashboardRange('30d'); }}
                      className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${dashboardRanges.includes('30d') ? 'bg-accent' : ''}`}
                    >
                      <span>{t('last30Days')}</span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${dashboardRanges.includes('30d') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                        {dashboardRanges.includes('30d') && (
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </button>
                    <button
                      onClick={() => { toggleDashboardRange('90d'); }}
                      className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${dashboardRanges.includes('90d') ? 'bg-accent' : ''}`}
                    >
                      <span>{t('last90Days')}</span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${dashboardRanges.includes('90d') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                        {dashboardRanges.includes('90d') && (
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          <Card
            className="ocean-stat-card cursor-pointer hover:shadow-lg transition-all"
            onClick={() => setExpandedMetric(expandedMetric === 'pl' ? null : 'pl')}
          >
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center justify-between gap-2 md:gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-500 truncate">{t('totalPL')}</p>
                  <div className={`mt-1.5 text-xl md:text-2xl font-bold ${totalPL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {totalPL >= 0 ? '+' : ''}{totalPL.toFixed(2)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 truncate">{t('from')} {totalTrades} {t('trades')}</p>
                </div>
                <div className="ocean-ring flex-shrink-0" style={{ background: `conic-gradient(${totalPL >= 0 ? '#22c55e' : '#f43f5e'} ${plRing}%, #e5e7eb 0)` }} />
              </div>
            </CardContent>
          </Card>

          <Card
            className="ocean-stat-card cursor-pointer hover:shadow-lg transition-all"
            onClick={() => setExpandedMetric(expandedMetric === 'winrate' ? null : 'winrate')}
          >
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center justify-between gap-2 md:gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-500 truncate">{t('winRate')}</p>
                  <div className="mt-1.5 text-xl md:text-2xl font-bold text-slate-900 dark:text-white">{winRate}%</div>
                  <p className="text-xs text-slate-500 mt-1 truncate">{wins} {t('wins')} / {totalTrades} {t('trades')}</p>
                </div>
                <div className="ocean-ring flex-shrink-0" style={{ background: `conic-gradient(#6d4dff ${winRateRing}%, #e5e7eb 0)` }} />
              </div>
            </CardContent>
          </Card>

          <Card
            className="ocean-stat-card cursor-pointer hover:shadow-lg transition-all"
            onClick={() => setExpandedMetric(expandedMetric === 'pf' ? null : 'pf')}
          >
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center justify-between gap-2 md:gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-500 truncate">{t('profitFactor')}</p>
                  <div className="mt-1.5 text-xl md:text-2xl font-bold text-slate-900 dark:text-white">{profitFactor}</div>
                  <p className="text-xs text-slate-500 mt-1 truncate">{t('avgWinAvgLoss')}</p>
                </div>
                <div className="ocean-ring flex-shrink-0" style={{ background: `conic-gradient(#34d399 ${pfRing}%, #e5e7eb 0)` }} />
              </div>
            </CardContent>
          </Card>

          <Card className="ocean-stat-card hover:shadow-lg transition-all">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center justify-between gap-2 md:gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-500 truncate">{t('dayWinRate')}</p>
                  <div className="mt-1.5 text-xl md:text-2xl font-bold text-slate-900 dark:text-white">{dayWinRate}%</div>
                  <p className="text-xs text-slate-500 mt-1 truncate">{dayWins}/{dayTrades.length} {t('trades')}</p>
                </div>
                <div className="ocean-ring flex-shrink-0" style={{ background: `conic-gradient(#60a5fa ${dayWinRing}%, #e5e7eb 0)` }} />
              </div>
            </CardContent>
          </Card>

          <Card className="ocean-stat-card hover:shadow-lg transition-all">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center justify-between gap-2 md:gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-500 truncate">{t('avgWinAvgLoss')}</p>
                  <div className="mt-1.5 text-xl md:text-2xl font-bold text-slate-900 dark:text-white">{avgWinLossRatio}</div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs flex-wrap">
                    <span className="rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-200 px-2 py-0.5 whitespace-nowrap text-[10px] md:text-xs">+{avgWin}</span>
                    <span className="rounded-full bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-200 px-2 py-0.5 whitespace-nowrap text-[10px] md:text-xs">{avgLoss}</span>
                  </div>
                </div>
                <div className="ocean-ring flex-shrink-0" style={{ background: `conic-gradient(#a78bfa ${avgWinLossRing}%, #e5e7eb 0)` }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <Card className="bg-white dark:bg-slate-800 shadow-xl border border-slate-200/60 dark:border-slate-700 rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-slate-900 dark:text-white text-sm md:text-base">{t('tradingScore') || 'Trading Score'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24 flex-shrink-0">
                  <svg viewBox="0 0 120 120" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="9" className="dark:!stroke-slate-700" style={{ stroke: 'var(--score-track, #e2e8f0)' }} />
                    <circle cx="60" cy="60" r="52" fill="none" strokeWidth="9" strokeLinecap="round"
                      style={{
                        stroke: zellaScore.total >= 80 ? '#22c55e' : zellaScore.total >= 60 ? '#3b82f6' : zellaScore.total >= 40 ? '#f59e0b' : '#f43f5e',
                        strokeDasharray: `${zellaScore.total * 3.267} 326.7`,
                        transition: 'stroke-dasharray 0.8s ease'
                      }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{zellaScore.total}</span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400">/ 100</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {zellaScore.metrics.map((metric, i) => {
                    const colors = ['#6d4dff', '#22c55e', '#3b82f6', '#f59e0b', '#ec4899'];
                    return (
                      <div key={metric.subject}>
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-slate-600 dark:text-slate-400">{metric.subject}</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{Math.round(metric.value)}</span>
                        </div>
                        <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                          <div className="h-1 rounded-full" style={{ width: `${metric.value}%`, backgroundColor: colors[i], transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 shadow-xl border border-slate-200/60 dark:border-slate-700 rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-slate-900 dark:text-white text-sm md:text-base">{t('progressTracker')}</CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate('/ProgressTracker')} className="text-xs">{t('view')}</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {progressDays.map((day) => (
                  <div
                    key={day.date}
                    className={`progress-square ${day.count === 0 ? 'progress-0' : day.count === 1 ? 'progress-1' : day.count === 2 ? 'progress-2' : 'progress-3'}`}
                    title={`${day.date} • ${day.count} ${t('trades')}`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-4 gap-2">
                <span className="flex-shrink-0">{t('less')}</span>
                <div className="flex items-center gap-1 flex-1 justify-center">
                  <span className="progress-0 progress-legend" />
                  <span className="progress-1 progress-legend" />
                  <span className="progress-2 progress-legend" />
                  <span className="progress-3 progress-legend" />
                </div>
                <span className="flex-shrink-0">{t('more')}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 shadow-xl border border-slate-200/60 dark:border-slate-700 rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-900 dark:text-white text-sm md:text-base">{t('dailyNetCumulativePL')}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden p-3">
              <div className="w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dailyCumulativeData} margin={{ top: 10, right: 20, left: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="plCumFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6d4dff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6d4dff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" width={55} domain={[(dataMin) => Math.floor(dataMin - Math.abs(dataMin * 0.1 || 10)), (dataMax) => Math.ceil(dataMax + Math.abs(dataMax * 0.1 || 10))]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                      itemStyle={{ color: '#e2e8f0' }}
                      labelStyle={{ color: '#f1f5f9' }}
                    />
                    <Area type="monotone" dataKey="pl" stroke="#6d4dff" fill="url(#plCumFill)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-white dark:bg-slate-800 shadow-xl border border-slate-200/60 dark:border-slate-700 rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-slate-900 dark:text-white">{t('netDailyPL')}</CardTitle>
              <div className="relative" ref={rangeFilterRef}>
                <Button
                  variant="outline"
                  className="relative w-24 md:w-28 justify-center text-xs md:text-sm h-9"
                  onClick={() => setRangeFilterOpen((prev) => !prev)}
                >
                  <span className="truncate text-center w-full pr-4">
                    {dashboardRangeLabel || '30 dni'}
                  </span>
                  <ChevronDown className="absolute right-2 w-4 h-4 opacity-70" />
                </Button>
                {rangeFilterOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                    <Button
                      variant="ghost"
                      className={`w-full justify-between text-xs ${dashboardRanges.includes('7d') ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                      onClick={() => {
                        toggleDashboardRange('7d');
                      }}
                    >
                      <span>7 dni</span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${dashboardRanges.includes('7d') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                        {dashboardRanges.includes('7d') && (
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      className={`w-full justify-between text-xs ${dashboardRanges.includes('30d') ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                      onClick={() => {
                        toggleDashboardRange('30d');
                      }}
                    >
                      <span>30 dni</span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${dashboardRanges.includes('30d') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                        {dashboardRanges.includes('30d') && (
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      className={`w-full justify-between text-xs ${dashboardRanges.includes('90d') ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                      onClick={() => {
                        toggleDashboardRange('90d');
                      }}
                    >
                      <span>90 dni</span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${dashboardRanges.includes('90d') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                        {dashboardRanges.includes('90d') && (
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden p-3">
              <div className="w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dailyPLData} barSize={20} margin={{ top: 10, right: 25, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" tickFormatter={(v) => v.slice(5)} />
                    <YAxis stroke="#64748b" width={55} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                      itemStyle={{ color: '#e2e8f0' }}
                      labelStyle={{ color: '#f1f5f9' }}
                    />
                    <Bar dataKey="pl" radius={[8, 8, 0, 0]}>
                      {dailyPLData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={tradePnLBarColor(entry.pl)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 shadow-xl border border-slate-200/60 dark:border-slate-700 rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-slate-900 dark:text-white text-sm">{t('recentTrades')}</CardTitle>
              <div className="relative" ref={recentTradesAccountRef}>
                <Button
                  variant="outline"
                  className="relative w-44 text-xs h-8 px-2 justify-center"
                  onClick={() => setRecentTradesAccountOpen((prev) => !prev)}
                >
                  <span className="truncate text-center w-full pr-4">{dashboardAccountLabel || t('allAccounts')}</span>
                  <ChevronDown className="absolute right-2 w-3 h-3 opacity-70" />
                </Button>
                {recentTradesAccountOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                    <Button
                      variant="ghost"
                      className={`w-full justify-between text-xs ${dashboardAccounts.includes('all') ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                      onClick={() => {
                        toggleDashboardAccount('all');
                      }}
                    >
                      <span className="truncate">{t('allAccounts')}</span>
                      <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${dashboardAccounts.includes('all') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                        {dashboardAccounts.includes('all') && (
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </Button>
                    {accounts.map((acc) => {
                      const isActive = dashboardAccounts.includes(String(acc.id));
                      return (
                        <Button
                          key={acc.id}
                          variant="ghost"
                          className={`w-full justify-between text-xs ${isActive ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                          onClick={() => {
                            toggleDashboardAccount(String(acc.id));
                          }}
                        >
                          <span className="truncate">{acc.name}</span>
                          <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${isActive ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                            {isActive && (
                              <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{t('date')}</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{t('symbol')}</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{t('statusLabel')}</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{t('netPL')}</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTradesTable.map(trade => (
                      <tr key={trade.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                        <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-400">{trade.date || '-'}</td>
                        <td className="px-3 py-2 text-xs font-medium text-slate-900 dark:text-white">{trade.symbol || '-'}</td>
                        <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-400">
                          <Badge className={`${tradeStatusBadgeClass(trade.status)} text-[11px] px-2 py-0.5`}>
                            {trade.status || '-'}
                          </Badge>
                        </td>
                        <td className={`px-3 py-2 text-xs font-semibold text-right ${parseFloat(trade.profit_loss || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {trade.status === 'Planned' || trade.profit_loss == null
                            ? '-'
                            : `${parseFloat(trade.profit_loss || 0) >= 0 ? '+' : ''}${parseFloat(trade.profit_loss || 0).toFixed(2)}`}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleViewTrade(trade)}
                              className="h-7 w-7 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                              title={t('viewDetails') || 'View Details'}
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 shadow-xl border border-slate-200/60 dark:border-slate-700 rounded-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-slate-900 dark:text-white">{t('accountBalance')}</CardTitle>
                <div className="relative" ref={accountBalanceFilterRef}>
                  <Button
                    variant="outline"
                    className="relative w-40 md:w-48 justify-center text-xs md:text-sm h-9"
                    onClick={() => setAccountBalanceFilterOpen((prev) => !prev)}
                  >
                    <span className="truncate text-center w-full pr-4">{selectedAccountBalanceLabel}</span>
                    <ChevronDown className="absolute right-2 w-4 h-4 opacity-70" />
                  </Button>
                  {accountBalanceFilterOpen && (
                    <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                      <Button
                        variant="ghost"
                        className={`w-full justify-between text-xs md:text-sm ${accountBalanceAccount === 'all' ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                        onClick={() => {
                          setAccountBalanceAccount('all');
                          setAccountBalanceFilterOpen(false);
                        }}
                      >
                        <span className="truncate">{t('allAccounts')}</span>
                        <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${accountBalanceAccount === 'all' ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                          {accountBalanceAccount === 'all' && (
                            <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                      </Button>
                      {accounts.map((acc) => {
                        const isActive = String(accountBalanceAccount) === String(acc.id);
                        return (
                          <Button
                            key={acc.id}
                            variant="ghost"
                            className={`w-full justify-between text-xs md:text-sm ${isActive ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                            onClick={() => {
                              setAccountBalanceAccount(String(acc.id));
                              setAccountBalanceFilterOpen(false);
                            }}
                          >
                            <span className="truncate">{acc.name}</span>
                            <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${isActive ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                              {isActive && (
                                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden p-3">
              <div className="w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={accountBalanceOverTime} margin={{ top: 10, right: 25, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="trade" stroke="#64748b" />
                    <YAxis stroke="#64748b" width={55} domain={[(dataMin) => Math.floor(dataMin - Math.abs(dataMin * 0.1 || 10)), (dataMax) => Math.ceil(dataMax + Math.abs(dataMax * 0.1 || 10))]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                      itemStyle={{ color: '#e2e8f0' }}
                      labelStyle={{ color: '#f1f5f9' }}
                    />
                    <Line type="monotone" dataKey="pl" stroke="#6d4dff" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <Card className="bg-white dark:bg-slate-900 shadow-xl border border-slate-200/60 dark:border-slate-700 lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-slate-900 dark:text-white text-sm md:text-base">
                    {(() => {
                      const monthYearLabel = format(calendarDate, 'LLLL yyyy', { locale: dateLocale });
                      return monthYearLabel.charAt(0).toUpperCase() + monthYearLabel.slice(1);
                    })()}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={handlePrevMonth} className="h-8 w-8 p-0">
                      <ChevronUp className="w-4 h-4" style={{ transform: 'rotate(90deg)' }} />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCalendarDate(new Date())} className="h-8 px-2 text-xs">
                      {t('today')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleNextMonth} className="h-8 w-8 p-0">
                      <ChevronDown className="w-4 h-4" style={{ transform: 'rotate(-90deg)' }} />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('account')}:</span>
                    <div className="relative" ref={calendarAccountRef}>
                      <Button
                        variant="outline"
                        className="relative w-44 md:w-48 text-xs h-8 px-2 justify-center"
                        onClick={() => setCalendarAccountOpen((prev) => !prev)}
                      >
                        <span className="truncate text-center w-full">
                          {dashboardAccountLabel || t('allAccounts')}
                        </span>
                        <ChevronDown className="absolute right-2 w-3 h-3 opacity-70" />
                      </Button>
                      {calendarAccountOpen && (
                        <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                          <Button
                            variant="ghost"
                            className={`w-full justify-between text-xs ${dashboardAccounts.includes('all') ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                            onClick={() => {
                              toggleDashboardAccount('all');
                            }}
                          >
                            <span className="truncate">{t('allAccounts')}</span>
                            <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${dashboardAccounts.includes('all') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                              {dashboardAccounts.includes('all') && (
                                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </span>
                          </Button>
                          {accounts.map((acc) => {
                            const isActive = dashboardAccounts.includes(String(acc.id));
                            return (
                              <Button
                                key={acc.id}
                                variant="ghost"
                                className={`w-full justify-between text-xs ${isActive ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                                onClick={() => {
                                  toggleDashboardAccount(String(acc.id));
                                }}
                              >
                                <span className="truncate">{acc.name}</span>
                                <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${isActive ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800/50'}`}>
                                  {isActive && (
                                    <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </span>
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('year')}:</span>
                    <div className="relative" ref={yearSelectorRef}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={() => setYearSelectorOpen(!yearSelectorOpen)}
                      >
                        {calendarDate.getFullYear()}
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </Button>
                      {yearSelectorOpen && (
                        <div className="absolute left-0 top-full mt-1 z-50 bg-white border rounded-md shadow-lg p-1">
                          {[calendarDate.getFullYear() - 2, calendarDate.getFullYear() - 1, calendarDate.getFullYear(), calendarDate.getFullYear() + 1, calendarDate.getFullYear() + 2].map(year => (
                            <button
                              key={year}
                              onClick={() => {
                                setCalendarDate(new Date(year, calendarDate.getMonth(), 1));
                                setYearSelectorOpen(false);
                              }}
                              className={`w-full px-3 py-1 text-sm text-left hover:bg-accent ${calendarDate.getFullYear() === year ? 'bg-accent font-semibold' : ''}`}
                            >
                              {year}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <div className="mb-3 grid grid-cols-12 gap-1">
                    {[...Array(12)].map((_, i) => {
                      const monthDate = new Date(calendarDate.getFullYear(), i, 1);
                      const monthName = format(monthDate, 'MMM', { locale: dateLocale });
                      const isCurrentMonth = i === calendarDate.getMonth();
                      return (
                        <button
                          key={i}
                          onClick={() => handleMonthChange(i)}
                          className={`text-center text-xs py-1.5 rounded font-medium transition-colors ${
                            isCurrentMonth
                              ? 'bg-slate-900 dark:bg-slate-700 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {monthName}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {[t('monday'), t('tuesday'), t('wednesday'), t('thursday'), t('friday'), t('saturday'), t('sunday')].map(day => (
                      <div key={day} className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400">{day}</div>
                    ))}
                    {calendarDays.map((day, index) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const dayTrades = tradesByDate[dateStr] || [];
                      const isCurrentMonth = isSameMonth(day, calendarDate);
                      const isTodayDay = isToday(day);
                      const totalPLDay = dayTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0);
                      const isSelected = selectedCalendarDate && format(selectedCalendarDate, 'yyyy-MM-dd') === dateStr;
                      return (
                        <button
                          key={index}
                          onClick={() => setSelectedCalendarDate(day)}
                          className={`mini-calendar-day ${!isCurrentMonth ? 'mini-calendar-outside' : ''} ${isTodayDay ? 'mini-calendar-today' : ''} ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}
                        >
                          <div className="text-xs font-medium">{format(day, 'd')}</div>
                          {dayTrades.length > 0 && (
                            <div className={`mt-1 text-[10px] font-semibold ${totalPLDay >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {totalPLDay >= 0 ? '+' : ''}{totalPLDay.toFixed(0)}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">{selectedCalendarDate ? format(selectedCalendarDate, 'PPP', { locale: dateLocale }) : t('selectDay')}</div>
                  <div className="space-y-2 max-h-72 overflow-auto">
                    {(selectedCalendarDate ? tradesByDate[format(selectedCalendarDate, 'yyyy-MM-dd')] || [] : []).map(trade => (
                      <div key={trade.id} className="bg-slate-900 border border-slate-700 rounded-lg p-2">
                        <div className="flex items-center justify-between gap-2 min-h-10">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-800 dark:text-white truncate text-sm">{trade.symbol}</div>
                            <div className="text-[11px] leading-none mt-1 text-slate-500 dark:text-slate-400">{trade.open_time || trade.time || '--:--'}</div>
                          </div>
                          <div className="flex items-center self-center gap-2.5 shrink-0">
                            <span className={`inline-block min-w-[90px] text-right tabular-nums leading-none font-semibold text-sm ${parseFloat(trade.profit_loss || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {parseFloat(trade.profit_loss || 0) >= 0 ? '+' : ''}{parseFloat(trade.profit_loss || 0).toFixed(2)}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => handleViewTrade(trade)}
                              className="h-6 w-6 p-0 self-center text-blue-400 hover:text-blue-300 hover:bg-slate-800"
                              aria-label="Podgląd transakcji"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!selectedCalendarDate || (tradesByDate[format(selectedCalendarDate, 'yyyy-MM-dd')] || []).length === 0) && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">{t('noTradesThisDay')}</div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="bg-white shadow-xl border border-slate-200/60">
              <CardHeader>
                <CardTitle className="text-slate-900">{t('drawdown')}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden p-3">
                <div className="w-full overflow-hidden">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={drawdownData} margin={{ top: 10, right: 25, left: 10, bottom: 10 }}>
                      <defs>
                        <clipPath id="drawdown-clip">
                          <rect x="0" y="0" width="100%" height="100%" />
                        </clipPath>
                        <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="trade" stroke="#64748b" />
                      <YAxis stroke="#64748b" width={55} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                        itemStyle={{ color: '#e2e8f0' }}
                        labelStyle={{ color: '#f1f5f9' }}
                      />
                      <Area type="monotone" dataKey="drawdown" stroke="#f43f5e" fill="url(#ddFill)" strokeWidth={2} dot={false} clipPath="url(#drawdown-clip)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white shadow-xl border border-slate-200/60">
              <CardHeader>
                <CardTitle className="text-slate-900">{t('tradeTimePerformance')}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden p-3">
                <div className="w-full overflow-hidden">
                  <ResponsiveContainer width="100%" height={220}>
                    <ScatterChart margin={{ top: 10, right: 25, left: 10, bottom: 10 }}>
                      <defs>
                        <clipPath id="scatter-clip">
                          <rect x="0" y="0" width="100%" height="100%" />
                        </clipPath>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="hour" stroke="#64748b" domain={[0, 23]} ticks={[0,4,8,12,16,20,23]} />
                      <YAxis dataKey="pl" stroke="#64748b" width={55} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                        itemStyle={{ color: '#e2e8f0' }}
                        labelStyle={{ color: '#f1f5f9' }}
                      />
                      <Scatter data={tradeTimeData} fill="#6d4dff" clipPath="url(#scatter-clip)">
                        {tradeTimeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={tradePnLBarColor(entry.pl)} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Expanded Metric Details */}
        <AnimatePresence>
          {expandedMetric === 'pl' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Card className="bg-white dark:bg-slate-800 bordo:bg-[#1f1018] shadow-xl border border-blue-200 dark:border-slate-700 bordo:border-[#8b2347]">
                <CardHeader>
                  <CardTitle className="text-blue-700 dark:text-blue-400 bordo:text-[#d97597]">{t('detailedPLAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <p className="text-xs text-green-700 mb-1">{t('totalProfit')}</p>
                      <p className="text-xl font-bold text-green-600">+{winningTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0).toFixed(2)}</p>
                      <p className="text-xs text-green-600 mt-1">{winningTrades.length} {t('wins')}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                      <p className="text-xs text-red-700 mb-1">{t('totalLoss')}</p>
                      <p className="text-xl font-bold text-red-600">{losingTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0).toFixed(2)}</p>
                      <p className="text-xs text-red-600 mt-1">{losingTrades.length} {t('losses')}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-700 mb-1">{t('plByWeekday')}</p>
                      <div className="space-y-1 mt-2">
                        {Object.entries(dayPL).map(([day, pl]) => (
                          <div key={day} className="flex justify-between text-xs">
                            <span className="text-slate-600">{day.slice(0, 3)}</span>
                            <span className={pl >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                              {pl >= 0 ? '+' : ''}{pl.toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-700 mb-2 font-semibold">{t('plBySymbol')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(symbolPL).map(([symbol, data]) => (
                        <div key={symbol} className="bg-white p-2 rounded border border-slate-200">
                          <p className="text-xs font-semibold text-slate-900">{symbol}</p>
                          <p className={`text-sm font-bold ${data.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {data.pl >= 0 ? '+' : ''}{data.pl.toFixed(0)}
                          </p>
                          <p className="text-[10px] text-slate-500">{data.wins}/{data.total} ({((data.wins/data.total)*100).toFixed(0)}%)</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {expandedMetric === 'winrate' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Card className="bg-white dark:bg-slate-800 bordo:bg-[#1f1018] shadow-xl border border-blue-200 dark:border-slate-700 bordo:border-[#8b2347]">
                <CardHeader>
                  <CardTitle className="text-blue-700 dark:text-blue-400 bordo:text-[#d97597]">{t('detailedWinRateAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <p className="text-xs text-green-700 mb-1">{t('wins')}</p>
                      <p className="text-2xl font-bold text-green-600">{wins}</p>
                      <p className="text-xs text-green-600 mt-1">{winRate}% {t('ofAll')}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                      <p className="text-xs text-red-700 mb-1">{t('losses')}</p>
                      <p className="text-2xl font-bold text-red-600">{losses}</p>
                      <p className="text-xs text-red-600 mt-1">{(100 - winRate).toFixed(1)}% {t('ofAll')}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                      <p className="text-xs text-purple-700 mb-1">{t('streaks')}</p>
                      <div className="space-y-1">
                        <p className="text-sm text-green-600 font-semibold">{t('maxWins')}: {maxWinStreak}</p>
                        <p className="text-sm text-red-600 font-semibold">{t('maxLosses')}: {maxLossStreak}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-700 mb-2 font-semibold">{t('winRateBySymbol')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(symbolPL).map(([symbol, data]) => (
                        <div key={symbol} className="bg-white p-2 rounded border border-slate-200">
                          <p className="text-xs font-semibold text-slate-900">{symbol}</p>
                          <p className="text-lg font-bold text-blue-600">{((data.wins/data.total)*100).toFixed(0)}%</p>
                          <p className="text-[10px] text-slate-500">{data.wins}{t('winsShort')} / {data.total - data.wins}{t('lossesShort')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {expandedMetric === 'avgpl' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Card className="bg-white dark:bg-slate-800 bordo:bg-[#1f1018] shadow-xl border border-blue-200 dark:border-slate-700 bordo:border-[#8b2347]">
                <CardHeader>
                  <CardTitle className="text-blue-700 dark:text-blue-400 bordo:text-[#d97597]">{t('detailedAvgPLAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <p className="text-xs text-green-700 mb-1">{t('avgWinShort')}</p>
                      <p className="text-xl font-bold text-green-600">+{avgWin}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                      <p className="text-xs text-red-700 mb-1">{t('avgLossShort')}</p>
                      <p className="text-xl font-bold text-red-600">{avgLoss}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-700 mb-1">{t('medianWin')}</p>
                      <p className="text-xl font-bold text-blue-600">
                        +{winningTrades.length > 0 ? winningTrades.sort((a,b) => parseFloat(a.profit_loss) - parseFloat(b.profit_loss))[Math.floor(winningTrades.length/2)]?.profit_loss?.toFixed(2) || 0 : 0}
                      </p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <p className="text-xs text-orange-700 mb-1">{t('medianLoss')}</p>
                      <p className="text-xl font-bold text-orange-600">
                        {losingTrades.length > 0 ? losingTrades.sort((a,b) => parseFloat(a.profit_loss) - parseFloat(b.profit_loss))[Math.floor(losingTrades.length/2)]?.profit_loss?.toFixed(2) || 0 : 0}
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-700 mb-2 font-semibold">{t('avgPLByDirection')}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded border border-slate-200">
                        <p className="text-xs text-slate-600 mb-1">{t('longLabel')}</p>
                        <p className={`text-lg font-bold ${(longTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0) / longTrades.length) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {((longTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0) / longTrades.length) || 0).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-slate-500">{longTrades.length} {t('trades')}</p>
                      </div>
                      <div className="bg-white p-3 rounded border border-slate-200">
                        <p className="text-xs text-slate-600 mb-1">{t('shortLabel')}</p>
                        <p className={`text-lg font-bold ${(shortTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0) / shortTrades.length) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {((shortTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0) / shortTrades.length) || 0).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-slate-500">{shortTrades.length} {t('trades')}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {expandedMetric === 'pf' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Card className="bg-white dark:bg-slate-800 bordo:bg-[#1f1018] shadow-xl border border-blue-200 dark:border-slate-700 bordo:border-[#8b2347]">
                <CardHeader>
                  <CardTitle className="text-blue-700 dark:text-blue-400 bordo:text-[#d97597]">{t('detailedProfitFactorAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <p className="text-xs text-green-700 mb-1">{t('totalProfit')}</p>
                      <p className="text-xl font-bold text-green-600">+{(avgWin * wins).toFixed(2)}</p>
                      <p className="text-xs text-green-600 mt-1">{t('from')} {wins} {t('wins')}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                      <p className="text-xs text-red-700 mb-1">{t('totalLoss')}</p>
                      <p className="text-xl font-bold text-red-600">{(avgLoss * losses).toFixed(2)}</p>
                      <p className="text-xs text-red-600 mt-1">{t('from')} {losses} {t('losses')}</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                      <p className="text-xs text-purple-700 mb-1">{t('profitFactor')}</p>
                      <p className="text-xl font-bold text-purple-600">{profitFactor}</p>
                      <p className="text-xs text-purple-600 mt-1">
                        {profitFactor >= 2 ? t('pfExcellent') : profitFactor >= 1.5 ? t('pfGood') : profitFactor >= 1 ? t('pfAcceptable') : t('pfNeedsImprovement')}
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-700 mb-2 font-semibold">{t('tradeEfficiency')}</p>
                    <div className="w-full overflow-hidden">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={[
                          { name: t('avgWinShort'), value: parseFloat(avgWin), fill: '#22c55e' },
                          { name: t('avgLossShort'), value: Math.abs(parseFloat(avgLoss)), fill: '#f43f5e' }
                        ]} margin={{ top: 10, right: 20, left: 5, bottom: 5 }}>
                          <defs>
                            <clipPath id="trade-efficiency-clip">
                              <rect x="0" y="0" width="100%" height="100%" />
                            </clipPath>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" stroke="#64748b" />
                          <YAxis stroke="#64748b" width={50} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]} clipPath="url(#trade-efficiency-clip)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 bordo:from-[#1f4a35] bordo:to-[#15382a] border border-green-200/60 dark:border-green-800 bordo:border-green-900/40 shadow-lg">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 bordo:text-green-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                {t('averageWin')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400 bordo:text-green-300">+{avgWin}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 bordo:from-[#4a1f2a] bordo:to-[#381721] border border-red-200/60 dark:border-red-800 bordo:border-red-900/40 shadow-lg">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 bordo:text-red-300 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                {t('averageLoss')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400 bordo:text-red-300">{avgLoss}</div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 bordo:bg-[#1f1018] border border-slate-200/60 dark:border-slate-700 bordo:border-[#4a2836] shadow-lg">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {t('totalTradesLabel')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalTrades}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {wins}{t('winsShort')} / {losses}{t('lossesShort')} / {breakeven}{t('breakevenShort')}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expanded Outcome Details */}
        <AnimatePresence>
          {expandedMetric === 'outcome' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Card className="bg-white dark:bg-slate-800 bordo:bg-[#1f1018] shadow-xl border border-blue-200 dark:border-slate-700 bordo:border-[#8b2347]">
                <CardHeader>
                  <CardTitle className="text-blue-700 dark:text-blue-400 bordo:text-[#d97597]">{t('detailedOutcomeAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {outcomeData.map(outcome => (
                      <div key={outcome.name} className="p-3 rounded-lg border" style={{ backgroundColor: `${outcome.color}15`, borderColor: `${outcome.color}40` }}>
                        <p className="text-xs mb-1" style={{ color: outcome.color }}>{outcome.name}</p>
                        <p className="text-2xl font-bold" style={{ color: outcome.color }}>{outcome.value}</p>
                        <p className="text-xs mt-1" style={{ color: outcome.color }}>
                          {((outcome.value / totalTrades) * 100).toFixed(1)}% {t('ofAll')}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-700 mb-2 font-semibold">{t('distributionByTimeframe')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {['M5', 'M15', 'M30', 'H1', 'H4', 'D1'].map(tf => {
                        const tfTrades = trades.filter(t => t.timeframe === tf);
                        const tfWins = tfTrades.filter(t => t.outcome === 'Win').length;
                        return tfTrades.length > 0 ? (
                          <div key={tf} className="bg-white p-2 rounded border border-slate-200">
                            <p className="text-xs font-semibold text-slate-900">{tf}</p>
                            <p className="text-sm font-bold text-blue-600">{((tfWins/tfTrades.length)*100).toFixed(0)}%</p>
                            <p className="text-[10px] text-slate-500">{tfWins}/{tfTrades.length}</p>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Outcome Distribution */}
          <Card 
            className="bg-white dark:bg-slate-800 shadow-xl border border-slate-200/60 dark:border-slate-700 cursor-pointer hover:shadow-2xl transition-all"
            onClick={() => setExpandedMetric(expandedMetric === 'outcome' ? null : 'outcome')}
          >
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-slate-900 dark:text-white bordo:text-[#f9d5e5]">{t('outcomeDistribution')}</CardTitle>
                {expandedMetric === 'outcome' ? <ChevronUp className="w-5 h-5 text-blue-600" /> : <ChevronDown className="w-5 h-5 text-blue-600" />}
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden p-3">
              <div className="w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <Pie
                      data={outcomeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={75}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {outcomeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* P&L Over Time */}
          <Card className="bg-white dark:bg-slate-800 bordo:bg-[#1f1018] shadow-xl border border-slate-200/60 dark:border-slate-700 bordo:border-[#4a2836]">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-white">{t('plOverTime')}</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Select value={plChartFilter} onValueChange={(value) => { setPlChartFilter(value); setPlChartValue("all"); }}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all')}</SelectItem>
                    <SelectItem value="account">{t('account')}</SelectItem>
                    <SelectItem value="strategy">{t('strategy')}</SelectItem>
                    <SelectItem value="symbol">{t('symbol')}</SelectItem>
                    <SelectItem value="direction">{t('direction')}</SelectItem>
                    <SelectItem value="outcome">{t('outcome')}</SelectItem>
                  </SelectContent>
                </Select>

                {plChartFilter !== "all" && (
                  <Select value={plChartValue} onValueChange={setPlChartValue}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder={t('selectPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all')}</SelectItem>
                      {plChartFilter === "account" && accounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                      ))}
                      {plChartFilter === "strategy" && strategies.map(str => (
                        <SelectItem key={str.id} value={str.id}>{str.name}</SelectItem>
                      ))}
                      {plChartFilter === "symbol" && uniqueSymbols.map(sym => (
                        <SelectItem key={sym} value={sym}>{sym}</SelectItem>
                      ))}
                      {plChartFilter === "direction" && uniqueDirections.map(dir => (
                        <SelectItem key={dir} value={dir}>{directionLabel(dir, t)}</SelectItem>
                      ))}
                      {plChartFilter === "outcome" && uniqueOutcomes.map(out => (
                        <SelectItem key={out} value={out}>{out}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="overflow-hidden p-3">
              <div className="w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={plOverTime} margin={{ top: 10, right: 25, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="trade" stroke="#64748b" />
                    <YAxis stroke="#64748b" width={55} domain={[(dataMin) => Math.floor(dataMin - Math.abs(dataMin * 0.1 || 10)), (dataMax) => Math.ceil(dataMax + Math.abs(dataMax * 0.1 || 10))]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                      itemStyle={{ color: '#e2e8f0' }}
                      labelStyle={{ color: '#f1f5f9' }}
                    />
                    <Line type="monotone" dataKey="pl" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Strategy Performance */}
        {strategyData.length > 0 && (
          <Card className="bg-white dark:bg-slate-800 bordo:bg-[#1f1018] shadow-xl border border-slate-200/60 dark:border-slate-700 bordo:border-[#4a2836]">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-white">{t('strategyPerformance')}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden p-4">
              <div className="w-full overflow-hidden">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={strategyData} margin={{ top: 15, right: 25, left: 10, bottom: 85 }}>
                    <defs>
                      <clipPath id="dashboard-strategy-clip">
                        <rect x="0" y="0" width="100%" height="100%" />
                      </clipPath>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke="#64748b" width={55} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                    />
                    <Legend />
                    <Bar dataKey="winRate" fill="#3b82f6" name={t('winRatePercent')} radius={[8, 8, 0, 0]} clipPath="url(#dashboard-strategy-clip)" />
                    <Bar dataKey="trades" fill="#8b5cf6" name={t('tradesCount')} radius={[8, 8, 0, 0]} clipPath="url(#dashboard-strategy-clip)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Best & Worst Trades */}
        {bestTrade && worstTrade && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 bordo:from-[#1f4a35] bordo:to-[#15382a] border border-green-200/60 dark:border-green-800 bordo:border-green-900/40 shadow-xl">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-green-700 dark:text-green-400 bordo:text-green-300 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    {t('bestTrade')}
                  </CardTitle>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleViewTrade(bestTrade)}
                    className="text-green-600 hover:text-green-700 hover:bg-green-100"
                  >
                    <Eye className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white bordo:text-[#f9d5e5]">{bestTrade.symbol}</span>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">+{parseFloat(bestTrade.profit_loss).toFixed(2)}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 bordo:text-[#d4a5b8]">{bestTrade.date} • {bestTrade.strategy}</p>
                {bestTrade.notes && (
                  <p className="text-sm text-slate-700 dark:text-slate-300 bordo:text-[#d4a5b8] mt-2">{bestTrade.notes.slice(0, 100)}...</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 bordo:from-[#4a1f2a] bordo:to-[#381721] border border-red-200/60 dark:border-red-800 bordo:border-red-900/40 shadow-xl">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-red-700 dark:text-red-400 bordo:text-red-300 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5" />
                    {t('worstTrade')}
                  </CardTitle>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleViewTrade(worstTrade)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-100"
                  >
                    <Eye className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white bordo:text-[#f9d5e5]">{worstTrade.symbol}</span>
                  <span className="text-2xl font-bold text-red-600 dark:text-red-400">{parseFloat(worstTrade.profit_loss).toFixed(2)}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 bordo:text-[#d4a5b8]">{worstTrade.date} • {worstTrade.strategy}</p>
                {worstTrade.lessons_learned && (
                  <p className="text-sm text-slate-700 dark:text-slate-300 bordo:text-[#d4a5b8] mt-2">{worstTrade.lessons_learned.slice(0, 100)}...</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Edit Trade Dialog */}
        <Dialog open={editingTrade !== null} onOpenChange={() => setEditingTrade(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white p-0">
            <div className="sticky top-0 bg-white p-6 border-b">
              <DialogTitle>Edit Trade</DialogTitle>
            </div>
            <div className="p-6">
              {editingTrade && (
                <TradeFormNew
                  trade={editingTrade}
                  onSuccess={() => {
                    refetch();
                    setEditingTrade(null);
                  }}
                  onClose={() => setEditingTrade(null)}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Trade Detail Dialog */}
        <Dialog open={!!selectedTrade} onOpenChange={() => setSelectedTrade(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 bg-white dark:bg-[#1a1a2e] border-slate-200 dark:border-slate-700">
            <DialogHeader className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 text-white px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <DialogTitle className="text-white text-xl font-bold">Trade Details</DialogTitle>
            </DialogHeader>
            <div className="p-6 bg-white dark:bg-[#1a1a2e]">
              {selectedTrade && (
                <TradeCard
                  trade={selectedTrade}
                  onEdit={(tradeToEdit) => {
                    setSelectedTrade(null);
                    setEditingTrade(tradeToEdit);
                  }}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}