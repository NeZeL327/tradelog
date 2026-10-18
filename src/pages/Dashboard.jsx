import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/lib/AuthContext';
import { getTrades, getTradingAccounts, getStrategies } from '@/lib/localStorage';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, preventDialogDismissProps } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import TradePreviewPanel from "../components/TradePreviewPanel";
import DashboardReview from "../components/DashboardReview";
import { goToTradeDetails } from "@/lib/tradeDetailsNav";
import { useLanguage } from "@/components/LanguageProvider";
import { usePnlDisplay } from "@/hooks/use-pnl-display";
import { directionLabel, getActiveAccountIds, getTradeRealizedPL, isClosedTrade, isTradingAccountActive, normalizeDirection, tradeBelongsToActiveAccount, tradeOutcomeChartColor } from "@/lib/utils";
import { formatTradeDate, getDateFormat, getTradeEntryHour } from "@/lib/userSettings";
import { CHART } from "@/lib/chartTheme";
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
  const pnl = usePnlDisplay();
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
  // ?date=YYYY-MM-DD (from the Calendar) counts as a manual pick and wins over the latest-trade default.
  const [dateParamDay] = useState(() => {
    const raw = new URLSearchParams(window.location.search).get("date") || "";
    const day = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : null;
    return day && !Number.isNaN(day.getTime()) ? day : null;
  });
  const [calendarDate, setCalendarDate] = useState(() => (dateParamDay ? startOfMonth(dateParamDay) : new Date()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => dateParamDay || new Date());
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

  // Default day = latest date with a closed trade in the current filters; today when there is none.
  // Re-applied when the account filter or data changes, until the user picks a day or month.
  const userPickedDayRef = useRef(Boolean(dateParamDay));
  const latestTradeKey = Object.keys(tradesByDate).sort().pop() || "";
  useEffect(() => {
    if (isLoading || userPickedDayRef.current) return;
    const day = new Date(`${latestTradeKey || localTodayKey()}T12:00:00`);
    if (Number.isNaN(day.getTime())) return;
    setSelectedCalendarDate(day);
    setCalendarDate(new Date(day.getFullYear(), day.getMonth(), 1));
  }, [isLoading, latestTradeKey]);
  const pickCalendarDay = (day) => {
    userPickedDayRef.current = true;
    setSelectedCalendarDate(day);
  };

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
    userPickedDayRef.current = true;
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    userPickedDayRef.current = true;
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
    <div className="ref-skin w-full px-0 py-1 text-foreground">
      <DashboardReview
        language={language}
        t={t}
        pnl={pnl}
        range={dashboardRanges[0] || "all"}
        onRange={toggleDashboardRange}
        months={availableMonths}
        selectedMonth={selectedMonth}
        onMonth={selectDashboardMonth}
        onClearMonth={clearDashboardMonth}
        metrics={{
          totalPL,
          winPLSum,
          lossPLSum,
          totalTrades,
          wins,
          losses,
          winRate,
          profitFactor,
          avgPL,
          periodChangePct,
          periodCompareLabel,
        }}
        equity={dailyCumulativeData}
        calendarDate={calendarDate}
        selectedDate={selectedCalendarDate}
        calendarDays={calendarDays}
        tradesByDate={tradesByDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onSelectDay={pickCalendarDay}
        closedTrades={closedTrades}
        setups={setupStats}
        bestTrade={bestTrade}
        worstTrade={worstTrade}
        onOpenTrade={handleViewTrade}
      />

      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent
          className="max-w-6xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto gap-0 border border-ds-frame bg-popover p-0 text-ds-text"
          {...preventDialogDismissProps}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <div className="sticky top-0 z-10 border-b border-ds-line bg-popover px-4 py-3 pr-12">
            <DialogTitle>{t("addTrade")}</DialogTitle>
          </div>
          <div className="p-4">
            <Suspense fallback={<div className="py-10 text-center text-sm text-ds-text2">…</div>}>
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
  );
}
