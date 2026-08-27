import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/lib/AuthContext';
import { getTrades, getTradingAccounts, getStrategies } from '@/lib/localStorage';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, preventDialogDismissProps } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TrendingUp, TrendingDown, Calendar, Eye, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Filter, CalendarDays, CalendarRange, Wallet, Plus } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter } from "recharts";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import TradeCard from "../components/TradeCard";
import TradeFormNew from "../components/TradeFormNew";
import TradeDetailView from "../components/TradeDetailView";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/components/LanguageProvider";
import { directionLabel, getTradeRealizedPL, isClosedTrade, normalizeDirection, tradeOutcomeChartColor, tradePnLBarColor } from "@/lib/utils";
import { formatTradeDate, formatTradeClock, getDateFormat, getTradeEntryHour } from "@/lib/userSettings";

// ─── Mini date-range calendar (same as Journal) ──────────────────────────────
const MONTHS_PL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_PL = ["Pn","Wt","Śr","Cz","Pt","Sb","Nd"];

function monthLabel(ym, language) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "";
  const [y, m] = ym.split("-");
  const idx = Number(m) - 1;
  const names = language === "pl" ? MONTHS_PL : MONTHS_EN;
  return `${names[idx] || m} ${y}`;
}

function monthBounds(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return { from: "", to: "" };
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${ym}-01`,
    to: `${ym}-${String(last).padStart(2, "0")}`,
  };
}

function MiniCalendar({ from, to, onSelect }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [view, setView] = useState(() => {
    const base = from ? new Date(from + "T00:00:00") : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const prevMonth = () => setView(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setView(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });
  const toStr = (d) => `${view.year}-${String(view.month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const firstDow = (() => { const d = new Date(view.year, view.month, 1).getDay(); return d === 0 ? 6 : d - 1; })();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const handleDay = (d) => {
    if (!d) return;
    const s = toStr(d);
    if (!from || (from && to)) { onSelect(s, ""); }
    else if (s < from) { onSelect(s, from); }
    else { onSelect(from, s); }
  };
  return (
    <div className="w-[224px] select-none">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{MONTHS_PL[view.month]} {view.year}</span>
        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_PL.map(d => <div key={d} className="text-center text-[10px] font-medium text-slate-400 py-0.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const s = toStr(d);
          const isFrom = s === from, isTo = s === to;
          const inRange = from && to && s > from && s < to;
          const isNow = s === todayStr;
          return (
            <button key={i} type="button" onClick={() => handleDay(d)}
              className={["text-xs h-7 w-full rounded transition-colors",
                isFrom || isTo ? "bg-blue-600 text-white font-semibold" : "",
                inRange ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-none" : "",
                isNow && !isFrom && !isTo ? "font-bold text-blue-500 dark:text-blue-400" : "",
                !isFrom && !isTo && !inRange ? "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" : "",
              ].join(" ").trim()}>{d}</button>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const dateFormat = getDateFormat();
  const fmtDate = (d) => formatTradeDate(d, dateFormat);

  // Dark mode observer for recharts colors
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const dashboardFiltersStorageKey = `dashboard_filters_v2_${user?.id || 'guest'}`;
  const dateLocale = language === "pl" ? pl : enUS;
  const dayLocale = language === "pl" ? "pl-PL" : "en-US";
  const hasLoadedDashboardFilters = useRef(false);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
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
  const [dashboardRanges, setDashboardRanges] = useState(["all"]);
  const [rangeFilterOpen, setRangeFilterOpen] = useState(false);
  const rangeFilterMainRef = useRef(null);
  const rangeFilterChartRef = useRef(null);
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
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = useRef(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [monthFilterOpen, setMonthFilterOpen] = useState(false);
  const monthFilterRef = useRef(null);

  useEffect(() => {
    hasLoadedDashboardFilters.current = false;
    try {
      const raw = localStorage.getItem(dashboardFiltersStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed.dashboardAccounts) && parsed.dashboardAccounts.length > 0) {
          setDashboardAccounts(parsed.dashboardAccounts.map((value) => String(value)));
        }

        const validRanges = ["all", "7d", "30d", "90d"];
        if (Array.isArray(parsed.dashboardRanges) && parsed.dashboardRanges.length > 0) {
          const normalizedRange = String(parsed.dashboardRanges[0]);
          setDashboardRanges(validRanges.includes(normalizedRange) ? [normalizedRange] : ["all"]);
        }

        if (Array.isArray(parsed.filterSymbols) && parsed.filterSymbols.length > 0) {
          setFilterSymbols(parsed.filterSymbols.map((value) => String(value)));
        }

        if (Array.isArray(parsed.filterDirections) && parsed.filterDirections.length > 0) {
          setFilterDirections(parsed.filterDirections.map((value) => String(value)));
        }

        if (Array.isArray(parsed.filterOutcomes) && parsed.filterOutcomes.length > 0) {
          setFilterOutcomes(parsed.filterOutcomes.map((value) => String(value)));
        }

        if (typeof parsed.selectedMonth === "string" && /^\d{4}-\d{2}$/.test(parsed.selectedMonth)) {
          setSelectedMonth(parsed.selectedMonth);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard filters from localStorage:', error);
    } finally {
      hasLoadedDashboardFilters.current = true;
    }
  }, [dashboardFiltersStorageKey]);

  useEffect(() => {
    if (!hasLoadedDashboardFilters.current) return;

    try {
      localStorage.setItem(
        dashboardFiltersStorageKey,
        JSON.stringify({
          dashboardAccounts,
          dashboardRanges: [dashboardRanges[0] || "all"],
          selectedMonth: selectedMonth || "",
          filterSymbols,
          filterDirections,
          filterOutcomes
        })
      );
    } catch (error) {
      console.error('Failed to save dashboard filters to localStorage:', error);
    }
  }, [
    dashboardFiltersStorageKey,
    dashboardAccounts,
    dashboardRanges,
    selectedMonth,
    filterSymbols,
    filterDirections,
    filterOutcomes
  ]);
  const { data: trades = [], isLoading, refetch } = useQuery({
    queryKey: ['trades'],
    queryFn: () => getTrades(user?.id),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => getTradingAccounts(user?.id),
  });

  const activeAccounts = accounts.filter((account) => account.is_active !== false && account.status !== 'Inactive');
  const activeAccountIds = new Set(activeAccounts.map((account) => String(account.id)));
  const inactiveAccountIds = new Set(
    accounts.filter(a => a.is_active === false || a.status === 'Inactive').map(a => String(a.id))
  );
  const tradesFromActiveAccounts = trades.filter((trade) => {
    if (!trade.account_id) return true;
    return !inactiveAccountIds.has(String(trade.account_id));
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
    const totalPLForSymbol = symbolTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0);
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


  const uniqueSymbols = [...new Set(tradesFromActiveAccounts.map(t => t.symbol).filter(Boolean))];
  const uniqueDirections = [...new Set(tradesFromActiveAccounts.map(t => normalizeDirection(t.direction)).filter(Boolean))];
  const uniqueOutcomes = [...new Set(tradesFromActiveAccounts.map(t => t.outcome).filter(Boolean))];

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
    (value) => activeAccounts.find((account) => String(account.id) === String(value))?.name
  );
  const dashboardRangeLabel = buildFilterLabel(
    dashboardRanges,
    t('allTime'),
    (value) => (
      value === 'all' ? t('allTime')
        : value === '7d' ? t('last7Days')
        : value === '90d' ? t('last90Days')
        : t('last30Days')
    )
  );

  const toggleDashboardAccount = (value) => toggleMultiFilter(setDashboardAccounts, value);
  const toggleDashboardRange = (value) => {
    const normalizedValue = String(value);
    if (!["all", "7d", "30d", "90d"].includes(normalizedValue)) return;
    setSelectedMonth("");
    setDateRange({ from: "", to: "" });
    setDashboardRanges([normalizedValue]);
    setRangeFilterOpen(false);
  };

  const selectDashboardMonth = (ym) => {
    setSelectedMonth(ym);
    setDateRange({ from: "", to: "" });
    setDashboardRanges(["all"]);
    setMonthFilterOpen(false);
  };

  const clearDashboardMonth = () => {
    setSelectedMonth("");
    setMonthFilterOpen(false);
  };

  const toDateKey = (value) => {
    if (!value) return "";
    const raw = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return "";
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const localTodayKey = () => {
    const n = new Date();
    const y = n.getFullYear();
    const m = String(n.getMonth() + 1).padStart(2, "0");
    const d = String(n.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const availableMonths = useMemo(() => {
    const months = new Set();
    tradesFromActiveAccounts.forEach((trade) => {
      const key = toDateKey(trade.date);
      if (key) months.add(key.slice(0, 7));
    });
    return [...months].sort((a, b) => b.localeCompare(a));
  }, [tradesFromActiveAccounts]);

  const monthBoundsActive = selectedMonth ? monthBounds(selectedMonth) : { from: "", to: "" };

  const rangeStartKey = (() => {
    if (selectedMonth) return monthBoundsActive.from;
    if (dateRange.from) return dateRange.from;
    const selectedRange = dashboardRanges[0] || "all";
    if (selectedRange === "all") return null;
    const maxDays = selectedRange === "7d" ? 7 : selectedRange === "90d" ? 90 : 30;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - maxDays);
    return toDateKey(d);
  })();

  const rangeEndKey = (() => {
    if (selectedMonth) return monthBoundsActive.to;
    return dateRange.to || null;
  })();

  const filteredTrades = tradesFromActiveAccounts.filter(t => {
    const tradeKey = toDateKey(t.date);
    const afterStart = !rangeStartKey || (!!tradeKey && tradeKey >= rangeStartKey);
    const beforeEnd = !rangeEndKey || (!!tradeKey && tradeKey <= rangeEndKey);
    return (
      (dashboardAccounts.includes("all") || dashboardAccounts.includes(String(t.account_id))) &&
      (filterSymbols.includes("all") || filterSymbols.includes(String(t.symbol))) &&
      (filterDirections.includes("all") || filterDirections.includes(String(normalizeDirection(t.direction)))) &&
      (filterOutcomes.includes("all") || filterOutcomes.includes(String(t.outcome))) &&
      afterStart && beforeEnd
    );
  });

  const closedTrades = filteredTrades.filter(isClosedTrade);

  // Calculate metrics
  const totalTrades = closedTrades.length;
  const wins = closedTrades.filter(t => t.outcome === "Win").length;
  const losses = closedTrades.filter(t => t.outcome === "Loss").length;
  const breakeven = closedTrades.filter(t => t.outcome === "Breakeven").length;
  const decidedTrades = wins + losses;
  const winRate = decidedTrades > 0 ? ((wins / decidedTrades) * 100).toFixed(1) : 0;
  
  const totalPL = closedTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0);
  const avgPL = totalTrades > 0 ? (totalPL / totalTrades).toFixed(2) : 0;
  const winPLSum = closedTrades.filter(t => t.outcome === "Win").reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0);
  const lossPLSum = closedTrades.filter(t => t.outcome === "Loss").reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0);
  const avgWin = wins > 0 ? (winPLSum / wins).toFixed(2) : 0;
  const avgLoss = losses > 0 ? (lossPLSum / losses).toFixed(2) : 0;
  
  const profitFactor = Math.abs(lossPLSum) > 0 ? (winPLSum / Math.abs(lossPLSum)).toFixed(2) : (winPLSum > 0 ? "∞" : "0");

  const todayStr = localTodayKey();
  const dayTrades = closedTrades.filter(t => toDateKey(t.date) === todayStr);
  const dayWins = dayTrades.filter(t => t.outcome === "Win").length;
  const dayDecided = dayTrades.filter(t => t.outcome === "Win" || t.outcome === "Loss").length;
  const dayWinRate = dayDecided > 0 ? ((dayWins / dayDecided) * 100).toFixed(1) : 0;
  const avgWinLossRatio = Math.abs(Number(avgLoss)) > 0 ? Math.abs(Number(avgWin) / Number(avgLoss)).toFixed(2) : (Number(avgWin) > 0 ? "∞" : "0");

  const plRing = Math.min((Math.abs(totalPL) / 1000) * 100, 100);
  const winRateRing = Math.min(parseFloat(winRate) || 0, 100);
  const pfRing = Math.min((parseFloat(profitFactor) || 0) / 3 * 100, 100);
  const dayWinRing = Math.min(parseFloat(dayWinRate) || 0, 100);
  const avgWinLossRing = Math.min((parseFloat(avgWinLossRatio) || 0) / 3 * 100, 100);

  const dailyPLByDate = {};
  closedTrades.forEach(t => {
    const key = toDateKey(t.date);
    if (key) {
      dailyPLByDate[key] = (dailyPLByDate[key] || 0) + (getTradeRealizedPL(t) ?? 0);
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
    const key = toDateKey(trade.date);
    if (!key) return;
    if (!tradesByDate[key]) tradesByDate[key] = [];
    tradesByDate[key].push(trade);
  });

  const zellaScore = (() => {
    const maxDrawdown = Math.abs(Math.min(...closedTrades.map(t => (getTradeRealizedPL(t) ?? 0)), 0));
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

  // Outcome distribution
  const outcomeData = [
    { name: t('wins'), value: wins, color: tradeOutcomeChartColor('Win') },
    { name: t('losses'), value: losses, color: tradeOutcomeChartColor('Loss') },
    { name: t('breakeven'), value: breakeven, color: tradeOutcomeChartColor('Breakeven') }
  ];

  const directionPieData = useMemo(() => {
    const longCount = closedTrades.filter((tr) => normalizeDirection(tr.direction) === 'Long').length;
    const shortCount = closedTrades.filter((tr) => normalizeDirection(tr.direction) === 'Short').length;
    return [
      { name: t('longLabel'), value: longCount, color: '#22d3ee' },
      { name: t('shortLabel'), value: shortCount, color: '#fb923c' },
    ];
  }, [closedTrades, t]);

  const monthlyStackData = useMemo(() => {
    const map = {};
    closedTrades.forEach((tr) => {
      if (!tr.date) return;
      const key = tr.date.slice(0, 7);
      if (!map[key]) map[key] = { month: key, winPl: 0, lossPl: 0 };
      const pl = (getTradeRealizedPL(tr) ?? 0);
      if (pl >= 0) map[key].winPl += pl;
      else map[key].lossPl += Math.abs(pl);
    });
    return Object.values(map)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-10)
      .map((row) => ({
        label: row.month.slice(5),
        winPl: Math.round(row.winPl * 100) / 100,
        lossPl: Math.round(row.lossPl * 100) / 100,
      }));
  }, [closedTrades]);

  const winRateGauge = Math.min(parseFloat(winRate) || 0, 100);
  const pfGauge = Math.min((parseFloat(profitFactor) || 0) / 3 * 100, 100);

  // P&L over time (last 20 trades chronologically) with filters
  const getFilteredTradesForChart = () => {
    if (plChartFilter === "all" || plChartValue === "all") return closedTrades;
    
    if (plChartFilter === "account") {
      return closedTrades.filter(t => String(t.account_id) === String(plChartValue));
    } else if (plChartFilter === "strategy") {
      return closedTrades.filter(t => String(t.strategy_id) === String(plChartValue));
    } else if (plChartFilter === "symbol") {
      return closedTrades.filter(t => t.symbol === plChartValue);
    } else if (plChartFilter === "direction") {
      return closedTrades.filter(t => normalizeDirection(t.direction) === plChartValue);
    } else if (plChartFilter === "outcome") {
      return closedTrades.filter(t => t.outcome === plChartValue);
    }
    
    return closedTrades;
  };

  const tradeChronoKey = (trade) => {
    const date = toDateKey(trade?.date);
    const raw = String(trade?.entry_time || trade?.open_time || trade?.time || "00:00:00");
    const m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    const hh = m ? String(Number(m[1])).padStart(2, "0") : "00";
    const mm = m ? m[2] : "00";
    const ss = m?.[3] || "00";
    return `${date}T${hh}:${mm}:${ss}`;
  };

  const recentTrades = [...getFilteredTradesForChart()]
    .sort((a, b) => tradeChronoKey(a).localeCompare(tradeChronoKey(b)))
    .slice(-20);
  let cumulativePL = 0;
  const plOverTime = [
    { trade: '#0', pl: 0, symbol: '', date: '' },
    ...recentTrades.map((trade, index) => {
      cumulativePL += (getTradeRealizedPL(trade) ?? 0);
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
    : (activeAccounts.find(acc => String(acc.id) === String(accountBalanceAccount))?.name || t('myAccount'));

  useEffect(() => {
    const activeIds = new Set(activeAccounts.map((acc) => String(acc.id)));
    setDashboardAccounts((prev) => {
      if (prev.includes('all')) return prev;
      const sanitized = prev.filter((id) => activeIds.has(String(id)));
      return sanitized.length ? sanitized : ['all'];
    });

    setAccountBalanceAccount((prev) => {
      if (prev === 'all') return prev;
      return activeIds.has(String(prev)) ? prev : 'all';
    });

    setPlChartValue((prev) => {
      if (prev === 'all' || plChartFilter !== 'account') return prev;
      return activeIds.has(String(prev)) ? prev : 'all';
    });
  }, [accounts, plChartFilter]);

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
      const clickedInsideMain = rangeFilterMainRef.current?.contains(event.target);
      const clickedInsideChart = rangeFilterChartRef.current?.contains(event.target);
      if (!clickedInsideMain && !clickedInsideChart) {
        setRangeFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [rangeFilterOpen]);

  useEffect(() => {
    if (!datePickerOpen) return;
    const handleOutsideClick = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [datePickerOpen]);

  useEffect(() => {
    if (!monthFilterOpen) return;
    const handleOutsideClick = (event) => {
      if (monthFilterRef.current && !monthFilterRef.current.contains(event.target)) {
        setMonthFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [monthFilterOpen]);

  useEffect(() => {
    if (!recentTradesAccountOpen) return;
    const handleOutsideClick = (event) => {
      if (recentTradesAccountRef.current && !recentTradesAccountRef.current.contains(event.target)) {
        setRecentTradesAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [recentTradesAccountOpen]);

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
    ...[...accountBalanceTrades]
      .sort((a, b) => tradeChronoKey(a).localeCompare(tradeChronoKey(b)))
      .slice(-20)
      .map((trade, index) => {
      accountBalanceCum += (getTradeRealizedPL(trade) ?? 0);
      return {
        trade: `#${index + 1}`,
        pl: Math.round(accountBalanceCum * 100) / 100,
        symbol: trade.symbol,
        date: trade.date
      };
    })
  ];

  // Daily cumulative P&L — closed trades only
  const dailyCumulativeByDate = {};
  [...closedTrades]
    .filter(t => t.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach(t => {
      const dateKey = t.date.substring(0, 10);
      if (!dailyCumulativeByDate[dateKey]) dailyCumulativeByDate[dateKey] = 0;
      dailyCumulativeByDate[dateKey] += (getTradeRealizedPL(t) ?? 0);
    });
  let dailyCum = 0;
  const sortedDailyCumEntries = Object.entries(dailyCumulativeByDate)
    .sort(([a], [b]) => a.localeCompare(b));
  const dailyCumulativeData = sortedDailyCumEntries.length === 0
    ? []
    : [
        { date: sortedDailyCumEntries[0][0].substring(5), pl: 0 },
        ...sortedDailyCumEntries.map(([date, dayPl]) => {
          dailyCum += dayPl;
          return { date: date.substring(5), pl: Math.round(dailyCum * 100) / 100 };
        })
      ];

  let running = 0;
  let peak = 0;
  const drawdownData = [...closedTrades]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((trade, index) => {
      running += (getTradeRealizedPL(trade) ?? 0);
      peak = Math.max(peak, running);
      const drawdown = running - peak;
      return {
        trade: index + 1,
        drawdown: parseFloat(drawdown.toFixed(2)),
      };
    });

  const tradeTimeData = closedTrades
    .filter(t => t.open_time || t.time || t.entry_time)
    .map(t => {
      const hour = getTradeEntryHour(t) ?? 0;
      return {
        hour,
        pl: (getTradeRealizedPL(t) ?? 0),
      };
    });

  const longTrades = closedTrades.filter(t => normalizeDirection(t.direction) === "Long");
  const shortTrades = closedTrades.filter(t => normalizeDirection(t.direction) === "Short");

  // Best and worst trades
  const sortedByPL = [...closedTrades].sort((a, b) => ((getTradeRealizedPL(b) ?? 0) || 0) - ((getTradeRealizedPL(a) ?? 0) || 0));
  const bestTrade = sortedByPL[0];
  const worstTrade = sortedByPL[sortedByPL.length - 1];

  // Additional analytics for expandable sections
  const winningTrades = closedTrades.filter(t => t.outcome === "Win");
  const losingTrades = closedTrades.filter(t => t.outcome === "Loss");
  
  // P&L by day of week
  const dayPL = {};
  closedTrades.forEach(t => {
    if (t.date) {
      const day = new Date(t.date).toLocaleDateString(dayLocale, { weekday: 'long' });
      if (!dayPL[day]) dayPL[day] = 0;
      dayPL[day] += (getTradeRealizedPL(t) ?? 0);
    }
  });
  
  // P&L by symbol
  const symbolPL = {};
  closedTrades.forEach(t => {
    if (!symbolPL[t.symbol]) symbolPL[t.symbol] = { pl: 0, wins: 0, total: 0 };
    symbolPL[t.symbol].pl += (getTradeRealizedPL(t) ?? 0);
    symbolPL[t.symbol].total++;
    if (t.outcome === "Win") symbolPL[t.symbol].wins++;
  });
  
  // Win streaks
  let currentStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let currentLossStreak = 0;
  [...closedTrades].reverse().forEach(t => {
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

  // Current streak (based on filtered closed trades)
  const streakTrades = [...closedTrades].sort((a, b) => {
    const dateA = `${a.date || ''}T${a.open_time || a.time || '00:00'}`;
    const dateB = `${b.date || ''}T${b.open_time || b.time || '00:00'}`;
    return new Date(dateA) - new Date(dateB);
  });

  let filteredMaxWinStreak = 0;
  let filteredMaxLossStreak = 0;
  let runningWinStreak = 0;
  let runningLossStreak = 0;

  streakTrades.forEach((trade) => {
    if (trade.outcome === 'Win') {
      runningWinStreak += 1;
      runningLossStreak = 0;
      filteredMaxWinStreak = Math.max(filteredMaxWinStreak, runningWinStreak);
    } else if (trade.outcome === 'Loss') {
      runningLossStreak += 1;
      runningWinStreak = 0;
      filteredMaxLossStreak = Math.max(filteredMaxLossStreak, runningLossStreak);
    } else {
      runningWinStreak = 0;
      runningLossStreak = 0;
    }
  });

  let activeStreakType = 'none';
  let activeStreakCount = 0;
  for (let i = streakTrades.length - 1; i >= 0; i -= 1) {
    const outcome = streakTrades[i].outcome;
    if (outcome !== 'Win' && outcome !== 'Loss') break;
    if (activeStreakType === 'none') {
      activeStreakType = outcome;
      activeStreakCount = 1;
      continue;
    }
    if (outcome === activeStreakType) {
      activeStreakCount += 1;
    } else {
      break;
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-transparent dashboard-surface">
      <div className="w-full mx-auto space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white bordo:text-[#f9d5e5] mb-1 sm:mb-2">{t('dashboard')}</h1>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 bordo:text-[#d4a5b8]">{t('overviewOfYourTradingPerformance')}</p>
            </div>
            <div className="flex items-stretch sm:items-center gap-2 sm:gap-3 md:gap-4 flex-wrap">
              <Button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="h-10 px-3 md:px-4 gap-2 text-sm w-full sm:w-auto shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
                title={t('addTrade')}
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="font-semibold">{t('addTrade')}</span>
              </Button>
              <div className="relative flex-1 min-w-[min(100%,10.5rem)] sm:flex-none sm:min-w-0" ref={accountDropdownRef}>
                <button
                  onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                  className="relative h-10 w-full sm:w-[170px] md:w-[210px] px-3 rounded-md border border-input bg-transparent text-sm flex items-center justify-center hover:bg-accent"
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
                      <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${dashboardAccounts.includes('all') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-muted/50'}`}>
                        {dashboardAccounts.includes('all') && (
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </button>
                    {activeAccounts.map(acc => (
                      (() => {
                        const isSelected = dashboardAccounts.includes(String(acc.id));
                        return (
                      <button
                        key={acc.id}
                        onClick={() => { toggleDashboardAccount(acc.id); }}
                        className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? 'bg-accent' : ''}`}
                      >
                        <span className="truncate">{acc.name}</span>
                        <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-muted/50'}`}>
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
                  <Button variant="outline" size="sm" className="h-10 px-3 md:px-4 gap-2 text-sm flex-1 sm:flex-none min-w-[6.5rem]">
                    <Filter className="w-4 h-4" />
                    {t('filters')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" side="bottom" className="w-[min(420px,calc(100vw-1.5rem))] p-4">
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
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${filterSymbols.includes('all') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-muted/50'}`}>
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
                              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-muted/50'}`}>
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
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${filterDirections.includes('all') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-muted/50'}`}>
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
                              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-muted/50'}`}>
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
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${filterOutcomes.includes('all') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-muted/50'}`}>
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
                              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-muted/50'}`}>
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

              <div className="relative flex-1 min-w-[min(100%,9rem)] sm:flex-none" ref={rangeFilterMainRef}>
                <button
                  type="button"
                  onClick={() => {
                    setRangeFilterOpen((prev) => !prev);
                    setMonthFilterOpen(false);
                    setDatePickerOpen(false);
                  }}
                  className="relative h-10 w-full min-w-[min(100%,9rem)] sm:w-[170px] md:w-[210px] px-3 rounded-md border border-input bg-transparent text-sm flex items-center justify-center hover:bg-accent flex-1 sm:flex-none"
                >
                  <CalendarDays className="absolute left-3 w-4 h-4 text-slate-500" />
                  <span className="truncate text-center w-full px-6">{dashboardRangeLabel || t('allTime')}</span>
                  <ChevronDown className="absolute right-3 w-4 h-4 opacity-50" />
                </button>
                {rangeFilterOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border bg-popover p-1 shadow-md">
                    <button
                      type="button"
                      onClick={() => { toggleDashboardRange('all'); }}
                      className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${dashboardRanges.includes('all') ? 'bg-accent' : ''}`}
                    >
                      <span>{t('allTime')}</span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${dashboardRanges.includes('all') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-muted/50'}`}>
                        {dashboardRanges.includes('all') && (
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { toggleDashboardRange('7d'); }}
                      className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${dashboardRanges.includes('7d') ? 'bg-accent' : ''}`}
                    >
                      <span>{t('last7Days')}</span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${dashboardRanges.includes('7d') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-muted/50'}`}>
                        {dashboardRanges.includes('7d') && (
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { toggleDashboardRange('30d'); }}
                      className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${dashboardRanges.includes('30d') ? 'bg-accent' : ''}`}
                    >
                      <span>{t('last30Days')}</span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${dashboardRanges.includes('30d') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-muted/50'}`}>
                        {dashboardRanges.includes('30d') && (
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { toggleDashboardRange('90d'); }}
                      className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${dashboardRanges.includes('90d') ? 'bg-accent' : ''}`}
                    >
                      <span>{t('last90Days')}</span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${dashboardRanges.includes('90d') ? 'border-blue-600 bg-blue-600' : 'border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-muted/50'}`}>
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

              <div className="relative flex-1 min-w-[min(100%,9rem)] sm:flex-none" ref={monthFilterRef}>
                <button
                  type="button"
                  onClick={() => {
                    setMonthFilterOpen((prev) => !prev);
                    setRangeFilterOpen(false);
                    setDatePickerOpen(false);
                  }}
                  className={`relative h-10 flex-1 min-w-[min(100%,9rem)] sm:flex-none sm:min-w-[150px] md:min-w-[180px] px-3 rounded-md border text-sm flex items-center justify-center hover:bg-accent ${
                    selectedMonth
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                      : "border-input bg-transparent"
                  }`}
                >
                  <Calendar className="absolute left-3 w-4 h-4 text-slate-500" />
                  <span className="truncate text-center w-full px-6">
                    {selectedMonth
                      ? monthLabel(selectedMonth, language)
                      : (language === "pl" ? "Miesiąc" : "Month")}
                  </span>
                  <ChevronDown className="absolute right-3 w-4 h-4 opacity-50" />
                </button>
                {monthFilterOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-[220px] max-h-72 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                    <button
                      type="button"
                      onClick={clearDashboardMonth}
                      className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${!selectedMonth ? "bg-accent" : ""}`}
                    >
                      <span>{language === "pl" ? "Wszystkie miesiące" : "All months"}</span>
                      {!selectedMonth && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border-[3px] border-blue-600 bg-blue-600">
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </button>
                    {availableMonths.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">
                        {language === "pl" ? "Brak miesięcy z trade'ami" : "No months with trades"}
                      </p>
                    ) : (
                      availableMonths.map((ym) => {
                        const isSelected = selectedMonth === ym;
                        return (
                          <button
                            key={ym}
                            type="button"
                            onClick={() => selectDashboardMonth(ym)}
                            className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? "bg-accent" : ""}`}
                          >
                            <span>{monthLabel(ym, language)}</span>
                            {isSelected && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full border-[3px] border-blue-600 bg-blue-600">
                                <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Date range picker — rightmost */}
              <div className="relative flex-1 min-w-[min(100%,9rem)] sm:flex-none sm:w-auto" ref={datePickerRef}>
                <button
                  type="button"
                  onClick={() => {
                    setDatePickerOpen(prev => !prev);
                    setMonthFilterOpen(false);
                    setRangeFilterOpen(false);
                  }}
                  className={`relative flex items-center justify-center gap-2 px-3 py-2 h-10 w-full sm:w-auto border rounded-md text-sm transition-colors ${
                    dateRange.from
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                      : "border-input bg-transparent hover:bg-accent"
                  }`}
                >
                  <CalendarRange className="w-4 h-4 shrink-0" />
                  <span className="truncate max-w-[min(100%,11rem)] sm:max-w-[140px]">
                    {dateRange.from
                      ? dateRange.to && dateRange.to !== dateRange.from
                        ? `${dateRange.from.split("-").reverse().join(".")} – ${dateRange.to.split("-").reverse().join(".")}`
                        : dateRange.from.split("-").reverse().join(".")
                      : "Zakres dat"}
                  </span>
                  {datePickerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {datePickerOpen && (
                  <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 z-50 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-card shadow-xl p-3">
                    <MiniCalendar
                      from={dateRange.from}
                      to={dateRange.to}
                      onSelect={(f, toVal) => {
                        setSelectedMonth("");
                        setDashboardRanges(["all"]);
                        setDateRange({ from: f, to: toVal });
                      }}
                    />
                    {(dateRange.from || dateRange.to) && (
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          {dateRange.from && dateRange.to
                            ? `${dateRange.from.split("-").reverse().join(".")} – ${dateRange.to.split("-").reverse().join(".")}`
                            : dateRange.from ? `Od ${dateRange.from.split("-").reverse().join(".")}` : ""}
                        </span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setDateRange({ from: "", to: "" })}
                            className="text-[11px] text-slate-400 hover:text-red-500 px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                            Wyczyść
                          </button>
                          <button type="button" onClick={() => setDatePickerOpen(false)}
                            className="text-[11px] text-white bg-blue-600 hover:bg-blue-700 px-3 py-0.5 rounded">
                            Zamknij
                          </button>
                        </div>
                      </div>
                    )}
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
                  <div data-private className={`mt-1.5 text-xl md:text-2xl font-bold ${totalPL >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {totalPL >= 0 ? '+' : ''}{totalPL.toFixed(2)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {selectedMonth
                      ? monthLabel(selectedMonth, language)
                      : dateRange.from
                        ? `${dateRange.from}${dateRange.to ? ` → ${dateRange.to}` : ""}`
                        : dashboardRangeLabel}
                    {" · "}{totalTrades} {t('trades')}
                  </p>
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
                  <p className="text-xs text-slate-500 mt-1 truncate">{wins}W / {losses}L{breakeven > 0 ? ` / ${breakeven}BE` : ""}</p>
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

        {/* Main Dashboard Layout — cyber supervision grid (calendar center) */}
        <div className="cyber-columns-grid">
          <aside className="cyber-col cyber-col-left space-y-3 min-w-0">
            <Card className="cyber-panel">
              <CardHeader className="pb-2">
                <CardTitle className="cyber-panel-title text-xs">{t("longVsShort")}</CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0">
                <div className="h-[120px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={directionPieData}
                        dataKey="value"
                        innerRadius={32}
                        outerRadius={52}
                        paddingAngle={2}
                      >
                        {directionPieData.map((e, i) => (
                          <Cell key={`dc-${i}`} fill={e.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? "#0f172a" : "#fff",
                          border: `1px solid ${isDark ? "rgba(34,211,238,0.35)" : "#cbd5e1"}`,
                          borderRadius: "6px",
                          fontSize: "11px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="cyber-panel">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="cyber-panel-title text-xs">{t("tradingScore") || "Trading Score"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <svg viewBox="0 0 120 120" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="60" cy="60" r="52" fill="none" strokeWidth="9" className="dark:!stroke-slate-700" style={{ stroke: "var(--score-track, #e2e8f0)" }} />
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        strokeWidth="9"
                        strokeLinecap="round"
                        style={{
                          stroke:
                            zellaScore.total >= 80
                              ? "#22c55e"
                              : zellaScore.total >= 60
                                ? "#22d3ee"
                                : zellaScore.total >= 40
                                  ? "#f59e0b"
                                  : "#f43f5e",
                          strokeDasharray: `${zellaScore.total * 3.267} 326.7`,
                          transition: "stroke-dasharray 0.8s ease",
                        }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold text-slate-900 dark:text-white">{zellaScore.total}</span>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400">/ 100</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    {zellaScore.metrics.slice(0, 3).map((metric, i) => {
                      const colors = ["#22d3ee", "#22c55e", "#a78bfa"];
                      return (
                        <div key={metric.subject}>
                          <div className="flex justify-between text-[9px] mb-0.5">
                            <span className="text-slate-600 dark:text-slate-400 truncate">{metric.subject}</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{Math.round(metric.value)}</span>
                          </div>
                          <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                            <div
                              className="h-1 rounded-full"
                              style={{ width: `${metric.value}%`, backgroundColor: colors[i], transition: "width 0.6s ease" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cyber-panel">
              <CardHeader className="pb-2">
                <CardTitle className="cyber-panel-title text-xs">{t("currentStreak")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{t("streakDirection")}</p>
                    <p
                      className={`text-xl font-bold ${activeStreakType === "Win" ? "text-emerald-500" : activeStreakType === "Loss" ? "text-rose-500" : "text-slate-700 dark:text-slate-200"}`}
                    >
                      {activeStreakType === "Win"
                        ? `${activeStreakCount}W`
                        : activeStreakType === "Loss"
                          ? `${activeStreakCount}L`
                          : "0"}
                    </p>
                  </div>
                  <div
                    className={`rounded-full p-2 ${activeStreakType === "Win" ? "bg-emerald-500/15" : activeStreakType === "Loss" ? "bg-rose-500/15" : "bg-slate-500/10"}`}
                  >
                    {activeStreakType === "Loss" ? (
                      <TrendingDown className="w-4 h-4 text-rose-500" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-2">
                    <p className="text-[10px] text-cyan-700 dark:text-cyan-300">{t("maxWins")}</p>
                    <p className="text-base font-semibold text-cyan-800 dark:text-cyan-200">{filteredMaxWinStreak}</p>
                  </div>
                  <div className="rounded-md border border-rose-500/20 bg-rose-500/5 p-2">
                    <p className="text-[10px] text-rose-700 dark:text-rose-300">{t("maxLosses")}</p>
                    <p className="text-base font-semibold text-rose-800 dark:text-rose-200">{filteredMaxLossStreak}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cyber-panel">
              <CardHeader className="pb-2">
                <CardTitle className="cyber-panel-title text-xs">{t("dailyNetCumulativePL")}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden p-2 pt-0">
                <div className="w-full overflow-hidden h-[160px]">
                  {dailyCumulativeData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">{t("noData") || "—"}</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyCumulativeData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                        <defs>
                          <linearGradient id="plCumFillCyber" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="date" stroke={axisColor} tick={{ fontSize: 9, fill: axisColor }} />
                        <YAxis
                          stroke={axisColor}
                          tick={{ fill: axisColor, fontSize: 9 }}
                          width={40}
                          domain={[
                            (dataMin) => Math.floor(dataMin - Math.abs(dataMin * 0.1 || 10)),
                            (dataMax) => Math.ceil(dataMax + Math.abs(dataMax * 0.1 || 10)),
                          ]}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? "#0f172a" : "#fff",
                            border: `1px solid ${isDark ? "#22d3ee44" : "#cbd5e1"}`,
                            borderRadius: "6px",
                            fontSize: "11px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="pl"
                          stroke="#22d3ee"
                          fill="url(#plCumFillCyber)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card
              className="cyber-panel cursor-pointer hover:border-cyan-500/30 transition-colors"
              onClick={() => setExpandedMetric(expandedMetric === "outcome" ? null : "outcome")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="cyber-panel-title text-xs">{t("outcomeDistribution")}</CardTitle>
                {expandedMetric === "outcome" ? (
                  <ChevronUp className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                )}
              </CardHeader>
              <CardContent className="overflow-hidden p-2 pt-0">
                <div className="w-full h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                      <Pie
                        data={outcomeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        innerRadius={32}
                        outerRadius={54}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {outcomeData.map((entry, index) => (
                          <Cell
                            key={`left-outcome-pie-${index}`}
                            fill={
                              index === 0
                                ? "#22d3ee"
                                : index === 1
                                  ? "#fb923c"
                                  : "#94a3b8"
                            }
                            stroke={isDark ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.9)"}
                            strokeWidth={1}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? "#0f172a" : "#fff",
                          border: `1px solid ${isDark ? "rgba(34,211,238,0.35)" : "#cbd5e1"}`,
                          borderRadius: "6px",
                          fontSize: "11px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="cyber-panel">
              <CardHeader className="pb-2">
                <CardTitle className="cyber-panel-title text-xs">{t("tradeTimePerformance")}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden p-2 pt-0">
                <div className="w-full h-[160px]">
                  {tradeTimeData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">{t("noData") || "—"}</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                        <defs>
                          <clipPath id="scatter-clip-cyber-left">
                            <rect x="0" y="0" width="100%" height="100%" />
                          </clipPath>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="hour" stroke={axisColor} tick={{ fill: axisColor, fontSize: 9 }} domain={[0, 23]} ticks={[0, 4, 8, 12, 16, 20, 23]} />
                        <YAxis dataKey="pl" stroke={axisColor} tick={{ fill: axisColor, fontSize: 9 }} width={36} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? "#0f172a" : "#fff",
                            border: `1px solid ${isDark ? "rgba(34,211,238,0.35)" : "#cbd5e1"}`,
                            borderRadius: "6px",
                            fontSize: "11px",
                          }}
                        />
                        <Scatter data={tradeTimeData} fill="#22d3ee" clipPath="url(#scatter-clip-cyber-left)">
                          {tradeTimeData.map((entry, index) => (
                            <Cell key={`sc-left-${index}`} fill={tradePnLBarColor(entry.pl)} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="cyber-col cyber-col-center space-y-3 min-w-0">
            <div className="cyber-hero">
              <h2 className="cyber-hero-heading tracking-[0.2em] uppercase">{t("dashboard")}</h2>
              <p className="cyber-hero-sub text-[11px] mt-1">{t("overviewOfYourTradingPerformance")}</p>
            </div>

            <Card className="cyber-panel cyber-panel-hero">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-slate-900 dark:text-cyan-100 text-sm md:text-base font-semibold">
                      {(() => {
                        const monthYearLabel = format(calendarDate, "LLLL yyyy", { locale: dateLocale });
                        return monthYearLabel.charAt(0).toUpperCase() + monthYearLabel.slice(1);
                      })()}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={handlePrevMonth} className="h-8 w-8 p-0 cyber-btn-outline">
                        <ChevronUp className="w-4 h-4" style={{ transform: "rotate(90deg)" }} />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setCalendarDate(new Date())} className="h-8 px-2 text-xs cyber-btn-outline">
                        {t("today")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleNextMonth} className="h-8 w-8 p-0 cyber-btn-outline">
                        <ChevronDown className="w-4 h-4" style={{ transform: "rotate(-90deg)" }} />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t("account")}:</span>
                      <div className="relative" ref={calendarAccountRef}>
                        <Button
                          variant="outline"
                          className="relative w-44 md:w-48 text-xs h-8 px-2 justify-center cyber-btn-outline"
                          onClick={() => setCalendarAccountOpen((prev) => !prev)}
                        >
                          <span className="truncate text-center w-full">{dashboardAccountLabel || t("allAccounts")}</span>
                          <ChevronDown className="absolute right-2 w-3 h-3 opacity-70" />
                        </Button>
                        {calendarAccountOpen && (
                          <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                            <Button
                              variant="ghost"
                              className={`w-full justify-between text-xs ${dashboardAccounts.includes("all") ? "bg-slate-100 dark:bg-slate-700" : ""}`}
                              onClick={() => {
                                toggleDashboardAccount("all");
                              }}
                            >
                              <span className="truncate">{t("allAccounts")}</span>
                              <span
                                className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${dashboardAccounts.includes("all") ? "border-cyan-500 bg-cyan-500" : "border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-muted/50"}`}
                              >
                                {dashboardAccounts.includes("all") && (
                                  <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </span>
                            </Button>
                            {activeAccounts.map((acc) => {
                              const isActive = dashboardAccounts.includes(String(acc.id));
                              return (
                                <Button
                                  key={acc.id}
                                  variant="ghost"
                                  className={`w-full justify-between text-xs ${isActive ? "bg-slate-100 dark:bg-slate-700" : ""}`}
                                  onClick={() => {
                                    toggleDashboardAccount(String(acc.id));
                                  }}
                                >
                                  <span className="truncate">{acc.name}</span>
                                  <span
                                    className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${isActive ? "border-cyan-500 bg-cyan-500" : "border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-muted/50"}`}
                                  >
                                    {isActive && (
                                      <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                        <path
                                          fillRule="evenodd"
                                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                          clipRule="evenodd"
                                        />
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
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t("year")}:</span>
                      <div className="relative" ref={yearSelectorRef}>
                        <Button variant="outline" size="sm" className="h-8 px-2 text-xs cyber-btn-outline" onClick={() => setYearSelectorOpen(!yearSelectorOpen)}>
                          {calendarDate.getFullYear()}
                          <ChevronDown className="w-3 h-3 ml-1" />
                        </Button>
                        {yearSelectorOpen && (
                          <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-card border rounded-md shadow-lg p-1">
                            {[
                              calendarDate.getFullYear() - 2,
                              calendarDate.getFullYear() - 1,
                              calendarDate.getFullYear(),
                              calendarDate.getFullYear() + 1,
                              calendarDate.getFullYear() + 2,
                            ].map((year) => (
                              <button
                                key={year}
                                onClick={() => {
                                  setCalendarDate(new Date(year, calendarDate.getMonth(), 1));
                                  setYearSelectorOpen(false);
                                }}
                                className={`w-full px-3 py-1 text-sm text-left hover:bg-accent ${calendarDate.getFullYear() === year ? "bg-accent font-semibold" : ""}`}
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
                  <div className="lg:col-span-2 min-w-0">
                    <div className="mb-3 grid grid-cols-12 gap-1">
                      {[...Array(12)].map((_, i) => {
                        const monthDate = new Date(calendarDate.getFullYear(), i, 1);
                        const monthName = format(monthDate, "MMM", { locale: dateLocale });
                        const isCurrentMonth = i === calendarDate.getMonth();
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleMonthChange(i)}
                            className={`text-center text-[10px] sm:text-xs py-1.5 rounded font-medium transition-colors ${
                              isCurrentMonth
                                ? "bg-cyan-600 text-white shadow-[0_0_12px_rgba(34,211,238,0.35)]"
                                : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                            }`}
                          >
                            {monthName}
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                      {[t("monday"), t("tuesday"), t("wednesday"), t("thursday"), t("friday"), t("saturday"), t("sunday")].map((day) => (
                        <div key={day} className="text-center text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-cyan-700/80">
                          {day}
                        </div>
                      ))}
                      {calendarDays.map((day, index) => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const dayTrades = tradesByDate[dateStr] || [];
                        const isCurrentMonth = isSameMonth(day, calendarDate);
                        const isTodayDay = isToday(day);
                        const totalPLDay = dayTrades.reduce((sum, tr) => sum + (getTradeRealizedPL(tr) ?? 0), 0);
                        const isSelected = selectedCalendarDate && format(selectedCalendarDate, "yyyy-MM-dd") === dateStr;
                        return (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setSelectedCalendarDate(day)}
                            className={`mini-calendar-day ${!isCurrentMonth ? "mini-calendar-outside" : ""} ${isTodayDay ? "mini-calendar-today" : ""} ${isSelected ? "ring-2 ring-cyan-500 shadow-[0_0_12px_rgba(34,211,238,0.25)]" : ""}`}
                          >
                            <div className="text-xs font-medium">{format(day, "d")}</div>
                            {dayTrades.length > 0 && (
                              <div className={`mt-1 text-[10px] font-semibold ${totalPLDay >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {totalPLDay >= 0 ? "+" : ""}
                                {totalPLDay.toFixed(0)}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="cyber-day-panel rounded-xl p-3 border min-h-[200px]">
                    <div className="text-xs font-semibold text-slate-600 dark:text-cyan-200/90 mb-2">
                      {selectedCalendarDate ? format(selectedCalendarDate, "PPP", { locale: dateLocale }) : t("selectDay")}
                    </div>
                    <div className="space-y-2 max-h-72 overflow-auto">
                      {(selectedCalendarDate ? tradesByDate[format(selectedCalendarDate, "yyyy-MM-dd")] || [] : []).map((trade) => (
                        <div key={trade.id} className="cyber-day-trade rounded-lg p-2 border">
                          <div className="flex items-center justify-between gap-2 min-h-10">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-slate-800 dark:text-white truncate text-sm">{trade.symbol}</div>
                              <div className="text-[11px] leading-none mt-1 text-slate-500 dark:text-slate-400">{formatTradeClock(trade, "entry") || trade.open_time || trade.time || "--:--"}</div>
                            </div>
                            <div className="flex items-center self-center gap-2.5 shrink-0">
                              <span
                                className={`inline-block min-w-[90px] text-right tabular-nums leading-none font-semibold text-sm ${(getTradeRealizedPL(trade) ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                              >
                                {(getTradeRealizedPL(trade) ?? 0) >= 0 ? "+" : ""}
                                {(getTradeRealizedPL(trade) ?? 0).toFixed(2)}
                              </span>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => handleViewTrade(trade)}
                                className="h-6 w-6 p-0 self-center text-cyan-500 hover:text-cyan-300 hover:bg-slate-800/80"
                                aria-label="Podgląd transakcji"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!selectedCalendarDate || (tradesByDate[format(selectedCalendarDate, "yyyy-MM-dd")] || []).length === 0) && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">{t("noTradesThisDay")}</div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cyber-panel">
              <CardHeader className="pb-2">
                <CardTitle className="cyber-panel-title text-xs">{t("backtestChartMonthly")}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden p-2 pt-0">
                <div className="w-full h-[180px]">
                  {monthlyStackData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">{t("noData") || "—"}</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyStackData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis dataKey="label" stroke={axisColor} tick={{ fontSize: 10, fill: axisColor }} />
                        <YAxis stroke={axisColor} tick={{ fontSize: 10, fill: axisColor }} width={44} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? "#0f172a" : "#fff",
                            border: `1px solid ${isDark ? "#22d3ee44" : "#cbd5e1"}`,
                            borderRadius: "6px",
                            fontSize: "11px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "10px" }} />
                        <Bar dataKey="winPl" stackId="m" fill="#22d3ee" name={t("wins")} radius={[0, 0, 0, 0]} />
                        <Bar dataKey="lossPl" stackId="m" fill="#64748b" name={t("losses")} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* P&L w czasie — pod aktywnością wg miesiąca, treść wyrównana do lewej; prawa kolumna bez zmian */}
            <div className="w-full text-left self-stretch">
              <Card className="cyber-panel w-full">
                <CardHeader className="pb-2 pt-3 px-3 sm:px-4 space-y-3 items-start text-left">
                  <CardTitle className="cyber-panel-title text-xs w-full text-left">{t("plOverTime")}</CardTitle>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:justify-start">
                    <Select value={plChartFilter} onValueChange={(value) => { setPlChartFilter(value); setPlChartValue("all"); }}>
                      <SelectTrigger className="w-full sm:w-40 h-9 text-xs justify-start">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("all")}</SelectItem>
                        <SelectItem value="account">{t("account")}</SelectItem>
                        <SelectItem value="strategy">{t("strategy")}</SelectItem>
                        <SelectItem value="symbol">{t("symbol")}</SelectItem>
                        <SelectItem value="direction">{t("direction")}</SelectItem>
                        <SelectItem value="outcome">{t("outcome")}</SelectItem>
                      </SelectContent>
                    </Select>

                    {plChartFilter !== "all" && (
                      <Select value={plChartValue} onValueChange={setPlChartValue}>
                        <SelectTrigger className="w-full sm:w-48 h-9 text-xs justify-start">
                          <SelectValue placeholder={t("selectPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t("all")}</SelectItem>
                          {plChartFilter === "account" && activeAccounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                          ))}
                          {plChartFilter === "strategy" && strategies.map((str) => (
                            <SelectItem key={str.id} value={str.id}>{str.name}</SelectItem>
                          ))}
                          {plChartFilter === "symbol" && uniqueSymbols.map((sym) => (
                            <SelectItem key={sym} value={sym}>{sym}</SelectItem>
                          ))}
                          {plChartFilter === "direction" && uniqueDirections.map((dir) => (
                            <SelectItem key={dir} value={dir}>{directionLabel(dir, t)}</SelectItem>
                          ))}
                          {plChartFilter === "outcome" && uniqueOutcomes.map((out) => (
                            <SelectItem key={out} value={out}>{out}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="overflow-hidden p-2 sm:p-3 pt-0">
                  <div className="w-full overflow-hidden">
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={plOverTime} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="trade" stroke={axisColor} tick={{ fill: axisColor, fontSize: 10 }} />
                        <YAxis
                          stroke={axisColor}
                          tick={{ fill: axisColor, fontSize: 10 }}
                          width={48}
                          domain={[(dataMin) => Math.floor(dataMin - Math.abs(dataMin * 0.1 || 10)), (dataMax) => Math.ceil(dataMax + Math.abs(dataMax * 0.1 || 10))]}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: isDark ? "#0f172a" : "#fff",
                            border: `1px solid ${isDark ? "rgba(34,211,238,0.35)" : "#cbd5e1"}`,
                            borderRadius: "8px",
                            color: isDark ? "#e2e8f0" : "#1e293b",
                          }}
                          itemStyle={{ color: isDark ? "#e2e8f0" : "#1e293b" }}
                          labelStyle={{ color: isDark ? "#f1f5f9" : "#0f172a" }}
                        />
                        <Line type="monotone" dataKey="pl" stroke="#22d3ee" strokeWidth={2} dot={{ fill: "#22d3ee", r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Średnie, transakcje (rozkład wyników — lewa kolumna pod skumulowanym dziennym) */}
            <div className="cyber-stat-strip w-full">
              <Card className="cyber-stat-tile cyber-stat-win">
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="cyber-stat-label flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-lime-600 dark:text-lime-400" />
                    {t("averageWin")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4 px-4">
                  <div className="text-2xl font-bold tabular-nums cyber-stat-value-win">+{avgWin}</div>
                </CardContent>
              </Card>

              <Card className="cyber-stat-tile cyber-stat-loss">
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="cyber-stat-label flex items-center gap-2">
                    <TrendingDown className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
                    {t("averageLoss")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4 px-4">
                  <div className="text-2xl font-bold tabular-nums cyber-stat-value-loss">{avgLoss}</div>
                </CardContent>
              </Card>

              <Card className="cyber-stat-tile cyber-stat-count">
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="cyber-stat-label flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    {t("totalTradesLabel")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4 px-4">
                  <div className="text-2xl font-bold tabular-nums cyber-stat-value-cyan">{totalTrades}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                    {wins}
                    {t("winsShort")} / {losses}
                    {t("lossesShort")} / {breakeven}
                    {t("breakevenShort")}
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <aside className="cyber-col cyber-col-right space-y-3 min-w-0">
            <div className="grid grid-cols-2 gap-2">
              <div className="cyber-gauge">
                <div
                  className="cyber-gauge-ring"
                  style={{
                    background: `conic-gradient(var(--cyber-accent) ${winRateGauge}%, hsl(var(--border)) 0)`,
                  }}
                />
                <div className="cyber-gauge-label">
                  <span className="cyber-gauge-value">{winRate}%</span>
                  <span className="cyber-gauge-cap">{t("winRate")}</span>
                </div>
              </div>
              <div className="cyber-gauge">
                <div
                  className="cyber-gauge-ring"
                  style={{
                    background: `conic-gradient(#a78bfa ${pfGauge}%, hsl(var(--border)) 0)`,
                  }}
                />
                <div className="cyber-gauge-label">
                  <span className="cyber-gauge-value">{profitFactor}</span>
                  <span className="cyber-gauge-cap">{t("profitFactor")}</span>
                </div>
              </div>
            </div>

            <Card className="cyber-panel">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="cyber-panel-title text-xs">{t("netDailyPL")}</CardTitle>
                <div className="relative" ref={rangeFilterChartRef}>
                  <Button
                    variant="outline"
                    type="button"
                    className="relative w-20 justify-center text-[10px] h-8 cyber-btn-outline px-1"
                    onClick={() => setRangeFilterOpen((prev) => !prev)}
                  >
                    <span className="truncate text-center w-full pr-3">{dashboardRangeLabel || t('allTime')}</span>
                    <ChevronDown className="absolute right-1 w-3 h-3 opacity-70" />
                  </Button>
                  {rangeFilterOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                      <Button
                        variant="ghost"
                        type="button"
                        className={`w-full justify-between text-xs ${dashboardRanges.includes("all") ? "bg-slate-100 dark:bg-slate-700" : ""}`}
                        onClick={() => {
                          toggleDashboardRange("all");
                        }}
                      >
                        <span>{t('allTime')}</span>
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full border-[2px] ${dashboardRanges.includes("all") ? "border-cyan-500 bg-cyan-500" : "border-slate-400"}`}
                        >
                          {dashboardRanges.includes("all") && (
                            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </span>
                      </Button>
                      <Button
                        variant="ghost"
                        type="button"
                        className={`w-full justify-between text-xs ${dashboardRanges.includes("7d") ? "bg-slate-100 dark:bg-slate-700" : ""}`}
                        onClick={() => {
                          toggleDashboardRange("7d");
                        }}
                      >
                        <span>7d</span>
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full border-[2px] ${dashboardRanges.includes("7d") ? "border-cyan-500 bg-cyan-500" : "border-slate-400"}`}
                        >
                          {dashboardRanges.includes("7d") && (
                            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </span>
                      </Button>
                      <Button
                        variant="ghost"
                        type="button"
                        className={`w-full justify-between text-xs ${dashboardRanges.includes("30d") ? "bg-slate-100 dark:bg-slate-700" : ""}`}
                        onClick={() => {
                          toggleDashboardRange("30d");
                        }}
                      >
                        <span>30d</span>
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full border-[2px] ${dashboardRanges.includes("30d") ? "border-cyan-500 bg-cyan-500" : "border-slate-400"}`}
                        >
                          {dashboardRanges.includes("30d") && (
                            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </span>
                      </Button>
                      <Button
                        variant="ghost"
                        type="button"
                        className={`w-full justify-between text-xs ${dashboardRanges.includes("90d") ? "bg-slate-100 dark:bg-slate-700" : ""}`}
                        onClick={() => {
                          toggleDashboardRange("90d");
                        }}
                      >
                        <span>90d</span>
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full border-[2px] ${dashboardRanges.includes("90d") ? "border-cyan-500 bg-cyan-500" : "border-slate-400"}`}
                        >
                          {dashboardRanges.includes("90d") && (
                            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </span>
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="overflow-hidden p-2 pt-0">
                <div className="w-full h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyPLData} barSize={12} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="date" stroke={axisColor} tick={{ fill: axisColor, fontSize: 9 }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis stroke={axisColor} tick={{ fill: axisColor, fontSize: 9 }} width={36} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? "#0f172a" : "#fff",
                          border: `1px solid ${isDark ? "#22d3ee44" : "#cbd5e1"}`,
                          borderRadius: "6px",
                          fontSize: "11px",
                        }}
                      />
                      <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
                        {dailyPLData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={tradePnLBarColor(entry.pl)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="cyber-panel">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="cyber-panel-title text-xs">{t("recentTrades")}</CardTitle>
                <div className="relative" ref={recentTradesAccountRef}>
                  <Button
                    variant="outline"
                    className="relative w-32 text-[10px] h-8 px-1 justify-center cyber-btn-outline"
                    onClick={() => setRecentTradesAccountOpen((prev) => !prev)}
                  >
                    <span className="truncate text-center w-full pr-3">{dashboardAccountLabel || t("allAccounts")}</span>
                    <ChevronDown className="absolute right-1 w-3 h-3 opacity-70" />
                  </Button>
                  {recentTradesAccountOpen && (
                    <div className="absolute left-0 top-full mt-1 z-50 w-32 rounded-md border bg-popover p-1 text-popover-foreground shadow-md max-h-48 overflow-y-auto">
                      <Button
                        variant="ghost"
                        className={`w-full justify-between text-[10px] ${dashboardAccounts.includes("all") ? "bg-slate-100 dark:bg-slate-700" : ""}`}
                        onClick={() => {
                          toggleDashboardAccount("all");
                        }}
                      >
                        <span className="truncate">{t("allAccounts")}</span>
                        <span
                          className={`ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[2px] ${dashboardAccounts.includes("all") ? "border-cyan-500 bg-cyan-500" : "border-slate-400"}`}
                        >
                          {dashboardAccounts.includes("all") && (
                            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </span>
                      </Button>
                      {activeAccounts.map((acc) => {
                        const isActive = dashboardAccounts.includes(String(acc.id));
                        return (
                          <Button
                            key={acc.id}
                            variant="ghost"
                            className={`w-full justify-between text-[10px] ${isActive ? "bg-slate-100 dark:bg-slate-700" : ""}`}
                            onClick={() => {
                              toggleDashboardAccount(String(acc.id));
                            }}
                          >
                            <span className="truncate">{acc.name}</span>
                            <span
                              className={`ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[2px] ${isActive ? "border-cyan-500 bg-cyan-500" : "border-slate-400"}`}
                            >
                              {isActive && (
                                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
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
                <div className="overflow-x-auto max-h-[220px] overflow-y-auto text-[11px]">
                  <table className="w-full">
                    <thead className="cyber-table-head border-b sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-2 py-1.5 font-semibold">{t("date")}</th>
                        <th className="text-left px-2 py-1.5 font-semibold">{t("symbol")}</th>
                        <th className="text-right px-2 py-1.5 font-semibold">{t("netPL")}</th>
                        <th className="text-center px-2 py-1.5 font-semibold w-8">{t("actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTradesTable.map((trade) => (
                        <tr key={trade.id} className="cyber-table-row border-b">
                          <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{fmtDate(trade.date) || "-"}</td>
                          <td className="px-2 py-1.5 font-medium text-slate-900 dark:text-white">{trade.symbol || "-"}</td>
                          <td
                            className={`px-2 py-1.5 font-semibold text-right ${(getTradeRealizedPL(trade) ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                          >
                            {trade.status === "Planned" || trade.profit_loss == null
                              ? "-"
                              : `${(getTradeRealizedPL(trade) ?? 0) >= 0 ? "+" : ""}${(getTradeRealizedPL(trade) ?? 0).toFixed(2)}`}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleViewTrade(trade)}
                              className="h-6 w-6 hover:bg-cyan-500/10"
                              title={t("viewDetails") || "View"}
                            >
                              <Eye className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="cyber-panel">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="cyber-panel-title text-xs">{t("accountBalance")}</CardTitle>
                  <div className="relative" ref={accountBalanceFilterRef}>
                    <Button
                      variant="outline"
                      className="relative w-28 justify-center text-[10px] h-8 cyber-btn-outline px-1"
                      onClick={() => setAccountBalanceFilterOpen((prev) => !prev)}
                    >
                      <span className="truncate text-center w-full pr-3">{selectedAccountBalanceLabel}</span>
                      <ChevronDown className="absolute right-1 w-3 h-3 opacity-70" />
                    </Button>
                    {accountBalanceFilterOpen && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                        <Button
                          variant="ghost"
                          className={`w-full justify-between text-[10px] ${accountBalanceAccount === "all" ? "bg-slate-100 dark:bg-slate-700" : ""}`}
                          onClick={() => {
                            setAccountBalanceAccount("all");
                            setAccountBalanceFilterOpen(false);
                          }}
                        >
                          <span className="truncate">{t("allAccounts")}</span>
                          <span
                            className={`ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[2px] ${accountBalanceAccount === "all" ? "border-cyan-500 bg-cyan-500" : "border-slate-400"}`}
                          >
                            {accountBalanceAccount === "all" && (
                              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </span>
                        </Button>
                        {activeAccounts.map((acc) => {
                          const isActive = String(accountBalanceAccount) === String(acc.id);
                          return (
                            <Button
                              key={acc.id}
                              variant="ghost"
                              className={`w-full justify-between text-[10px] ${isActive ? "bg-slate-100 dark:bg-slate-700" : ""}`}
                              onClick={() => {
                                setAccountBalanceAccount(String(acc.id));
                                setAccountBalanceFilterOpen(false);
                              }}
                            >
                              <span className="truncate">{acc.name}</span>
                              <span
                                className={`ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[2px] ${isActive ? "border-cyan-500 bg-cyan-500" : "border-slate-400"}`}
                              >
                                {isActive && (
                                  <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
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
              <CardContent className="overflow-hidden p-2 pt-0">
                <div className="w-full h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={accountBalanceOverTime} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="trade" stroke={axisColor} tick={{ fill: axisColor, fontSize: 9 }} />
                      <YAxis
                        stroke={axisColor}
                        tick={{ fill: axisColor, fontSize: 9 }}
                        width={36}
                        domain={[
                          (dataMin) => Math.floor(dataMin - Math.abs(dataMin * 0.1 || 10)),
                          (dataMax) => Math.ceil(dataMax + Math.abs(dataMax * 0.1 || 10)),
                        ]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? "#0f172a" : "#fff",
                          border: `1px solid ${isDark ? "#22d3ee44" : "#cbd5e1"}`,
                          borderRadius: "6px",
                          fontSize: "11px",
                        }}
                      />
                      <Line type="monotone" dataKey="pl" stroke="#22d3ee" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="cyber-panel">
              <CardHeader className="pb-2">
                <CardTitle className="cyber-panel-title text-xs">{t("drawdown")}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden p-2 pt-0">
                <div className="w-full h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={drawdownData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                      <defs>
                        <clipPath id="drawdown-clip-cyber">
                          <rect x="0" y="0" width="100%" height="100%" />
                        </clipPath>
                        <linearGradient id="ddFillCyber" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="trade" stroke={axisColor} tick={{ fill: axisColor, fontSize: 9 }} />
                      <YAxis stroke={axisColor} tick={{ fill: axisColor, fontSize: 9 }} width={36} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? "#0f172a" : "#fff",
                          border: `1px solid ${isDark ? "#22d3ee44" : "#cbd5e1"}`,
                          borderRadius: "6px",
                          fontSize: "11px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="drawdown"
                        stroke="#f43f5e"
                        fill="url(#ddFillCyber)"
                        strokeWidth={2}
                        dot={false}
                        clipPath="url(#drawdown-clip-cyber)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
{/* Expanded Metric Details */}
        <AnimatePresence>
          {expandedMetric === 'pl' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Card className="bg-white dark:bg-muted bordo:bg-[#1f1018] shadow-xl border border-blue-200 dark:border-slate-700 bordo:border-[#8b2347]">
                <CardHeader>
                  <CardTitle className="text-blue-700 dark:text-blue-400 bordo:text-[#d97597]">{t('detailedPLAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <p className="text-xs text-green-700 mb-1">{t('totalProfit')}</p>
                      <p className="text-xl font-bold text-green-600">+{winningTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0).toFixed(2)}</p>
                      <p className="text-xs text-green-600 mt-1">{winningTrades.length} {t('wins')}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                      <p className="text-xs text-red-700 mb-1">{t('totalLoss')}</p>
                      <p className="text-xl font-bold text-red-600">{losingTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0).toFixed(2)}</p>
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
              <Card className="bg-white dark:bg-muted bordo:bg-[#1f1018] shadow-xl border border-blue-200 dark:border-slate-700 bordo:border-[#8b2347]">
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
              <Card className="bg-white dark:bg-muted bordo:bg-[#1f1018] shadow-xl border border-blue-200 dark:border-slate-700 bordo:border-[#8b2347]">
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
                        +{(() => { const m = winningTrades.sort((a,b) => (getTradeRealizedPL(a) ?? 0) - (getTradeRealizedPL(b) ?? 0))[Math.floor(winningTrades.length/2)]; return (getTradeRealizedPL(m) ?? 0).toFixed(2); })()}
                      </p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <p className="text-xs text-orange-700 mb-1">{t('medianLoss')}</p>
                      <p className="text-xl font-bold text-orange-600">
                        {(() => { const m = losingTrades.sort((a,b) => (getTradeRealizedPL(a) ?? 0) - (getTradeRealizedPL(b) ?? 0))[Math.floor(losingTrades.length/2)]; return (getTradeRealizedPL(m) ?? 0).toFixed(2); })()}
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-xs text-slate-700 mb-2 font-semibold">{t('avgPLByDirection')}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded border border-slate-200">
                        <p className="text-xs text-slate-600 mb-1">{t('longLabel')}</p>
                        <p className={`text-lg font-bold ${(longTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0) / longTrades.length) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {((longTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0) / longTrades.length) || 0).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-slate-500">{longTrades.length} {t('trades')}</p>
                      </div>
                      <div className="bg-white p-3 rounded border border-slate-200">
                        <p className="text-xs text-slate-600 mb-1">{t('shortLabel')}</p>
                        <p className={`text-lg font-bold ${(shortTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0) / shortTrades.length) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {((shortTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0) / shortTrades.length) || 0).toFixed(2)}
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
              <Card className="bg-white dark:bg-muted bordo:bg-[#1f1018] shadow-xl border border-blue-200 dark:border-slate-700 bordo:border-[#8b2347]">
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
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis dataKey="name" stroke={axisColor} tick={{ fill: axisColor }} />
                          <YAxis stroke={axisColor} tick={{ fill: axisColor }} width={50} />
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

        {/* Expanded Outcome Details */}
        <AnimatePresence>
          {expandedMetric === 'outcome' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <Card className="bg-white dark:bg-muted bordo:bg-[#1f1018] shadow-xl border border-blue-200 dark:border-slate-700 bordo:border-[#8b2347]">
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

        {/* Best & Worst Trades — styl jak reszta paneli cyber */}
        {bestTrade && worstTrade && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <Card className="cyber-trade-card cyber-trade-card--best border-0 shadow-none">
              <CardHeader className="pb-2 pt-5 px-4">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="cyber-panel-title text-xs flex items-center gap-2 font-semibold">
                    <TrendingUp className="w-3.5 h-3.5 text-lime-600 dark:text-cyan-400 shrink-0" />
                    {t("bestTrade")}
                  </CardTitle>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleViewTrade(bestTrade)}
                    className="h-8 w-8 shrink-0 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-500"
                    aria-label={t("viewDetails")}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4 pt-0">
                <div className="flex justify-between items-baseline gap-3">
                  <span className="text-lg font-bold text-slate-900 dark:text-white truncate">{bestTrade.symbol}</span>
                  <span className="text-lg font-bold tabular-nums cyber-trade-pl-best shrink-0">
                    +{(getTradeRealizedPL(bestTrade) ?? 0).toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  {bestTrade.date}
                  {bestTrade.strategy ? ` • ${bestTrade.strategy}` : ""}
                </p>
                {bestTrade.notes && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-2 border-t border-slate-200/60 dark:border-cyan-500/15 pt-2">
                    {bestTrade.notes.slice(0, 100)}
                    {bestTrade.notes.length > 100 ? "…" : ""}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="cyber-trade-card cyber-trade-card--worst border-0 shadow-none">
              <CardHeader className="pb-2 pt-5 px-4">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="cyber-panel-title text-xs flex items-center gap-2 font-semibold">
                    <TrendingDown className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400 shrink-0" />
                    {t("worstTrade")}
                  </CardTitle>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleViewTrade(worstTrade)}
                    className="h-8 w-8 shrink-0 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-500"
                    aria-label={t("viewDetails")}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4 pt-0">
                <div className="flex justify-between items-baseline gap-3">
                  <span className="text-lg font-bold text-slate-900 dark:text-white truncate">{worstTrade.symbol}</span>
                  <span className="text-lg font-bold tabular-nums cyber-trade-pl-worst shrink-0">
                    {(getTradeRealizedPL(worstTrade) ?? 0).toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  {worstTrade.date}
                  {worstTrade.strategy ? ` • ${worstTrade.strategy}` : ""}
                </p>
                {worstTrade.lessons_learned && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-2 border-t border-slate-200/60 dark:border-cyan-500/15 pt-2">
                    {worstTrade.lessons_learned.slice(0, 100)}
                    {worstTrade.lessons_learned.length > 100 ? "…" : ""}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Trade Dialog */}
        <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
          <DialogContent
            className="max-w-6xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto gap-0 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-0"
            {...preventDialogDismissProps}
            onEscapeKeyDown={(event) => event.preventDefault()}
          >
            <div className="sticky top-0 z-10 bg-white dark:bg-card px-4 py-3 pr-12 border-b border-border">
              <DialogTitle>{t('addTrade')}</DialogTitle>
            </div>
            <div className="p-4">
              <TradeFormNew
                embedded
                onSuccess={() => {
                  refetch();
                  setShowAddForm(false);
                }}
                onClose={() => setShowAddForm(false)}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Trade Dialog */}
        <Dialog open={editingTrade !== null} onOpenChange={() => setEditingTrade(null)}>
          <DialogContent
            className="max-w-6xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto gap-0 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-0"
            {...preventDialogDismissProps}
          >
            <div className="sticky top-0 z-10 bg-white dark:bg-card px-4 py-3 pr-12 border-b border-border">
              <DialogTitle>Edit Trade</DialogTitle>
            </div>
            <div className="p-4">
              {editingTrade && (
                <TradeFormNew
                  key={editingTrade.id}
                  embedded
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
          <DialogContent className="max-w-6xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto gap-0 p-0 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700">
            <DialogHeader className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 text-white px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <DialogTitle className="text-white text-xl font-bold">Trade Details</DialogTitle>
            </DialogHeader>
            <div className="p-6 bg-white dark:bg-card">
              {selectedTrade && (
                <TradeDetailView
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