import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/lib/AuthContext';
import { getTrades, getTradingAccounts, getStrategies } from '@/lib/localStorage';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, preventDialogDismissProps } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TrendingUp, TrendingDown, Calendar, Eye, EyeOff, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Filter, CalendarRange, Wallet } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter, ReferenceDot } from "recharts";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import TradePreviewPanel from "../components/TradePreviewPanel";
import { goToTradeDetails } from "@/lib/tradeDetailsNav";
import { useLanguage } from "@/components/LanguageProvider";
import { directionLabel, getActiveAccountIds, getTradeRealizedPL, isClosedTrade, isTradingAccountActive, normalizeDirection, tradeBelongsToActiveAccount, tradeOutcomeChartColor, tradePnLBarColor } from "@/lib/utils";
import { formatTradeDate, formatTradeClock, getDateFormat, getTradeEntryHour } from "@/lib/userSettings";
import { CHART, chartTooltipStyle, chartGridProps, chartLegendStyle, chartSeriesProps } from "@/lib/chartTheme";
import { SkeletonKpiRow, SkeletonBlock } from "@/components/ui/skeleton-block";

const TradeFormNew = lazy(() => import("../components/TradeFormNew"));

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
        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-muted text-muted-foreground"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-sm font-semibold text-foreground">{MONTHS_PL[view.month]} {view.year}</span>
        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-muted text-muted-foreground"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_PL.map(d => <div key={d} className="py-0.5 text-center text-[10px] font-medium text-muted-foreground">{d}</div>)}
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
                isFrom || isTo ? "bg-primary text-primary-foreground font-semibold" : "",
                inRange ? "bg-primary/15 text-foreground rounded-none" : "",
                isNow && !isFrom && !isTo ? "font-bold text-primary" : "",
                !isFrom && !isTo && !inRange ? "text-foreground hover:bg-muted" : "",
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

  const gridColor = CHART.grid;
  const axisColor = CHART.axis;
  const dashboardFiltersStorageKey = `dashboard_filters_v2_${user?.id || 'guest'}`;
  const dateLocale = language === "pl" ? pl : enUS;
  const dayLocale = language === "pl" ? "pl-PL" : "en-US";
  const hasLoadedDashboardFilters = useRef(false);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
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
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());
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
  const [plHidden, setPlHidden] = useState(() => {
    try {
      return localStorage.getItem("dashboard_pl_hidden") === "1";
    } catch {
      return false;
    }
  });

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
  const queryClient = useQueryClient();
  const { data: trades = [], isLoading, refetch } = useQuery({
    queryKey: ['trades', user?.id],
    queryFn: () => getTrades(user?.id),
    enabled: !!user?.id,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: () => getTradingAccounts(user?.id),
    enabled: !!user?.id,
  });

  const activeAccounts = accounts.filter(isTradingAccountActive);
  const activeAccountIds = getActiveAccountIds(accounts);
  const tradesFromActiveAccounts = trades.filter((trade) =>
    tradeBelongsToActiveAccount(trade, activeAccountIds)
  );

  useEffect(() => {
    const validIds = getActiveAccountIds(accounts);
    setDashboardAccounts((prev) => {
      if (prev.includes("all")) return prev.length === 1 ? prev : ["all"];
      const sanitized = prev.filter((id) => validIds.has(String(id)));
      if (sanitized.length === prev.length) return prev;
      return sanitized.length ? sanitized : ["all"];
    });
  }, [accounts]);

  const { data: strategies = [] } = useQuery({
    queryKey: ['strategies', user?.id],
    queryFn: () => getStrategies(user?.id),
    enabled: !!user?.id,
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
  const todayPL = dayTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0);
  const avgWinLossRatio = Math.abs(Number(avgLoss)) > 0 ? Math.abs(Number(avgWin) / Number(avgLoss)).toFixed(2) : (Number(avgWin) > 0 ? "∞" : "0");

  const winRateRing = Math.min(parseFloat(winRate) || 0, 100);
  const pfRing = Math.min((parseFloat(profitFactor) || 0) / 3 * 100, 100);
  const dayWinRing = Math.min(parseFloat(dayWinRate) || 0, 100);
  const winAbs = Math.abs(Number(avgWin)) || 0;
  const lossAbs = Math.abs(Number(avgLoss)) || 0;
  const winBarPct = winAbs + lossAbs > 0 ? (winAbs / (winAbs + lossAbs)) * 100 : 50;

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
  // Dashboard reference always shows Mon–Sun (7 columns)
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
      { name: t('longLabel'), value: longCount, color: CHART.long },
      { name: t('shortLabel'), value: shortCount, color: CHART.short },
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

  const setupStats = (() => {
    const map = {};
    closedTrades.forEach((tr) => {
      const strategy = strategies.find((s) => String(s.id) === String(tr.strategy_id));
      const name = strategy?.name || tr.strategy || t("noStrategy") || "—";
      if (!map[name]) map[name] = { name, wins: 0, decided: 0, count: 0, pl: 0 };
      map[name].count += 1;
      map[name].pl += getTradeRealizedPL(tr) ?? 0;
      if (tr.outcome === "Win" || tr.outcome === "Loss") {
        map[name].decided += 1;
        if (tr.outcome === "Win") map[name].wins += 1;
      }
    });
    return Object.values(map)
      .map((row) => ({
        ...row,
        winRate: row.decided ? Math.round((row.wins / row.decided) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count || b.winRate - a.winRate);
  })();

  const sessionBreakdown = (() => {
    const buckets = [
      { key: "asia", label: language === "pl" ? "Azja" : "Asia", pl: 0, count: 0 },
      { key: "london", label: language === "pl" ? "Londyn" : "London", pl: 0, count: 0 },
      { key: "ny", label: language === "pl" ? "Nowy Jork" : "New York", pl: 0, count: 0 },
      { key: "other", label: language === "pl" ? "Inne" : "Other", pl: 0, count: 0 },
    ];
    const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
    const resolveSession = (tr) => {
      const raw = String(tr.session || "").toLowerCase();
      if (raw.includes("asia") || raw.includes("azja") || raw.includes("tokyo")) return "asia";
      if (raw.includes("london") || raw.includes("londyn") || raw.includes("frankfurt")) return "london";
      if (raw.includes("new york") || raw.includes("ny") || raw.includes("nowy")) return "ny";
      const hour = getTradeEntryHour(tr);
      if (hour == null) return "other";
      if (hour >= 0 && hour < 8) return "asia";
      if (hour >= 8 && hour < 13) return "london";
      if (hour >= 13 && hour < 22) return "ny";
      return "other";
    };
    closedTrades.forEach((tr) => {
      const key = resolveSession(tr);
      byKey[key].pl += getTradeRealizedPL(tr) ?? 0;
      byKey[key].count += 1;
    });
    const maxAbs = Math.max(...buckets.map((b) => Math.abs(b.pl)), 1);
    return buckets.map((b) => ({ ...b, barPct: Math.round((Math.abs(b.pl) / maxAbs) * 100) }));
  })();

  const dashboardCurrency = (() => {
    if (!dashboardAccounts.includes("all") && dashboardAccounts.length === 1) {
      return activeAccounts.find((a) => String(a.id) === String(dashboardAccounts[0]))?.currency || "";
    }
    const currencies = [...new Set(activeAccounts.map((a) => a.currency).filter(Boolean))];
    return currencies.length === 1 ? currencies[0] : "";
  })();

  // Period-over-period deltas for comparable windows only (never invent values)
  const periodDelta = (() => {
    if (closedTrades.length === 0) return null;
    let prevFrom = "";
    let prevTo = "";
    if (selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)) {
      const [y, m] = selectedMonth.split("-").map(Number);
      const prev = new Date(y, m - 2, 1);
      const prevYm = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
      const bounds = monthBounds(prevYm);
      prevFrom = bounds.from;
      prevTo = bounds.to;
    } else if (dateRange.from && dateRange.to && dateRange.from !== dateRange.to) {
      const from = new Date(`${dateRange.from}T00:00:00`);
      const to = new Date(`${dateRange.to}T00:00:00`);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return null;
      const spanDays = Math.round((to - from) / 86400000) + 1;
      const prevEnd = new Date(from);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - (spanDays - 1));
      prevFrom = toDateKey(prevStart);
      prevTo = toDateKey(prevEnd);
    } else if (dateRange.from && dateRange.from === dateRange.to) {
      const d = new Date(`${dateRange.from}T00:00:00`);
      if (Number.isNaN(d.getTime())) return null;
      d.setDate(d.getDate() - 1);
      prevFrom = toDateKey(d);
      prevTo = prevFrom;
    } else if (!dateRange.from) {
      const selectedRange = dashboardRanges[0] || "all";
      if (["7d", "30d", "90d"].includes(selectedRange) && rangeStartKey) {
        const days = selectedRange === "7d" ? 7 : selectedRange === "90d" ? 90 : 30;
        const start = new Date(`${rangeStartKey}T00:00:00`);
        if (Number.isNaN(start.getTime())) return null;
        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - (days - 1));
        prevFrom = toDateKey(prevStart);
        prevTo = toDateKey(prevEnd);
      } else if (selectedRange === "all") {
        // Equivalent prior window = same span as first→last trade date in current filter
        const keys = closedTrades.map((tr) => toDateKey(tr.date)).filter(Boolean).sort();
        if (keys.length < 2) return null;
        const first = new Date(`${keys[0]}T00:00:00`);
        const last = new Date(`${keys[keys.length - 1]}T00:00:00`);
        if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return null;
        const spanDays = Math.round((last - first) / 86400000) + 1;
        if (spanDays < 2) return null;
        const prevEnd = new Date(first);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - (spanDays - 1));
        prevFrom = toDateKey(prevStart);
        prevTo = toDateKey(prevEnd);
      } else {
        return null;
      }
    } else {
      return null;
    }
    const prevTrades = tradesFromActiveAccounts.filter((tr) => {
      if (!isClosedTrade(tr)) return false;
      if (!(dashboardAccounts.includes("all") || dashboardAccounts.includes(String(tr.account_id)))) return false;
      const key = toDateKey(tr.date);
      return key && key >= prevFrom && key <= prevTo;
    });
    if (prevTrades.length === 0) return null;
    const prevPL = prevTrades.reduce((sum, tr) => sum + (getTradeRealizedPL(tr) ?? 0), 0);
    const prevWins = prevTrades.filter((tr) => tr.outcome === "Win").length;
    const prevLosses = prevTrades.filter((tr) => tr.outcome === "Loss").length;
    const prevDecided = prevWins + prevLosses;
    const prevWinRate = prevDecided > 0 ? (prevWins / prevDecided) * 100 : null;
    const prevWinPL = prevTrades.filter((tr) => tr.outcome === "Win").reduce((s, tr) => s + (getTradeRealizedPL(tr) ?? 0), 0);
    const prevLossPL = prevTrades.filter((tr) => tr.outcome === "Loss").reduce((s, tr) => s + (getTradeRealizedPL(tr) ?? 0), 0);
    const prevPF = Math.abs(prevLossPL) > 0 ? prevWinPL / Math.abs(prevLossPL) : null;
    const prevAvg = prevTrades.length > 0 ? prevPL / prevTrades.length : null;
    const curPF = profitFactor === "∞" ? null : parseFloat(profitFactor);
    return {
      plPct: Math.abs(prevPL) >= 0.01 ? ((totalPL - prevPL) / Math.abs(prevPL)) * 100 : null,
      winRatePp: prevWinRate != null ? parseFloat(winRate) - prevWinRate : null,
      pfDelta: prevPF != null && curPF != null && Number.isFinite(curPF) ? curPF - prevPF : null,
      avgDelta: prevAvg != null ? Number(avgPL) - prevAvg : null,
      tradesPct: prevTrades.length > 0 ? ((totalTrades - prevTrades.length) / prevTrades.length) * 100 : null,
    };
  })();
  const periodChangePct = periodDelta?.plPct ?? null;
  const periodCompareLabel = (() => {
    if (periodChangePct == null) return "";
    if (selectedMonth) return t("vsPrevMonth");
    const range = dashboardRanges[0] || "all";
    if (range === "7d") return t("vsPrev7Days");
    if (range === "90d") return t("vsPrev90Days");
    if (range === "30d") return t("vsPrev30Days");
    return t("vsPrevPeriod");
  })();
  const equityLastPoint = dailyCumulativeData.length
    ? dailyCumulativeData[dailyCumulativeData.length - 1]
    : null;
  // Tight Y domain so curve isn't flattened in a wide chart
  const equityYDomain = (() => {
    if (!dailyCumulativeData.length) return [0, 100];
    const vals = dailyCumulativeData.map((d) => Number(d.pl)).filter(Number.isFinite);
    if (!vals.length) return [0, 100];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = Math.max(max - min, 40);
    const pad = span * 0.06;
    const step = span > 800 ? 100 : span > 300 ? 50 : 25;
    return [
      Math.floor((min - pad) / step) * step,
      Math.ceil((max + pad) / step) * step,
    ];
  })();
  const equityShowDots = dailyCumulativeData.length > 0 && dailyCumulativeData.length <= 18;

  // Journal fill rate (days with trades in last 30) — separate from zella "consistency" trade-volume score
  const journalDaysWindow = 30;
  const journalDaysFilled = (() => {
    const keys = new Set();
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < journalDaysWindow; i += 1) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const key = toDateKey(d);
      if ((tradesByDate[key] || []).length > 0) keys.add(key);
    }
    return keys.size;
  })();
  const journalFillPct = Math.round((journalDaysFilled / journalDaysWindow) * 100);
  const journalFillDeltaPp = (() => {
    // Compare last 30 days fill rate vs previous 30 days (real data only)
    const countFilled = (offsetStart) => {
      let n = 0;
      const base = new Date();
      base.setHours(0, 0, 0, 0);
      for (let i = offsetStart; i < offsetStart + journalDaysWindow; i += 1) {
        const d = new Date(base);
        d.setDate(d.getDate() - i);
        const key = toDateKey(d);
        if ((tradesByDate[key] || []).length > 0) n += 1;
      }
      return n;
    };
    const prevFilled = countFilled(journalDaysWindow);
    if (prevFilled === 0 && journalDaysFilled === 0) return null;
    const prevPct = Math.round((prevFilled / journalDaysWindow) * 100);
    return journalFillPct - prevPct;
  })();
  const setupPlMax = Math.max(...setupStats.slice(0, 5).map((r) => Math.abs(r.pl)), 1);
  const currentStreakDisplay =
    activeStreakType === "Win"
      ? `${activeStreakCount}W`
      : activeStreakType === "Loss"
        ? `${activeStreakCount}L`
        : "—";

  if (isLoading) {
    return (
      <div className="w-full mx-auto space-y-6 dashboard-surface py-2">
        <SkeletonKpiRow />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <SkeletonBlock rows={6} className="rounded-lg border border-border" />
          <SkeletonBlock rows={8} className="rounded-lg border border-border xl:col-span-1" />
          <SkeletonBlock rows={6} className="rounded-lg border border-border" />
        </div>
      </div>
    );
  }

  return (
    <div className="dash-scr min-h-screen w-full bg-transparent dashboard-surface">
      <div className="mx-auto w-full space-y-2 pb-3">
        {/* Header + compact filters (no duplicate Add Trade — use top bar) */}
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 shrink-0">
            <h1 className="cyber-page-title mb-0.5 leading-tight">{t("dashboard")}</h1>
            <p className="dash-page-sub">{t("overviewOfYourTradingPerformance")}</p>
          </div>
          <div className="flex flex-wrap items-center justify-start gap-1.5 xl:justify-end">
              {/* Month first — matches SCR filter order */}
              <div className="relative order-1" ref={monthFilterRef}>
                <button
                  type="button"
                  onClick={() => {
                    setMonthFilterOpen((prev) => !prev);
                    setRangeFilterOpen(false);
                    setDatePickerOpen(false);
                  }}
                  className={`dash-ctrl relative flex min-w-[9rem] items-center justify-center border px-2.5 hover:bg-accent ${
                    selectedMonth
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border"
                  }`}
                >
                  <Calendar className="absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
                  <span className="w-full truncate px-5 text-center">
                    {selectedMonth
                      ? monthLabel(selectedMonth, language)
                      : (language === "pl" ? "Miesiąc" : "Month")}
                  </span>
                  <ChevronDown className="absolute right-2 h-3.5 w-3.5 opacity-50" />
                </button>
                {monthFilterOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-[220px] overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                    <button
                      type="button"
                      onClick={clearDashboardMonth}
                      className={`flex w-full items-center justify-between rounded px-3 py-2 text-sm hover:bg-accent ${!selectedMonth ? "bg-accent" : ""}`}
                    >
                      <span>{language === "pl" ? "Wszystkie miesiące" : "All months"}</span>
                      {!selectedMonth && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border-[3px] border-primary bg-primary">
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </button>
                    {availableMonths.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
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
                            className={`flex w-full items-center justify-between rounded px-3 py-2 text-sm hover:bg-accent ${isSelected ? "bg-accent" : ""}`}
                          >
                            <span>{monthLabel(ym, language)}</span>
                            {isSelected && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full border-[3px] border-primary bg-primary">
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

              <div className="relative order-2 min-w-[8.5rem] sm:min-w-0" ref={accountDropdownRef}>
                <button
                  onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                  className="dash-ctrl relative flex w-full items-center justify-center border border-border px-2.5 hover:bg-muted/40 sm:w-[160px] md:w-[180px]"
                >
                  <Wallet className="absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
                  <span className="w-full truncate px-5 text-center">{dashboardAccountLabel || t("allAccounts")}</span>
                  <ChevronDown className="absolute right-2 h-3.5 w-3.5 opacity-50" />
                </button>
                {accountDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border bg-popover p-1 shadow-md max-h-64 overflow-y-auto">
                    <button
                      onClick={() => { toggleDashboardAccount('all'); }}
                      className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${dashboardAccounts.includes('all') ? 'bg-accent' : ''}`}
                    >
                      <span className="truncate">{t('allAccounts')}</span>
                      <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${dashboardAccounts.includes('all') ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
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
                        <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
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

              <div className="dash-ctrl order-3 flex items-center gap-0.5 border border-border p-0.5" ref={rangeFilterMainRef}>
                {[
                  {
                    key: "1d",
                    label: t("today") || "Dziś",
                    onClick: () => {
                      const day = localTodayKey();
                      setSelectedMonth("");
                      setDashboardRanges(["all"]);
                      setDateRange({ from: day, to: day });
                      setRangeFilterOpen(false);
                      setMonthFilterOpen(false);
                      setDatePickerOpen(false);
                    },
                    active: !!dateRange.from && dateRange.from === dateRange.to && dateRange.from === localTodayKey(),
                  },
                  { key: "7d", label: "7D", onClick: () => toggleDashboardRange("7d"), active: !dateRange.from && dashboardRanges[0] === "7d" },
                  { key: "30d", label: "30D", onClick: () => toggleDashboardRange("30d"), active: !dateRange.from && dashboardRanges[0] === "30d" },
                  { key: "90d", label: "90D", onClick: () => toggleDashboardRange("90d"), active: !dateRange.from && dashboardRanges[0] === "90d" },
                  { key: "all", label: t("allTime") || "Cały okres", onClick: () => toggleDashboardRange("all"), active: !dateRange.from && !selectedMonth && dashboardRanges[0] === "all" },
                ].map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onClick}
                    className={`dash-period-chip transition-colors ${
                      chip.active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    title={t("filters")}
                    aria-label={t("filters")}
                    className="dash-ctrl order-4 w-8 shrink-0 border-border p-0"
                  >
                    <Filter className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" side="bottom" className="w-[min(420px,calc(100vw-1.5rem))] p-4">
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">{t('symbol')}</div>
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
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${filterSymbols.includes('all') ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
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
                              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
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
                      <div className="text-xs text-muted-foreground mb-2">{t('direction')}</div>
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
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${filterDirections.includes('all') ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
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
                              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
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
                      <div className="text-xs text-muted-foreground mb-2">{t('outcome')}</div>
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
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${filterOutcomes.includes('all') ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
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
                              <span className={`flex h-5 w-5 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
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

              <div className="relative order-5" ref={datePickerRef}>
                <button
                  type="button"
                  onClick={() => {
                    setDatePickerOpen((prev) => !prev);
                    setMonthFilterOpen(false);
                    setRangeFilterOpen(false);
                  }}
                  title={language === "pl" ? "Zakres dat" : "Date range"}
                  aria-label={language === "pl" ? "Zakres dat" : "Date range"}
                  className={`dash-ctrl relative flex w-8 items-center justify-center border transition-colors ${
                    dateRange.from
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                </button>
                {datePickerOpen && (
                  <div className="absolute left-0 z-50 mt-2 max-w-[calc(100vw-1.5rem)] rounded-lg border border-border bg-popover p-3 shadow-md sm:left-auto sm:right-0">
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
                      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                        <span className="data-mono text-[11px] text-muted-foreground">
                          {dateRange.from && dateRange.to
                            ? `${dateRange.from.split("-").reverse().join(".")} – ${dateRange.to.split("-").reverse().join(".")}`
                            : dateRange.from ? `Od ${dateRange.from.split("-").reverse().join(".")}` : ""}
                        </span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setDateRange({ from: "", to: "" })}
                            className="rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-loss">
                            Wyczyść
                          </button>
                          <button type="button" onClick={() => setDatePickerOpen(false)}
                            className="rounded bg-primary px-3 py-0.5 text-[11px] text-primary-foreground hover:bg-primary/90">
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

        {/* 1) Hero: Netto P&L + equity — compact height, less horizontal stretch */}
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(220px,32%)_minmax(0,1fr)]">
          <Card className="ocean-stat-card flex h-[168px] flex-col">
            <CardContent className="flex h-full flex-col justify-between p-3.5">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {t("netPL") || t("totalPL") || "Netto P&L"}
                  </p>
                  <button
                    type="button"
                    className="rounded-md p-1 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                    aria-label={plHidden ? (t("show") || "Pokaż") : (t("hide") || "Ukryj")}
                    title={plHidden ? (t("show") || "Pokaż") : (t("hide") || "Ukryj")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlHidden((prev) => {
                        const next = !prev;
                        try {
                          localStorage.setItem("dashboard_pl_hidden", next ? "1" : "0");
                        } catch {
                          /* ignore */
                        }
                        return next;
                      });
                    }}
                  >
                    {plHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div
                  data-private
                  className={`data-mono mt-1.5 text-[1.55rem] font-bold leading-none tracking-tight tabular-nums ${
                    plHidden ? "text-muted-foreground" : totalPL >= 0 ? "text-primary" : "text-loss"
                  }`}
                >
                  {plHidden
                    ? "••••••"
                    : `${totalPL >= 0 ? "+" : ""}${totalPL.toFixed(2)}${dashboardCurrency ? ` ${dashboardCurrency}` : ""}`}
                </div>
                <div className="mt-2 space-y-1 text-[12px]">
                  {!plHidden && periodChangePct != null ? (
                    <p className="inline-flex flex-wrap items-center gap-1.5">
                      <span className={periodChangePct >= 0 ? "dash-chip-up inline-flex items-center gap-0.5" : "dash-chip-down inline-flex items-center gap-0.5"}>
                        {periodChangePct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {periodChangePct >= 0 ? "+" : ""}
                        {periodChangePct.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground">{periodCompareLabel}</span>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      {selectedMonth
                        ? monthLabel(selectedMonth, language)
                        : dateRange.from
                          ? `${dateRange.from}${dateRange.to ? ` → ${dateRange.to}` : ""}`
                          : dashboardRangeLabel}
                      {" · "}
                      {totalTrades} {t("trades")}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-1 text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("grossProfit") || "Zysk brutto"}</span>
                  <span className="data-mono font-semibold tabular-nums text-profit">
                    {plHidden
                      ? "••••"
                      : `+${Number(winPLSum).toFixed(2)}${dashboardCurrency ? ` ${dashboardCurrency}` : ""}`}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("grossLoss") || "Strata brutto"}</span>
                  <span className="data-mono font-semibold tabular-nums text-loss">
                    {plHidden
                      ? "••••"
                      : `${Number(lossPLSum).toFixed(2)}${dashboardCurrency ? ` ${dashboardCurrency}` : ""}`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cyber-panel flex h-[168px] flex-col overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-1.5">
              <CardTitle className="dash-panel-title">
                {t("equityCurve") || t("dailyNetCumulativePL") || "Krzywa kapitału"}
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <span className="hidden rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
                  {dashboardAccountLabel || t("allAccounts")}
                </span>
                <span className="rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {t("dailyChart")}
                </span>
                {equityLastPoint && !plHidden ? (
                  <span
                    className={`data-mono rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                      Number(equityLastPoint.pl) >= 0 ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss"
                    }`}
                  >
                    {Number(equityLastPoint.pl) >= 0 ? "+" : ""}
                    {Number(equityLastPoint.pl).toFixed(2)}
                  </span>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden px-1.5 pb-1.5 pt-0 sm:px-2">
              <div className="h-full w-full min-h-0 overflow-hidden">
                {dailyCumulativeData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    {t("noData") || "—"}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <AreaChart data={dailyCumulativeData} margin={{ top: 6, right: 10, left: 0, bottom: 2 }}>
                      <defs>
                        <linearGradient id="plCumFillHero" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART.line} stopOpacity={0.28} />
                          <stop offset="95%" stopColor={CHART.line} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis
                        dataKey="date"
                        stroke={axisColor}
                        tick={{ fontSize: 9, fill: axisColor }}
                        tickFormatter={(v) => {
                          const s = String(v || "");
                          // data is MM-DD (or YYYY-MM-DD)
                          const parts = s.split("-");
                          if (parts.length === 2) return `${parts[1]}.${parts[0]}`;
                          if (parts.length === 3) return `${parts[2]}.${parts[1]}`;
                          return s;
                        }}
                        minTickGap={36}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        stroke={axisColor}
                        tick={{ fill: axisColor, fontSize: 9 }}
                        width={40}
                        tickCount={5}
                        domain={equityYDomain}
                      />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Area
                        type="monotone"
                        dataKey="pl"
                        stroke={CHART.line}
                        fill="url(#plCumFillHero)"
                        strokeWidth={2}
                        dot={equityShowDots ? { r: 2.5, fill: CHART.line, strokeWidth: 0 } : false}
                        activeDot={{ r: 4.5, fill: CHART.line, stroke: "hsl(var(--window-bg))", strokeWidth: 2 }}
                        {...chartSeriesProps}
                      />
                      {equityLastPoint ? (
                        <ReferenceDot
                          x={equityLastPoint.date}
                          y={equityLastPoint.pl}
                          r={4}
                          fill={Number(equityLastPoint.pl) >= 0 ? CHART.profit : CHART.loss}
                          stroke="hsl(var(--window-bg))"
                          strokeWidth={2}
                        />
                      ) : null}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 2) KPI row ~70px */}
        <div className="dashboard-kpi-row grid h-auto grid-cols-2 gap-2 lg:min-h-[64px] lg:grid-cols-4 lg:gap-0">
          {[
            {
              key: "winrate",
              label: t("winRate"),
              value: `${winRate}%`,
              sub: `${wins}W / ${losses}L${breakeven > 0 ? ` / ${breakeven}BE` : ""}`,
              tone: "text-foreground",
              delta: periodDelta?.winRatePp,
              deltaFmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)} pp`,
              onClick: () => setExpandedMetric(expandedMetric === "winrate" ? null : "winrate"),
            },
            {
              key: "pf",
              label: t("profitFactor"),
              value: String(profitFactor),
              sub: language === "pl" ? "Zysk / Strata" : t("avgWinAvgLoss"),
              tone: "text-foreground",
              delta: periodDelta?.pfDelta,
              deltaFmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`,
              onClick: () => setExpandedMetric(expandedMetric === "pf" ? null : "pf"),
            },
            {
              key: "avgpl",
              label: t("expectancy") || t("avgPL"),
              value: `${Number(avgPL) >= 0 ? "+" : ""}${avgPL}${dashboardCurrency ? ` ${dashboardCurrency}` : ""}`,
              sub: language === "pl"
                ? `${dashboardCurrency || "PLN"} ${t("perTrade")?.toLowerCase?.() || "na transakcję"}`
                : t("perTrade"),
              tone: Number(avgPL) >= 0 ? "text-profit" : "text-loss",
              delta: periodDelta?.avgDelta,
              deltaFmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`,
              onClick: () => setExpandedMetric(expandedMetric === "avgpl" ? null : "avgpl"),
            },
            {
              key: "count",
              label: t("tradeCount") || t("trades"),
              value: String(totalTrades),
              sub: language === "pl" ? "w wybranym okresie" : "in selected period",
              tone: "text-foreground",
              delta: periodDelta?.tradesPct,
              deltaFmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`,
              onClick: null,
            },
          ].map((kpi) => (
            <Card
              key={kpi.key}
              className={`ocean-stat-card transition-colors ${kpi.onClick ? "cursor-pointer" : ""}`}
              onClick={kpi.onClick || undefined}
            >
              <CardContent className="flex h-full flex-col justify-center px-3.5 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{kpi.label}</p>
                  {kpi.delta != null && Number.isFinite(kpi.delta) ? (
                    <span
                      className={`${kpi.delta >= 0 ? "dash-chip-up" : "dash-chip-down"} inline-flex items-center gap-0.5`}
                      title={t("vsPrevPeriod")}
                    >
                      {kpi.delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {kpi.deltaFmt(kpi.delta)}
                    </span>
                  ) : null}
                </div>
                <div className={`data-mono mt-1 font-bold tabular-nums ${kpi.tone}`}>{kpi.value}</div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{kpi.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 3) Calendar | day details | recent trades */}
        <div className="dash-row-equal grid grid-cols-1 gap-2.5 lg:grid-cols-12 lg:auto-rows-fr">
          <Card className="cyber-panel flex min-h-0 flex-col lg:col-span-5 lg:min-h-[200px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-2">
              <CardTitle className="dash-panel-title">
                {t("tradingCalendar") || "Kalendarz tradingowy"}
              </CardTitle>
              <div className="flex items-center gap-0.5 rounded-lg border border-border/70 bg-[hsl(var(--window-bg))] p-0.5">
                <Button variant="ghost" size="sm" onClick={handlePrevMonth} className="h-6 w-6 p-0">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="data-mono min-w-[7.25rem] text-center text-[11px] font-medium capitalize tabular-nums">
                  {format(calendarDate, "LLLL yyyy", { locale: dateLocale })}
                </span>
                <Button variant="ghost" size="sm" onClick={handleNextMonth} className="h-6 w-6 p-0">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 pb-2.5 pt-0">
              <div className="dash-cal-grid grid flex-1 grid-cols-7 gap-1">
                {(language === "pl"
                  ? ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"]
                  : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
                ).map((day) => (
                  <div key={day} className="pb-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, index) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const list = tradesByDate[dateStr] || [];
                  const isCurrentMonth = isSameMonth(day, calendarDate);
                  const isTodayDay = isToday(day);
                  const totalPLDay = list.reduce((sum, tr) => sum + (getTradeRealizedPL(tr) ?? 0), 0);
                  const isSelected = selectedCalendarDate && format(selectedCalendarDate, "yyyy-MM-dd") === dateStr;
                  const hasTrades = list.length > 0;
                  const winDay = hasTrades && totalPLDay >= 0;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedCalendarDate(day)}
                      title={hasTrades ? `${dateStr}: ${totalPLDay >= 0 ? "+" : ""}${totalPLDay.toFixed(2)}` : dateStr}
                      className={[
                        "dash-cal-day group relative flex flex-col items-center justify-center gap-0.5 rounded-lg text-[12px] font-medium transition-colors",
                        !isCurrentMonth ? "text-muted-foreground/40" : "text-foreground",
                        isSelected
                          ? "bg-primary/20 text-primary ring-1 ring-primary/60"
                          : hasTrades
                            ? winDay
                              ? "bg-profit/10 hover:bg-profit/15"
                              : "bg-loss/10 hover:bg-loss/15"
                            : "hover:bg-primary/10",
                        isTodayDay && !isSelected ? "ring-1 ring-primary/35" : "",
                      ].join(" ")}
                    >
                      <span className="leading-none tabular-nums">{format(day, "d")}</span>
                      {hasTrades ? (
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${winDay ? "bg-profit" : "bg-loss"}`}
                          aria-hidden
                        />
                      ) : (
                        <span className="h-1.5 w-1.5 opacity-0" aria-hidden />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Day details — separate card (not inside calendar) */}
          <Card className="cyber-panel flex min-h-0 flex-col lg:col-span-3 lg:min-h-[200px]">
            <CardHeader className="space-y-0 px-3 py-2">
              <CardTitle className="dash-panel-title">
                {t("dayDetails")}
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">
                {selectedCalendarDate
                  ? format(selectedCalendarDate, "d MMMM yyyy", { locale: dateLocale })
                  : t("selectDay")}
              </p>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-0 text-[11px]">
              {!selectedCalendarDate ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 text-center">
                  <p className="font-medium text-foreground">{t("selectDay")}</p>
                  <p className="text-[10px] text-muted-foreground">{t("clickDayToSee")}</p>
                </div>
              ) : (() => {
                const dayKey = format(selectedCalendarDate, "yyyy-MM-dd");
                const list = tradesByDate[dayKey] || [];
                const dayNet = list.reduce((sum, tr) => sum + (getTradeRealizedPL(tr) ?? 0), 0);
                const dayW = list.filter((tr) => tr.outcome === "Win").length;
                const dayL = list.filter((tr) => tr.outcome === "Loss").length;
                const decided = dayW + dayL;
                const dayWr = decided ? ((dayW / decided) * 100).toFixed(0) : "—";
                const dayWinPL = list.filter((tr) => tr.outcome === "Win").reduce((s, tr) => s + (getTradeRealizedPL(tr) ?? 0), 0);
                const dayLossPL = list.filter((tr) => tr.outcome === "Loss").reduce((s, tr) => s + (getTradeRealizedPL(tr) ?? 0), 0);
                const dayPf = Math.abs(dayLossPL) > 0
                  ? (dayWinPL / Math.abs(dayLossPL)).toFixed(2)
                  : dayWinPL > 0 ? "∞" : "—";
                const sortedDay = [...list].sort(
                  (a, b) => (getTradeRealizedPL(b) ?? 0) - (getTradeRealizedPL(a) ?? 0)
                );
                const best = sortedDay[0];
                const worst = sortedDay[sortedDay.length - 1];
                const dayNoteText = list.map((tr) => tr.notes || tr.note || tr.journal_notes).find(Boolean);
                if (list.length === 0) {
                  return (
                    <div className="flex h-full flex-col justify-center gap-1 rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-4 text-center">
                      <p className="font-medium text-foreground">{t("noTradesThisDay")}</p>
                      <p className="text-[10px] text-muted-foreground">{t("clickDayToSee")}</p>
                    </div>
                  );
                }
                const rows = [
                  {
                    label: t("netPL") || "Netto P&L",
                    value: `${dayNet >= 0 ? "+" : ""}${dayNet.toFixed(2)}`,
                    tone: dayNet >= 0 ? "text-profit" : "text-loss",
                  },
                  { label: t("trades"), value: String(list.length), tone: "text-foreground" },
                  { label: t("winRate"), value: `${dayWr}%`, tone: "text-foreground" },
                  { label: t("profitFactor"), value: String(dayPf), tone: "text-foreground" },
                  best
                    ? {
                        label: t("bestTrade"),
                        value: `${best.symbol} +${(getTradeRealizedPL(best) ?? 0).toFixed(2)}`,
                        tone: "text-profit",
                      }
                    : null,
                  worst && list.length > 1
                    ? {
                        label: t("worstTrade"),
                        value: `${worst.symbol} ${(getTradeRealizedPL(worst) ?? 0).toFixed(2)}`,
                        tone: "text-loss",
                      }
                    : null,
                ].filter(Boolean);
                return (
                  <ul className="space-y-1">
                    {rows.map((row) => (
                      <li key={row.label} className="flex items-center justify-between gap-2 border-b border-border/35 py-1 last:border-0">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className={`data-mono shrink-0 font-semibold tabular-nums ${row.tone}`}>{row.value}</span>
                      </li>
                    ))}
                    {dayNoteText ? (
                      <li className="pt-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("dayNote")}</p>
                        <p className="mt-0.5 line-clamp-2 text-foreground/90">{String(dayNoteText)}</p>
                      </li>
                    ) : null}
                  </ul>
                );
              })()}
            </CardContent>
          </Card>

          {/* Recent trades — separate card */}
          <Card className="cyber-panel flex min-h-0 flex-col lg:col-span-4 lg:min-h-[200px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-2">
              <CardTitle className="dash-panel-title">{t("recentTrades")}</CardTitle>
              <div className="relative" ref={recentTradesAccountRef}>
                <Button
                  variant="ghost"
                  className="relative h-6 max-w-[7.5rem] px-1.5 text-[10px]"
                  onClick={() => setRecentTradesAccountOpen((prev) => !prev)}
                >
                  <span className="truncate">{dashboardAccountLabel || t("allAccounts")}</span>
                  <ChevronDown className="ml-0.5 h-3 w-3 opacity-70" />
                </Button>
                {recentTradesAccountOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1 max-h-48 w-40 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-[11px] hover:bg-accent ${dashboardAccounts.includes("all") ? "bg-accent" : ""}`}
                      onClick={() => toggleDashboardAccount("all")}
                    >
                      <span className="truncate">{t("allAccounts")}</span>
                    </button>
                    {activeAccounts.map((acc) => {
                      const isActive = dashboardAccounts.includes(String(acc.id));
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-[11px] hover:bg-accent ${isActive ? "bg-accent" : ""}`}
                          onClick={() => toggleDashboardAccount(String(acc.id))}
                        >
                          <span className="truncate">{acc.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto px-0 pb-1 pt-0 text-[11px]">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-[hsl(var(--card))]">
                  <tr className="border-b border-border/50 text-[10px] text-muted-foreground">
                    <th className="px-3 py-1 text-left font-semibold">{t("time") || "Czas"}</th>
                    <th className="px-2 py-1 text-left font-semibold">{t("symbol")}</th>
                    <th className="px-3 py-1 text-right font-semibold">{t("direction") || "Kierunek"}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTradesTable.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                        {t("noTradesToDisplay") || t("noData") || "—"}
                      </td>
                    </tr>
                  ) : (
                    recentTradesTable.slice(0, 6).map((trade) => {
                      const dir = normalizeDirection(trade.direction);
                      const isLong = dir === "Long";
                      return (
                        <tr
                          key={trade.id}
                          className="cursor-pointer border-b border-border/30 hover:bg-white/[0.03]"
                          onClick={() => handleViewTrade(trade)}
                        >
                          <td className="data-mono whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                            {formatTradeClock(trade, "entry") || trade.open_time || trade.time || fmtDate(trade.date) || "—"}
                          </td>
                          <td className="px-2 py-1.5 font-medium text-foreground">{trade.symbol || "—"}</td>
                          <td className="px-3 py-1.5 text-right">
                            <span className={`inline-flex items-center gap-0.5 font-semibold uppercase tracking-wide ${isLong ? "text-primary" : "text-loss"}`}>
                              {isLong ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {isLong ? "LONG" : "SHORT"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* 4) Analyses: sessions / setups / journal — equal cards */}
        <div className="dash-row-equal grid grid-cols-1 gap-2.5 md:grid-cols-3">
          <Card className="cyber-panel flex flex-col">
            <CardHeader className="px-3.5 py-2 pb-1">
              <CardTitle className="dash-panel-title">
                {t("sessionResults")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center space-y-2 px-3.5 pb-3 pt-0.5 text-[12px]">
              {sessionBreakdown.map((row) => (
                <div key={row.key} className="grid grid-cols-[5.25rem_1fr_auto] items-center gap-2">
                  <span className="truncate text-muted-foreground">{row.label}</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-primary/15">
                    <div
                      className={`h-full rounded-full ${row.pl >= 0 ? "bg-profit" : "bg-loss"}`}
                      style={{ width: `${Math.max(row.barPct, row.count ? 8 : 0)}%` }}
                    />
                  </div>
                  <span className={`data-mono min-w-[4.5rem] text-right font-semibold tabular-nums ${row.pl >= 0 ? "text-profit" : "text-loss"}`}>
                    {row.pl >= 0 ? "+" : ""}
                    {row.pl.toFixed(0)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="cyber-panel flex flex-col">
            <CardHeader className="px-3.5 py-2 pb-1">
              <CardTitle className="dash-panel-title">
                {t("setupEffectiveness")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-center px-3.5 pb-3 pt-0.5 text-[12px]">
              <div className="mb-1.5 grid grid-cols-[1fr_2rem_2.75rem_minmax(6.5rem,1.25fr)] items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>{t("strategy") || "Setup"}</span>
                <span className="text-right">N</span>
                <span className="text-right">WR</span>
                <span className="text-right">P&L</span>
              </div>
              <div className="space-y-2">
                {setupStats.slice(0, 5).map((row) => {
                  const barPct = Math.max(Math.round((Math.abs(row.pl) / setupPlMax) * 100), row.count ? 14 : 0);
                  return (
                    <div key={row.name} className="grid grid-cols-[1fr_2rem_2.75rem_minmax(6.5rem,1.25fr)] items-center gap-2">
                      <span className="min-w-0 truncate font-medium text-foreground" title={row.name}>{row.name}</span>
                      <span className="data-mono text-right tabular-nums text-muted-foreground">{row.count}</span>
                      <span className="data-mono text-right tabular-nums text-foreground">{row.winRate}%</span>
                      <div className="flex min-w-0 items-center gap-1.5">
                        {/* Bipolar bar: loss ← | → profit (SCR) */}
                        <div className="relative flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-primary/12">
                          <div className="flex w-1/2 justify-end">
                            {row.pl < 0 ? (
                              <div className="h-full rounded-l-full bg-loss" style={{ width: `${barPct}%` }} />
                            ) : null}
                          </div>
                          <div className="flex w-1/2 justify-start">
                            {row.pl >= 0 ? (
                              <div className="h-full rounded-r-full bg-profit" style={{ width: `${barPct}%` }} />
                            ) : null}
                          </div>
                        </div>
                        <span className={`data-mono w-[3.25rem] shrink-0 text-right font-semibold tabular-nums ${row.pl >= 0 ? "text-profit" : "text-loss"}`}>
                          {row.pl >= 0 ? "+" : ""}
                          {row.pl.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {setupStats.length === 0 && (
                  <p className="text-muted-foreground">{t("noData") || "—"}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="cyber-panel flex flex-col">
            <CardHeader className="px-3.5 py-2 pb-1">
              <CardTitle className="dash-panel-title">
                {t("journalRegularity")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 items-center gap-3 px-3.5 pb-3 pt-1">
              <div className="data-mono text-4xl font-bold tabular-nums text-primary">
                {journalFillPct}%
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 text-[12px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  {journalFillDeltaPp != null && journalFillDeltaPp !== 0 ? (
                    <span className={`${journalFillDeltaPp >= 0 ? "dash-chip-up" : "dash-chip-down"} inline-flex items-center gap-0.5`}>
                      {journalFillDeltaPp >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {journalFillDeltaPp >= 0 ? "+" : ""}
                      {journalFillDeltaPp}%
                    </span>
                  ) : null}
                  <span className="text-muted-foreground">
                    {t("daysFilled")}{" "}
                    <span className="font-semibold text-foreground">
                      {journalDaysFilled} {t("of")} {journalDaysWindow}
                    </span>
                  </span>
                </div>
                <div className="flex h-9 items-end gap-0.5" aria-hidden>
                  {(() => {
                    const keys = [];
                    const base = new Date();
                    base.setHours(0, 0, 0, 0);
                    for (let i = 11; i >= 0; i -= 1) {
                      const d = new Date(base);
                      d.setDate(d.getDate() - i);
                      keys.push(toDateKey(d));
                    }
                    const maxCount = Math.max(...keys.map((k) => (tradesByDate[k] || []).length), 1);
                    return keys.map((k) => {
                      const count = (tradesByDate[k] || []).length;
                      const h = count === 0 ? 12 : Math.max(24, Math.round((count / maxCount) * 100));
                      return (
                        <span
                          key={k}
                          className={`w-1.5 rounded-sm ${count > 0 ? "bg-primary/75" : "bg-muted/50"}`}
                          style={{ height: `${h}%` }}
                          title={`${k}: ${count}`}
                        />
                      );
                    });
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary analyses — equal-height columns (no bottom void) */}
        <div className="cyber-columns-grid">
          <aside className="cyber-col cyber-col-left min-w-0">
            {/* Compact 2-up: Long/Short + Trading Score — shorter left column */}
            <div className="grid grid-cols-2 gap-2">
              <Card className="cyber-panel">
                <CardHeader className="px-2 pb-1 pt-2">
                  <CardTitle className="cyber-panel-title text-[10px]">{t("longVsShort")}</CardTitle>
                </CardHeader>
                <CardContent className="p-1.5 pt-0">
                  <div className="h-[100px] w-full">
                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
                      <PieChart>
                        <Pie
                          isAnimationActive={false}
                          data={directionPieData}
                          dataKey="value"
                          innerRadius={24}
                          outerRadius={40}
                          paddingAngle={2}
                        >
                          {directionPieData.map((e, i) => (
                            <Cell key={`dc-${i}`} fill={e.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={chartTooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="cyber-panel">
                <CardHeader className="px-2 pb-1 pt-2">
                  <CardTitle className="cyber-panel-title text-[10px]">{t("tradingScore") || "Trading Score"}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center p-1.5 pt-0">
                  <div className="relative h-[100px] w-[100px]">
                    <svg viewBox="0 0 120 120" className="h-full w-full" style={{ transform: "rotate(-90deg)" }}>
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
                              ? CHART.profit
                              : zellaScore.total >= 60
                                ? CHART.line
                                : zellaScore.total >= 40
                                  ? "hsl(var(--warning))"
                                  : "hsl(var(--loss))",
                          strokeDasharray: `${zellaScore.total * 3.267} 326.7`,
                          transition: "none",
                        }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="data-mono text-lg font-bold text-foreground">{zellaScore.total}</span>
                      <span className="text-[9px] text-muted-foreground">/ 100</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="cyber-panel">
              <CardHeader className="pb-2">
                <CardTitle className="cyber-panel-title text-xs">{t("currentStreak")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t("streakDirection")}</p>
                    <p
                      className={`text-xl font-bold ${activeStreakType === "Win" ? "text-profit" : activeStreakType === "Loss" ? "text-loss" : "text-slate-700 dark:text-slate-200"}`}
                    >
                      {activeStreakType === "Win"
                        ? `${activeStreakCount}W`
                        : activeStreakType === "Loss"
                          ? `${activeStreakCount}L`
                          : "0"}
                    </p>
                  </div>
                  <div
                    className={`rounded-full p-2 ${activeStreakType === "Win" ? "bg-profit/15" : activeStreakType === "Loss" ? "bg-loss/15" : "bg-slate-500/10"}`}
                  >
                    {activeStreakType === "Loss" ? (
                      <TrendingDown className="w-4 h-4 text-loss" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-profit" />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-border bg-muted/40 p-2">
                    <p className="text-[10px] text-muted-foreground">{t("maxWins")}</p>
                    <p className="text-base font-semibold tabular-nums">{filteredMaxWinStreak}</p>
                  </div>
                  <div className="rounded-md border border-loss/20 bg-loss/10 p-2">
                    <p className="text-[10px] text-loss">{t("maxLosses")}</p>
                    <p className="text-base font-semibold text-loss">{filteredMaxLossStreak}</p>
                  </div>
                </div>
                {/* Compact daily P&L spark inside streak — keeps left column shorter */}
                <div className="h-[72px] w-full overflow-hidden" ref={rangeFilterChartRef}>
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <BarChart data={dailyPLData} barSize={6} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                      <Bar dataKey="pl" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                        {dailyPLData.map((entry, index) => (
                          <Cell key={`streak-pl-${index}`} fill={tradePnLBarColor(entry.pl)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cyber-panel cursor-pointer transition-colors"
              onClick={() => setExpandedMetric(expandedMetric === "outcome" ? null : "outcome")}
            >
              <CardHeader className="flex flex-row items-center justify-between px-3 pb-1 pt-2">
                <CardTitle className="cyber-panel-title text-xs">{t("outcomeDistribution")}</CardTitle>
                {expandedMetric === "outcome" ? (
                  <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </CardHeader>
              <CardContent className="overflow-hidden p-2 pt-0">
                <div className="h-[120px] w-full">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <PieChart margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                      <Pie
                        isAnimationActive={false}
                        data={outcomeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        innerRadius={26}
                        outerRadius={44}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {outcomeData.map((entry, index) => (
                          <Cell
                            key={`left-outcome-pie-${index}`}
                            fill={entry.color}
                            stroke="hsl(var(--card))"
                            strokeWidth={1}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="cyber-panel flex min-h-0 flex-1 flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="cyber-panel-title text-xs">{t("tradeTimePerformance")}</CardTitle>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 pt-0">
                <div className="cyber-grow-chart min-h-[160px]">
                  {tradeTimeData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{t("noData") || "—"}</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
                      <ScatterChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                        <defs>
                          <clipPath id="scatter-clip-cyber-left">
                            <rect x="0" y="0" width="100%" height="100%" />
                          </clipPath>
                        </defs>
                        <CartesianGrid {...chartGridProps} />
                        <XAxis dataKey="hour" stroke={axisColor} tick={{ fill: axisColor, fontSize: 9 }} domain={[0, 23]} ticks={[0, 4, 8, 12, 16, 20, 23]} />
                        <YAxis dataKey="pl" stroke={axisColor} tick={{ fill: axisColor, fontSize: 9 }} width={36} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Scatter isAnimationActive={false} data={tradeTimeData} fill={CHART.line} clipPath="url(#scatter-clip-cyber-left)">
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

          <section className="cyber-col cyber-col-center min-w-0">
            <Card className="cyber-panel">
              <CardHeader className="pb-2">
                <CardTitle className="cyber-panel-title text-xs">{t("backtestChartMonthly")}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden p-2 pt-0">
                <div className="w-full h-[180px]">
                  {monthlyStackData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">{t("noData") || "—"}</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
                      <BarChart data={monthlyStackData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                        <CartesianGrid {...chartGridProps} />
                        <XAxis dataKey="label" stroke={axisColor} tick={{ fontSize: 10, fill: axisColor }} />
                        <YAxis stroke={axisColor} tick={{ fontSize: 10, fill: axisColor }} width={44} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Legend wrapperStyle={chartLegendStyle} />
                        <Bar isAnimationActive={false} dataKey="winPl" stackId="m" fill={CHART.line} name={t("wins")} radius={[0, 0, 0, 0]} />
                        <Bar isAnimationActive={false} dataKey="lossPl" stackId="m" fill={CHART.loss} name={t("losses")} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Średnie — compact strip before growing P&L chart */}
            <div className="cyber-stat-strip w-full shrink-0">
              <Card className="cyber-stat-tile cyber-stat-win">
                <CardHeader className="px-3 pb-1 pt-3">
                  <CardTitle className="cyber-stat-label flex items-center gap-1.5 text-[10px]">
                    <TrendingUp className="h-3 w-3 text-profit" />
                    {t("averageWin")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0">
                  <div className="data-mono text-lg font-bold tabular-nums cyber-stat-value-win">+{avgWin}</div>
                </CardContent>
              </Card>

              <Card className="cyber-stat-tile cyber-stat-loss">
                <CardHeader className="px-3 pb-1 pt-3">
                  <CardTitle className="cyber-stat-label flex items-center gap-1.5 text-[10px]">
                    <TrendingDown className="h-3 w-3 text-loss" />
                    {t("averageLoss")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0">
                  <div className="data-mono text-lg font-bold tabular-nums cyber-stat-value-loss">{avgLoss}</div>
                </CardContent>
              </Card>

              <Card className="cyber-stat-tile cyber-stat-count">
                <CardHeader className="px-3 pb-1 pt-3">
                  <CardTitle className="cyber-stat-label flex items-center gap-1.5 text-[10px]">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {t("totalTradesLabel")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 pt-0">
                  <div className="data-mono text-lg font-bold tabular-nums cyber-stat-value-cyan">{totalTrades}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {wins}{t("winsShort")} / {losses}{t("lossesShort")} / {breakeven}{t("breakevenShort")}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* P&L w czasie — grows to fill column bottom */}
            <Card className="cyber-panel flex min-h-0 w-full flex-1 flex-col">
              <CardHeader className="items-start space-y-2 px-3 pb-2 pt-3 text-left sm:px-4">
                <CardTitle className="cyber-panel-title w-full text-left text-xs">{t("plOverTime")}</CardTitle>
                <div className="flex w-full flex-col flex-wrap gap-2 sm:flex-row sm:justify-start">
                  <Select value={plChartFilter} onValueChange={(value) => { setPlChartFilter(value); setPlChartValue("all"); }}>
                    <SelectTrigger className="h-8 w-full justify-start text-xs sm:w-36">
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
                      <SelectTrigger className="h-8 w-full justify-start text-xs sm:w-44">
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
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 pt-0 sm:p-3">
                <div className="cyber-grow-chart min-h-[160px]">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <LineChart data={plOverTime} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis dataKey="trade" stroke={axisColor} tick={{ fill: axisColor, fontSize: 10 }} />
                      <YAxis
                        stroke={axisColor}
                        tick={{ fill: axisColor, fontSize: 10 }}
                        width={48}
                        domain={[(dataMin) => Math.floor(dataMin - Math.abs(dataMin * 0.1 || 10)), (dataMax) => Math.ceil(dataMax + Math.abs(dataMax * 0.1 || 10))]}
                      />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Line type="monotone" dataKey="pl" stroke={CHART.line} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </section>

          <aside className="cyber-col cyber-col-right min-w-0">
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
                    background: `conic-gradient(hsl(var(--primary)) ${pfGauge}%, hsl(var(--border)) 0)`,
                  }}
                />
                <div className="cyber-gauge-label">
                  <span className="cyber-gauge-value">{profitFactor}</span>
                  <span className="cyber-gauge-cap">{t("profitFactor")}</span>
                </div>
              </div>
            </div>

            

            

            <Card className="cyber-panel">
              <CardHeader className="px-3 pb-2 pt-2">
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
                            className={`ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[2px] ${accountBalanceAccount === "all" ? "border-primary bg-primary" : "border-border"}`}
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
                                className={`ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[2px] ${isActive ? "border-primary bg-primary" : "border-border"}`}
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
                <div className="h-[140px] w-full">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <LineChart data={accountBalanceOverTime} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                      <CartesianGrid {...chartGridProps} />
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
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Line type="monotone" dataKey="pl" stroke={CHART.line} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="cyber-panel flex min-h-0 flex-1 flex-col">
              <CardHeader className="px-3 pb-2 pt-2">
                <CardTitle className="cyber-panel-title text-xs">{t("drawdown")}</CardTitle>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 pt-0">
                <div className="cyber-grow-chart min-h-[180px]">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <AreaChart data={drawdownData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                      <defs>
                        <clipPath id="drawdown-clip-cyber">
                          <rect x="0" y="0" width="100%" height="100%" />
                        </clipPath>
                        <linearGradient id="ddFillCyber" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--loss))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--loss))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis dataKey="trade" stroke={axisColor} tick={{ fill: axisColor, fontSize: 9 }} />
                      <YAxis stroke={axisColor} tick={{ fill: axisColor, fontSize: 9 }} width={36} />
                      <Tooltip contentStyle={chartTooltipStyle} />
                      <Area
                        type="monotone"
                        dataKey="drawdown"
                        stroke="hsl(var(--loss))"
                        fill="url(#ddFillCyber)"
                        strokeWidth={1.5}
                        dot={false}
                        clipPath="url(#drawdown-clip-cyber)"
                        {...chartSeriesProps}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
{/* Expanded Metric Details */}
          {expandedMetric === 'pl' && (
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>{t('detailedPLAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-profit/10 p-3 rounded-lg border border-profit/20">
                      <p className="text-xs text-profit mb-1">{t('totalProfit')}</p>
                      <p className="text-xl font-bold text-profit">+{winningTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0).toFixed(2)}</p>
                      <p className="text-xs text-profit mt-1">{winningTrades.length} {t('wins')}</p>
                    </div>
                    <div className="bg-loss/10 p-3 rounded-lg border border-loss/20">
                      <p className="text-xs text-red-700 mb-1">{t('totalLoss')}</p>
                      <p className="text-xl font-bold text-loss">{losingTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0).toFixed(2)}</p>
                      <p className="text-xs text-loss mt-1">{losingTrades.length} {t('losses')}</p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-md border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t('plByWeekday')}</p>
                      <div className="space-y-1 mt-2">
                        {Object.entries(dayPL).map(([day, pl]) => (
                          <div key={day} className="flex justify-between text-xs">
                            <span className="text-slate-600">{day.slice(0, 3)}</span>
                            <span className={pl >= 0 ? 'text-profit font-semibold' : 'text-loss font-semibold'}>
                              {pl >= 0 ? '+' : ''}{pl.toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2 font-semibold">{t('plBySymbol')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(symbolPL).map(([symbol, data]) => (
                        <div key={symbol} className="bg-card p-2 rounded border border-border">
                          <p className="text-xs font-semibold text-foreground">{symbol}</p>
                          <p className={`text-sm font-bold ${data.pl >= 0 ? 'text-profit' : 'text-loss'}`}>
                            {data.pl >= 0 ? '+' : ''}{data.pl.toFixed(0)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{data.wins}/{data.total} ({((data.wins/data.total)*100).toFixed(0)}%)</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {expandedMetric === 'winrate' && (
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>{t('detailedWinRateAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-profit/10 p-3 rounded-lg border border-profit/20">
                      <p className="text-xs text-profit mb-1">{t('wins')}</p>
                      <p className="text-2xl font-bold text-profit">{wins}</p>
                      <p className="text-xs text-profit mt-1">{winRate}% {t('ofAll')}</p>
                    </div>
                    <div className="bg-loss/10 p-3 rounded-lg border border-loss/20">
                      <p className="text-xs text-red-700 mb-1">{t('losses')}</p>
                      <p className="text-2xl font-bold text-loss">{losses}</p>
                      <p className="text-xs text-loss mt-1">{(100 - winRate).toFixed(1)}% {t('ofAll')}</p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-md border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t('streaks')}</p>
                      <div className="space-y-1">
                        <p className="text-sm text-profit font-semibold">{t('maxWins')}: {maxWinStreak}</p>
                        <p className="text-sm text-loss font-semibold">{t('maxLosses')}: {maxLossStreak}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2 font-semibold">{t('winRateBySymbol')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(symbolPL).map(([symbol, data]) => (
                        <div key={symbol} className="bg-card p-2 rounded border border-border">
                          <p className="text-xs font-semibold text-foreground">{symbol}</p>
                          <p className="text-lg font-bold text-foreground">{((data.wins/data.total)*100).toFixed(0)}%</p>
                          <p className="text-[10px] text-muted-foreground">{data.wins}{t('winsShort')} / {data.total - data.wins}{t('lossesShort')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {expandedMetric === 'avgpl' && (
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>{t('detailedAvgPLAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-profit/10 p-3 rounded-lg border border-profit/20">
                      <p className="text-xs text-profit mb-1">{t('avgWinShort')}</p>
                      <p className="text-xl font-bold text-profit">+{avgWin}</p>
                    </div>
                    <div className="bg-loss/10 p-3 rounded-lg border border-loss/20">
                      <p className="text-xs text-red-700 mb-1">{t('avgLossShort')}</p>
                      <p className="text-xl font-bold text-loss">{avgLoss}</p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-md border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t('medianWin')}</p>
                      <p className="text-xl font-bold text-foreground">
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
                  <div className="bg-muted/30 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2 font-semibold">{t('avgPLByDirection')}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-card p-3 rounded border border-border">
                        <p className="text-xs text-muted-foreground mb-1">{t('longLabel')}</p>
                        <p className={`text-lg font-bold ${(longTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0) / longTrades.length) >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {((longTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0) / longTrades.length) || 0).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{longTrades.length} {t('trades')}</p>
                      </div>
                      <div className="bg-card p-3 rounded border border-border">
                        <p className="text-xs text-muted-foreground mb-1">{t('shortLabel')}</p>
                        <p className={`text-lg font-bold ${(shortTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0) / shortTrades.length) >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {((shortTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0) / shortTrades.length) || 0).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{shortTrades.length} {t('trades')}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {expandedMetric === 'pf' && (
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>{t('detailedProfitFactorAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-profit/10 p-3 rounded-lg border border-profit/20">
                      <p className="text-xs text-profit mb-1">{t('totalProfit')}</p>
                      <p className="text-xl font-bold text-profit">+{(avgWin * wins).toFixed(2)}</p>
                      <p className="text-xs text-profit mt-1">{t('from')} {wins} {t('wins')}</p>
                    </div>
                    <div className="bg-loss/10 p-3 rounded-lg border border-loss/20">
                      <p className="text-xs text-red-700 mb-1">{t('totalLoss')}</p>
                      <p className="text-xl font-bold text-loss">{(avgLoss * losses).toFixed(2)}</p>
                      <p className="text-xs text-loss mt-1">{t('from')} {losses} {t('losses')}</p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-md border border-border">
                      <p className="text-xs text-muted-foreground mb-1">{t('profitFactor')}</p>
                      <p className="text-xl font-bold text-foreground">{profitFactor}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {profitFactor >= 2 ? t('pfExcellent') : profitFactor >= 1.5 ? t('pfGood') : profitFactor >= 1 ? t('pfAcceptable') : t('pfNeedsImprovement')}
                      </p>
                    </div>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2 font-semibold">{t('tradeEfficiency')}</p>
                    <div className="w-full overflow-hidden">
                      <ResponsiveContainer width="100%" height={200} debounce={50}>
                        <BarChart data={[
                          { name: t('avgWinShort'), value: parseFloat(avgWin), fill: CHART.profit },
                          { name: t('avgLossShort'), value: Math.abs(parseFloat(avgLoss)), fill: CHART.loss }
                        ]} margin={{ top: 10, right: 20, left: 5, bottom: 5 }}>
                          <defs>
                            <clipPath id="trade-efficiency-clip">
                              <rect x="0" y="0" width="100%" height="100%" />
                            </clipPath>
                          </defs>
                          <CartesianGrid {...chartGridProps} />
                          <XAxis dataKey="name" stroke={axisColor} tick={{ fill: axisColor }} />
                          <YAxis stroke={axisColor} tick={{ fill: axisColor }} width={50} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]} clipPath="url(#trade-efficiency-clip)" isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        {/* Expanded Outcome Details */}
          {expandedMetric === 'outcome' && (
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>{t('detailedOutcomeAnalysis')}</CardTitle>
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
                  <div className="bg-muted/30 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2 font-semibold">{t('distributionByTimeframe')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {['M5', 'M15', 'M30', 'H1', 'H4', 'D1'].map(tf => {
                        const tfTrades = trades.filter(t => t.timeframe === tf);
                        const tfWins = tfTrades.filter(t => t.outcome === 'Win').length;
                        return tfTrades.length > 0 ? (
                          <div key={tf} className="bg-card p-2 rounded border border-border">
                            <p className="text-xs font-semibold text-foreground">{tf}</p>
                            <p className="text-sm font-bold text-foreground">{((tfWins/tfTrades.length)*100).toFixed(0)}%</p>
                            <p className="text-[10px] text-muted-foreground">{tfWins}/{tfTrades.length}</p>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        {/* Best & Worst Trades — styl jak reszta paneli cyber */}
        {bestTrade && worstTrade && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <Card className="cyber-trade-card cyber-trade-card--best border-0 shadow-none">
              <CardHeader className="pb-2 pt-5 px-4">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="cyber-panel-title text-xs flex items-center gap-2 font-semibold">
                    <TrendingUp className="w-3.5 h-3.5 text-profit shrink-0" />
                    {t("bestTrade")}
                  </CardTitle>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleViewTrade(bestTrade)}
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={t("viewDetails")}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4 pt-0">
                <div className="flex justify-between items-baseline gap-3">
                  <span className="text-lg font-bold text-foreground truncate">{bestTrade.symbol}</span>
                  <span className="text-lg font-bold tabular-nums cyber-trade-pl-best shrink-0">
                    +{(getTradeRealizedPL(bestTrade) ?? 0).toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {bestTrade.date}
                  {bestTrade.strategy ? ` • ${bestTrade.strategy}` : ""}
                </p>
                {bestTrade.notes && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2 border-t border-border pt-2">
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
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={t("viewDetails")}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-4 pb-4 pt-0">
                <div className="flex justify-between items-baseline gap-3">
                  <span className="text-lg font-bold text-foreground truncate">{worstTrade.symbol}</span>
                  <span className="text-lg font-bold tabular-nums cyber-trade-pl-worst shrink-0">
                    {(getTradeRealizedPL(worstTrade) ?? 0).toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {worstTrade.date}
                  {worstTrade.strategy ? ` • ${worstTrade.strategy}` : ""}
                </p>
                {worstTrade.lessons_learned && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2 border-t border-border pt-2">
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
            className="max-w-6xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto gap-0 bg-card text-card-foreground p-0"
            {...preventDialogDismissProps}
            onEscapeKeyDown={(event) => event.preventDefault()}
          >
            <div className="sticky top-0 z-10 bg-card px-4 py-3 pr-12 border-b border-border">
              <DialogTitle>{t('addTrade')}</DialogTitle>
            </div>
            <div className="p-4">
              <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">…</div>}>
                <TradeFormNew
                  embedded
                  onSuccess={() => {
                    refetch();
                    setShowAddForm(false);
                  }}
                  onClose={() => setShowAddForm(false)}
                />
              </Suspense>
            </div>
          </DialogContent>
        </Dialog>

        <TradePreviewPanel
          open={selectedTrade !== null}
          trade={selectedTrade}
          trades={tradesFromActiveAccounts}
          strategy={strategies.find((s) => String(s.id) === String(selectedTrade?.strategy_id)) || null}
          onOpenChange={(next) => {
            if (!next) setSelectedTrade(null);
          }}
          onSelectTrade={handleViewTrade}
          onEdit={(tradeToEdit) => {
            if (!tradeToEdit?.id) return;
            setSelectedTrade(null);
            goToTradeDetails(navigate, tradeToEdit, tradesFromActiveAccounts);
          }}
          onPatched={(patch) => {
            setSelectedTrade((prev) => (prev ? { ...prev, ...patch } : prev));
            queryClient.invalidateQueries({ queryKey: ["trades"] });
          }}
        />
      </div>
    </div>
  );
}