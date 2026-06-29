import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from '@/lib/AuthContext';
import { getTrades, deleteTrade, getTradingAccounts, getStrategies } from '@/lib/localStorage';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Clock,
  ArrowUpDown,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CalendarRange
} from "lucide-react";
import { parseISO, isSameDay, isSameWeek, isSameMonth } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, preventDialogDismissProps } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TradeFormNew from "../components/TradeFormNew";
import TradeCard from "../components/TradeCard";
import { useLanguage } from "@/components/LanguageProvider";
import { directionBadgeClass, directionLabel, getTradeRealizedPL, isClosedTrade, tradeStatusBadgeClass, tradeOutcomeBadgeClass, tradeStatusMatchesFilter } from "@/lib/utils";
import ImageViewer from "@/components/common/ImageViewer";
import { formatTradeDate, getDateFormat } from "@/lib/userSettings";

const MONTHS_PL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];
const DAYS_PL = ["Pn","Wt","Śr","Cz","Pt","Sb","Nd"];

function MiniCalendar({ from, to, onSelect }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [view, setView] = useState(() => {
    const base = from ? new Date(from + "T00:00:00") : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  const prevMonth = () => setView(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setView(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });

  const toStr = (d) => `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const firstDow = (() => { const d = new Date(view.year, view.month, 1).getDay(); return d === 0 ? 6 : d - 1; })();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const handleDay = (d) => {
    if (!d) return;
    const s = toStr(d);
    if (!from || (from && to)) {
      onSelect(s, "");
    } else if (s < from) {
      onSelect(s, from);
    } else {
      onSelect(from, s);
    }
  };

  return (
    <div className="w-[224px] select-none">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-cyan-500/10 dark:hover:bg-cyan-500/15 text-slate-500 dark:text-cyan-300/80">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-slate-800 dark:text-cyan-100">
          {MONTHS_PL[view.month]} {view.year}
        </span>
        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-cyan-500/10 dark:hover:bg-cyan-500/15 text-slate-500 dark:text-cyan-300/80">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_PL.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-slate-400 py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const s = toStr(d);
          const isFrom = s === from;
          const isTo = s === to;
          const inRange = from && to && s > from && s < to;
          const isNow = s === todayStr;
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleDay(d)}
              className={[
                "text-xs h-7 w-full rounded transition-colors",
                isFrom || isTo ? "bg-cyan-600 dark:bg-cyan-500 text-white font-semibold" : "",
                inRange ? "bg-cyan-100 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-200 rounded-none" : "",
                isNow && !isFrom && !isTo ? "font-bold text-cyan-600 dark:text-cyan-400" : "",
                !isFrom && !isTo && !inRange ? "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" : "",
              ].join(" ").trim()}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function JournalSimple({ mode = "all" }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isPlannedMode = mode === "planned";
  const isMissedMode = mode === "missed";
  const isSingleStatusMode = isPlannedMode || isMissedMode;
  const fixedStatus = isPlannedMode ? "Planned" : isMissedMode ? "Missed" : null;
  const dateFormat = useMemo(() => getDateFormat(), []);
  const fmtDate = (d) => formatTradeDate(d, dateFormat);
  const journalFiltersStorageKey = `journal_filters_${user?.id || 'guest'}_${mode}`;
  const hasLoadedJournalFilters = useRef(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilters, setStatusFilters] = useState(isSingleStatusMode ? [fixedStatus] : ["all"]);
  const [timeFilters, setTimeFilters] = useState(["all"]);
  const [timeFilterOpen, setTimeFilterOpen] = useState(false);
  const timeFilterRef = useRef(null);
  const [accountFilterOpen, setAccountFilterOpen] = useState(false);
  const accountFilterRef = useRef(null);
  const [accountFilters, setAccountFilters] = useState(["all"]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [viewingTrade, setViewingTrade] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [outcomeFilters, setOutcomeFilters] = useState(["all"]);
  const [plannedOpen, setPlannedOpen] = useState(false);
  const [selectedTrades, setSelectedTrades] = useState(new Set());
  const [deleteDialog, setDeleteDialog] = useState({ open: false, mode: null, tradeId: null, count: 0 });
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = useRef(null);
  const [visibleColumns, setVisibleColumns] = useState({
    status: true,
    date: true,
    symbol: true,
    direction: true,
    entry: true,
    exit: true,
    position: true,
    pl: true,
    outcome: true,
    notes: true,
    actions: true
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    hasLoadedJournalFilters.current = false;

    const defaultStatusFilters = isSingleStatusMode ? [fixedStatus] : ["all"];
    setSearchTerm("");
    setStatusFilters(defaultStatusFilters);
    setTimeFilters(["all"]);
    setAccountFilters(["all"]);
    setOutcomeFilters(["all"]);

    try {
      const raw = localStorage.getItem(journalFiltersStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);

        if (typeof parsed.searchTerm === "string") {
          setSearchTerm(parsed.searchTerm);
        }

        if (Array.isArray(parsed.timeFilters) && parsed.timeFilters.length > 0) {
          setTimeFilters(parsed.timeFilters.map((value) => String(value)));
        }

        if (Array.isArray(parsed.accountFilters) && parsed.accountFilters.length > 0) {
          setAccountFilters(parsed.accountFilters.map((value) => String(value)));
        }

        if (Array.isArray(parsed.outcomeFilters) && parsed.outcomeFilters.length > 0) {
          setOutcomeFilters(parsed.outcomeFilters.map((value) => String(value)));
        }

        if (!isSingleStatusMode && Array.isArray(parsed.statusFilters) && parsed.statusFilters.length > 0) {
          setStatusFilters(parsed.statusFilters.map((value) => String(value)));
        }
      }
    } catch (error) {
      console.error('Failed to load journal filters from localStorage:', error);
    } finally {
      hasLoadedJournalFilters.current = true;
    }
  }, [journalFiltersStorageKey, isSingleStatusMode, fixedStatus]);

  useEffect(() => {
    if (!hasLoadedJournalFilters.current) return;

    try {
      localStorage.setItem(
        journalFiltersStorageKey,
        JSON.stringify({
          searchTerm,
          statusFilters: isSingleStatusMode ? [fixedStatus] : statusFilters,
          timeFilters,
          accountFilters,
          outcomeFilters
        })
      );
    } catch (error) {
      console.error('Failed to save journal filters to localStorage:', error);
    }
  }, [
    journalFiltersStorageKey,
    isSingleStatusMode,
    fixedStatus,
    searchTerm,
    statusFilters,
    timeFilters,
    accountFilters,
    outcomeFilters
  ]);

  const { data: trades = [], isLoading, refetch } = useQuery({
    queryKey: ['trades', user?.id],
    queryFn: () => getTrades(user?.id),
    enabled: !!user?.id,
    staleTime: 1000
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: () => getTradingAccounts(user?.id),
    enabled: !!user?.id
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
    queryKey: ['strategies', user?.id],
    queryFn: () => getStrategies(user?.id),
    enabled: !!user?.id
  });

  const deleteTradeMutation = useMutation({
    mutationFn: (id) => deleteTrade(user?.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades', user?.id] });
      refetch();
    },
  });

  const handleDelete = (id) => {
    setDeleteDialog({ open: true, mode: "single", tradeId: id, count: 1 });
  };

  const handleBulkDelete = async () => {
    if (selectedTrades.size === 0) return;
    setDeleteDialog({ open: true, mode: "bulk", tradeId: null, count: selectedTrades.size });
  };

  const confirmDelete = async () => {
    if (deleteDialog.mode === "single" && deleteDialog.tradeId) {
      deleteTradeMutation.mutate(deleteDialog.tradeId);
      setDeleteDialog({ open: false, mode: null, tradeId: null, count: 0 });
      return;
    }

    if (deleteDialog.mode === "bulk") {
      for (const id of selectedTrades) {
        await deleteTrade(user?.id, id);
      }
      setSelectedTrades(new Set());
      queryClient.invalidateQueries({ queryKey: ['trades', user?.id] });
      refetch();
      setDeleteDialog({ open: false, mode: null, tradeId: null, count: 0 });
    }
  };

  const toggleTradeSelection = (tradeId) => {
    setSelectedTrades(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tradeId)) {
        newSet.delete(tradeId);
      } else {
        newSet.add(tradeId);
      }
      return newSet;
    });
  };

  const toggleAllTrades = () => {
    if (selectedTrades.size === displayTrades.length && displayTrades.length > 0) {
      setSelectedTrades(new Set());
    } else {
      setSelectedTrades(new Set(displayTrades.map(t => t.id)));
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleViewTrade = (trade) => {
    const symbolTrades = tradesFromActiveAccounts.filter(t => t.symbol === trade.symbol && isClosedTrade(t));
    const wins = symbolTrades.filter(t => t.outcome === "Win").length;
    const total = symbolTrades.length;
    const totalPL = symbolTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0);
    const avgPL = total ? (totalPL / total) : 0;

    const account = accounts.find(a => String(a.id) === String(trade.account_id));
    const strategy = strategies.find(s => String(s.id) === String(trade.strategy_id));
    setViewingTrade({
      ...trade,
      accountName: account?.name || "",
      strategyName: strategy?.name || "",
      symbolStats: {
        total,
        wins,
        winRate: total ? ((wins / total) * 100).toFixed(1) : "0.0",
        totalPL: totalPL.toFixed(2),
        avgPL: avgPL.toFixed(2)
      }
    });
  };

  const sortTrades = (list) => {
    return [...list].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === "profit_loss") {
        aVal = getTradeRealizedPL(a) ?? 0;
        bVal = getTradeRealizedPL(b) ?? 0;
      }

      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  const getScreenshotList = (trade) => {
    return [trade?.screenshot_1, trade?.screenshot_2, trade?.screenshot_3].filter(Boolean).slice(0, 3);
  };

  const openQuickImage = (imageUrl) => {
    if (!imageUrl) return;
    setViewerImage(imageUrl);
    setViewerOpen(true);
  };

  useEffect(() => {
    if (!timeFilterOpen) return;

    const handleClickOutside = (event) => {
      if (timeFilterRef.current && !timeFilterRef.current.contains(event.target)) {
        setTimeFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [timeFilterOpen]);

  useEffect(() => {
    if (!accountFilterOpen) return;

    const handleClickOutside = (event) => {
      if (accountFilterRef.current && !accountFilterRef.current.contains(event.target)) {
        setAccountFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [accountFilterOpen]);

  useEffect(() => {
    if (!datePickerOpen) return;
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setDatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [datePickerOpen]);

  useEffect(() => {
    const validIds = new Set(activeAccounts.map((account) => String(account.id)));
    setAccountFilters((prev) => {
      if (prev.includes("all")) return prev;
      const sanitized = prev.filter((id) => validIds.has(String(id)));
      return sanitized.length ? sanitized : ["all"];
    });
  }, [accounts]);

  // Filter and search (base)
  const baseFilteredTrades = tradesFromActiveAccounts.filter(t => {
    if (searchTerm && !t.symbol.toLowerCase().includes(searchTerm.toLowerCase())) return false;

    if (dateRange.from) {
      if (!t.date) return false;
      const tradeDate = t.date;
      if (tradeDate < dateRange.from) return false;
      if (dateRange.to && tradeDate > dateRange.to) return false;
    } else if (!timeFilters.includes("all")) {
      if (!t.date) return false;
      const tradeDate = parseISO(t.date);
      const now = new Date();

      const matchesSelectedTime =
        (timeFilters.includes("day") && isSameDay(tradeDate, now)) ||
        (timeFilters.includes("week") && isSameWeek(tradeDate, now, { weekStartsOn: 1 })) ||
        (timeFilters.includes("month") && isSameMonth(tradeDate, now));

      if (!matchesSelectedTime) return false;
    }

    if (!accountFilters.includes("all") && t.account_id) {
      const tradeAccountId = String(t.account_id);
      const matchesAccount = accountFilters.some((selectedAccountId) => String(selectedAccountId) === tradeAccountId);
      if (!matchesAccount) return false;
    }

    return true;
  });

  const statusFilteredTrades = statusFilters.includes("all")
    ? baseFilteredTrades
    : baseFilteredTrades.filter(t => statusFilters.some(f => tradeStatusMatchesFilter(t.status, f)));

  const outcomeFilteredTrades = outcomeFilters.includes("all")
    ? statusFilteredTrades
    : statusFilteredTrades.filter(t => outcomeFilters.includes(t.outcome));

  const filteredTrades = sortTrades(outcomeFilteredTrades);
  const plannedTrades = sortTrades(baseFilteredTrades.filter(t => t.status === "Planned"));
  const missedTrades = sortTrades(baseFilteredTrades.filter(t => t.status === "Missed"));
  const executedTrades = filteredTrades.filter(t => t.status !== "Planned" && t.status !== "Missed");
  const displayTrades = isPlannedMode
    ? plannedTrades
    : isMissedMode
      ? missedTrades
      : executedTrades;
  const toggleStatusFilter = (value) => {
    setStatusFilters(prev => {
      if (value === "all") return ["all"];
      const withoutAll = prev.filter(v => v !== "all");
      const exists = withoutAll.includes(value);
      const next = exists ? withoutAll.filter(v => v !== value) : [...withoutAll, value];
      return next.length ? next : ["all"];
    });
  };

  const toggleTimeFilter = (value) => {
    setTimeFilters((prev) => {
      if (value === "all") return ["all"];
      const withoutAll = prev.filter((item) => item !== "all");
      const exists = withoutAll.includes(value);
      const next = exists ? withoutAll.filter((item) => item !== value) : [...withoutAll, value];
      return next.length ? next : ["all"];
    });
  };

  const toggleAccountFilter = (value) => {
    setAccountFilters((prev) => {
      if (value === "all") return ["all"];
      const withoutAll = prev.filter((item) => item !== "all");
      const exists = withoutAll.includes(String(value));
      const next = exists
        ? withoutAll.filter((item) => item !== String(value))
        : [...withoutAll, String(value)];
      return next.length ? next : ["all"];
    });
  };

  const activeAccountFilterLabel = accountFilters.includes("all")
    ? (t('allAccounts') || 'All Accounts')
    : accountFilters
        .map((accountId) => activeAccounts.find((account) => String(account.id) === String(accountId))?.name)
        .filter(Boolean)
        .join(", ");

  const timeFilterLabels = {
    all: t('allTime') || 'All Time',
    day: t('today') || 'Today',
    week: t('thisWeek') || 'This Week',
    month: t('thisMonth') || 'This Month'
  };

  const activeTimeFilterLabel = timeFilters.includes("all")
    ? timeFilterLabels.all
    : timeFilters.map((filterKey) => timeFilterLabels[filterKey]).join(", ");

  const dateRangeActive = !!dateRange.from;

  const dateRangeLabel = dateRange.from
    ? dateRange.to && dateRange.to !== dateRange.from
      ? `${dateRange.from.split("-").reverse().join(".")} – ${dateRange.to.split("-").reverse().join(".")}`
      : dateRange.from.split("-").reverse().join(".")
    : "Zakres dat";

  const accountNameById = useMemo(() => {
    const map = {};
    accounts.forEach((account) => {
      map[String(account.id)] = account.name;
    });
    return map;
  }, [accounts]);

  const strategyNameById = useMemo(() => {
    const map = {};
    strategies.forEach((strategy) => {
      map[String(strategy.id)] = strategy.name;
    });
    return map;
  }, [strategies]);


  const statsSource = isPlannedMode
    ? plannedTrades
    : isMissedMode
      ? missedTrades
      : baseFilteredTrades.filter(isClosedTrade);
  const stats = {
    total: statsSource.length,
    open: baseFilteredTrades.filter(t => t.status === "Open").length,
    closed: baseFilteredTrades.filter(isClosedTrade).length,
    planned: baseFilteredTrades.filter(t => t.status === "Planned").length,
    missed: baseFilteredTrades.filter(t => t.status === "Missed").length,
    wins: statsSource.filter(t => t.outcome === "Win").length,
    losses: statsSource.filter(t => t.outcome === "Loss").length,
    totalPL: statsSource.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0)
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-12 h-12 border-4 border-cyan-600 dark:border-cyan-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user?.id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-slate-600">Please log in to view your journal</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-0 space-y-4 dashboard-surface">
      <div className="w-full mx-auto space-y-4">
        {/* Bulk Actions Bar */}
        {selectedTrades.size > 0 && (
          <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-card shadow-2xl rounded-xl border border-cyan-500/25 dark:border-cyan-500/30 px-4 md:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-4 animate-in slide-in-from-top-5 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-cyan-500/15 dark:bg-cyan-500/20 flex items-center justify-center ring-1 ring-cyan-500/30">
                <span className="text-xs md:text-sm font-bold text-cyan-700 dark:text-cyan-200">{selectedTrades.size}</span>
              </div>
              <span className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300">
                {selectedTrades.size} {selectedTrades.size === 1 ? 'trade' : 'trades'} selected
              </span>
            </div>
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setSelectedTrades(new Set())}
              className="border-slate-300 dark:border-slate-600"
            >
              Clear
            </Button>
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="min-w-0">
            <h1 className="cyber-page-title">{isPlannedMode ? (t('plannedTrades') || 'Planned Trades') : isMissedMode ? (t('missedTrades') || 'Missed Trades') : 'Trade Journal'}</h1>
            <p className="cyber-page-sub">{isPlannedMode ? (t('plannedTrades') || 'Planned Trades') : isMissedMode ? (t('missedTrades') || 'Missed Trades') : 'Track and analyze your trading performance'}</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => setShowAddForm(true)}
              className="h-10 px-4 gap-2 rounded-xl shadow-md cyber-primary-btn w-full sm:w-auto"
              title={t('addTrade')}
            >
              <Plus className="w-5 h-5 shrink-0" />
              <span className="font-semibold">{t('addTrade')}</span>
            </Button>
          </div>
        </div>

        {/* Stats — browser-style tabs */}
        {!isSingleStatusMode && (() => {
          const isAll = statusFilters.includes("all") && outcomeFilters.includes("all");
          const tabs = [
            { key: "all",    label: t('totalTradesLabel'), count: stats.total,   active: isAll,                              accent: "slate",   onClick: () => { setStatusFilters(["all"]);    setOutcomeFilters(["all"]); } },
            { key: "open",   label: t('openStatus'),       count: stats.open,    active: statusFilters.includes("Open"),     accent: "blue",    onClick: () => { setStatusFilters(["Open"]);   setOutcomeFilters(["all"]); } },
            { key: "closed", label: t('closedStatus'),     count: stats.closed,  active: statusFilters.includes("Closed"),   accent: "emerald", onClick: () => { setStatusFilters(["Closed"]); setOutcomeFilters(["all"]); } },
            { key: "wins",   label: t('wins'),             count: stats.wins,    active: outcomeFilters.includes("Win"),     accent: "yellow",  onClick: () => { setStatusFilters(["all"]);    setOutcomeFilters(["Win"]); } },
            { key: "losses", label: t('losses'),           count: stats.losses,  active: outcomeFilters.includes("Loss"),    accent: "red",     onClick: () => { setStatusFilters(["all"]);    setOutcomeFilters(["Loss"]); } },
            { key: "planned",label: t('planned'),          count: stats.planned, active: statusFilters.includes("Planned"),  accent: "amber",   onClick: () => { setStatusFilters(["Planned"]); setOutcomeFilters(["all"]); } },
          ];
          const accentMap = {
            slate:   { dot: "bg-slate-400",   text: "text-slate-700 dark:text-slate-200",   badgeActive: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100" },
            blue:    { dot: "bg-blue-500",    text: "text-blue-700 dark:text-blue-300",     badgeActive: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200" },
            emerald: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", badgeActive: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200" },
            yellow:  { dot: "bg-yellow-500",  text: "text-yellow-700 dark:text-yellow-300", badgeActive: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-200" },
            red:     { dot: "bg-red-500",     text: "text-red-700 dark:text-red-300",       badgeActive: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200" },
            amber:   { dot: "bg-amber-500",   text: "text-amber-700 dark:text-amber-300",   badgeActive: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200" },
          };
          return (
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <div
                role="tablist"
                className="flex-1 flex flex-wrap items-end gap-1 border-b border-slate-200 dark:border-slate-700/70 px-1"
              >
                {tabs.map((tab) => {
                  const a = accentMap[tab.accent];
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={tab.active}
                      onClick={tab.onClick}
                      className={`group relative inline-flex items-center gap-2 px-4 py-2.5 rounded-t-xl border border-b-0 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                        tab.active
                          ? `bg-card border-slate-200 dark:border-slate-700 shadow-[0_-2px_6px_-2px_rgba(0,0,0,0.08)] -mb-px ${a.text}`
                          : "bg-slate-100/70 dark:bg-slate-800/40 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100 hover:-translate-y-0.5"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${a.dot} ${tab.active ? "opacity-100" : "opacity-60"}`} />
                      <span className="text-sm font-semibold tracking-tight">{tab.label}</span>
                      <span
                        className={`ml-1 min-w-[1.5rem] text-center text-[11px] font-bold px-1.5 py-0.5 rounded-full transition-colors ${
                          tab.active ? a.badgeActive : "bg-slate-200/80 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div
                className={`shrink-0 rounded-xl border px-4 py-2.5 shadow-sm transition-colors ${
                  stats.totalPL >= 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800'
                }`}
              >
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${stats.totalPL >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                  {t('totalPL')}
                </p>
                <p data-private className={`text-xl font-bold leading-tight ${stats.totalPL >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                  {stats.totalPL >= 0 ? '+' : ''}{stats.totalPL.toFixed(2)}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Filters */}
        <Card className="shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search by symbol..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              {!isSingleStatusMode && (
              <div className="flex flex-wrap gap-3 items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div 
                    className={`w-5 h-5 rounded-full border-[3px] transition-all shadow-sm hover:shadow-md ${
                      statusFilters.includes("all")
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-slate-50 dark:bg-muted/50 border-slate-400 dark:border-slate-500 hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                    }`}
                    onClick={() => { toggleStatusFilter("all"); setOutcomeFilters(["all"]); }}
                  >
                    {statusFilters.includes("all") && (
                      <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>{t('all')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div 
                    className={`w-5 h-5 rounded-full border-[3px] transition-all shadow-sm hover:shadow-md ${
                      statusFilters.includes("Open")
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-slate-50 dark:bg-muted/50 border-slate-400 dark:border-slate-500 hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                    }`}
                    onClick={() => { toggleStatusFilter("Open"); setOutcomeFilters(["all"]); }}
                  >
                    {statusFilters.includes("Open") && (
                      <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>{t('openStatus')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div 
                    className={`w-5 h-5 rounded-full border-[3px] transition-all shadow-sm hover:shadow-md ${
                      statusFilters.includes("Closed")
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-slate-50 dark:bg-muted/50 border-slate-400 dark:border-slate-500 hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                    }`}
                    onClick={() => { toggleStatusFilter("Closed"); setOutcomeFilters(["all"]); }}
                  >
                    {statusFilters.includes("Closed") && (
                      <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>{t('closedStatus')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div 
                    className={`w-5 h-5 rounded-full border-[3px] transition-all shadow-sm hover:shadow-md ${
                      statusFilters.includes("Planned")
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-slate-50 dark:bg-muted/50 border-slate-400 dark:border-slate-500 hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                    }`}
                    onClick={() => { toggleStatusFilter("Planned"); setOutcomeFilters(["all"]); }}
                  >
                    {statusFilters.includes("Planned") && (
                      <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span>{t('plannedStatus')}</span>
                </label>
              </div>
              )}
              <div className="relative" ref={accountFilterRef}>
                <button
                  type="button"
                  onClick={() => setAccountFilterOpen((prev) => !prev)}
                  className="relative w-[220px] h-10 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-card dark:text-slate-200 flex items-center justify-center"
                >
                  <span className="truncate text-center w-full pr-4">
                    {activeAccountFilterLabel || (t('allAccounts') || 'All Accounts')}
                  </span>
                  {accountFilterOpen ? <ChevronUp className="absolute right-3 w-4 h-4" /> : <ChevronDown className="absolute right-3 w-4 h-4" />}
                </button>
                {accountFilterOpen && (
                  <div className="absolute left-0 mt-2 z-20 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-card shadow-lg p-2 max-h-64 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        toggleAccountFilter("all");
                      }}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{t('allAccounts') || 'All Accounts'}</span>
                      <div
                        className={`w-5 h-5 rounded-full border-[3px] transition-all shadow-sm ${
                          accountFilters.includes("all")
                            ? 'bg-blue-600 border-blue-600'
                            : 'bg-slate-50 dark:bg-muted/50 border-slate-400 dark:border-slate-500'
                        }`}
                      >
                        {accountFilters.includes("all") && (
                          <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                    {activeAccounts.map((account) => {
                      const isSelected = accountFilters.includes(String(account.id));
                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => {
                            toggleAccountFilter(String(account.id));
                          }}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{account.name}</span>
                          <div
                            className={`w-5 h-5 rounded-full border-[3px] transition-all shadow-sm ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600'
                                : 'bg-slate-50 dark:bg-muted/50 border-slate-400 dark:border-slate-500'
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="relative ml-auto" ref={timeFilterRef}>
                <button
                  type="button"
                  onClick={() => setTimeFilterOpen((prev) => !prev)}
                  className="relative min-w-[160px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-card dark:text-slate-200 flex items-center justify-center"
                >
                  <span className="truncate text-center w-full pr-4">{activeTimeFilterLabel}</span>
                  {timeFilterOpen ? <ChevronUp className="absolute right-3 w-4 h-4" /> : <ChevronDown className="absolute right-3 w-4 h-4" />}
                </button>
                {timeFilterOpen && (
                  <div className="absolute right-0 mt-2 z-20 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-card shadow-lg p-2">
                    {[
                      { value: "all", label: timeFilterLabels.all },
                      { value: "day", label: timeFilterLabels.day },
                      { value: "week", label: timeFilterLabels.week },
                      { value: "month", label: timeFilterLabels.month }
                    ].map((option) => {
                      const isChecked = timeFilters.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            toggleTimeFilter(option.value);
                            setDateRange({ from: undefined, to: undefined });
                          }}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <span className="text-sm text-slate-700 dark:text-slate-200">{option.label}</span>
                          <div
                            className={`w-5 h-5 rounded-full border-[3px] transition-all shadow-sm ${
                              isChecked
                                ? 'bg-blue-600 border-blue-600'
                                : 'bg-slate-50 dark:bg-muted/50 border-slate-400 dark:border-slate-500'
                            }`}
                          >
                            {isChecked && (
                              <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Date range picker */}
              <div className="relative" ref={datePickerRef}>
                <button
                  type="button"
                  onClick={() => setDatePickerOpen((prev) => !prev)}
                  className={`relative flex items-center gap-2 px-3 py-2 h-10 border rounded-md text-sm transition-colors ${
                    dateRangeActive
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                      : "border-gray-300 dark:border-gray-600 dark:bg-card dark:text-slate-200"
                  }`}
                >
                  <CalendarRange className="w-4 h-4 shrink-0" />
                  <span className="truncate max-w-[150px]">{dateRangeLabel}</span>
                  {datePickerOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {datePickerOpen && (
                  <div className="absolute right-0 mt-2 z-30 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-card shadow-xl p-3">
                    <MiniCalendar
                      from={dateRange.from}
                      to={dateRange.to}
                      onSelect={(f, t) => {
                        setDateRange({ from: f, to: t });
                        setTimeFilters(["all"]);
                      }}
                    />
                    {(dateRange.from || dateRange.to) && (
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          {dateRange.from && dateRange.to
                            ? `${dateRange.from.split("-").reverse().join(".")} – ${dateRange.to.split("-").reverse().join(".")}`
                            : dateRange.from
                              ? `Od ${dateRange.from.split("-").reverse().join(".")}`
                              : ""}
                        </span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setDateRange({ from: "", to: "" }); }} className="text-[11px] text-slate-400 hover:text-red-500 px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                            Wyczyść
                          </button>
                          <button type="button" onClick={() => setDatePickerOpen(false)} className="text-[11px] text-white bg-blue-600 hover:bg-blue-700 px-3 py-0.5 rounded">
                            Zamknij
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {(isSingleStatusMode || statusFilters.includes("all") || statusFilters.some(s => s !== "Planned" && s !== "Missed")) && (
          <Card className="bg-white dark:bg-card shadow-xl">
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full">
                <table className="w-full table-fixed text-xs border-collapse [&_th]:px-1 [&_td]:px-1 [&_th]:py-1 [&_td]:py-1 [&_th]:leading-tight [&_td]:leading-tight [&_th]:overflow-hidden [&_th]:text-ellipsis [&_td]:overflow-hidden [&_td]:text-ellipsis [&_button]:min-h-0 [&_button]:min-w-0">
                <thead className="bg-slate-50 dark:bg-card border-b border-slate-200 dark:border-border">
                  <tr>
                    {visibleColumns.status && (
                      <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('statusLabel')}</th>
                    )}
                    <th className="text-left px-1 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap w-[92px]">{t('account') || 'Account'}</th>
                    {visibleColumns.date && (
                      <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <button onClick={() => handleSort("date")} className="flex items-center gap-0.5 hover:text-blue-600">
                          {t('date')} <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                    )}
                    {visibleColumns.symbol && (
                      <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('symbol')}</th>
                    )}
                    {visibleColumns.direction && (
                      <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('direction')}</th>
                    )}
                    <th className="text-left px-1 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap w-[92px]">{t('strategy') || 'Strategy'}</th>
                    {visibleColumns.entry && (
                      <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('entryPrice')}</th>
                    )}
                    <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('stopLossPips')}</th>
                    <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('takeProfitPips')}</th>
                    {visibleColumns.exit && (
                      <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('exit')}</th>
                    )}
                    {visibleColumns.position && (
                      <th className="text-left px-1 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap w-[72px]">{t('lotSize')}</th>
                    )}
                    {visibleColumns.pl && (
                      <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <button onClick={() => handleSort("profit_loss")} className="flex items-center gap-0.5 hover:text-blue-600">
                          {t('profitLoss')} <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                    )}
                    {visibleColumns.outcome && (
                      <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('outcome')}</th>
                    )}
                    <th className="text-left px-1 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap w-[110px]">{t('screenshots') || 'Scr'}</th>
                    {visibleColumns.actions && (
                      <th className="text-right px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('actions')}</th>
                    )}
                    <th className="text-center px-1.5 py-1 w-8">
                      <div 
                        onClick={toggleAllTrades}
                        className={`w-4 h-4 rounded-full border-[2px] cursor-pointer transition-all mx-auto shadow-sm hover:shadow-md ${
                          displayTrades.length > 0 && selectedTrades.size === displayTrades.length
                            ? 'bg-blue-600 border-blue-600'
                            : 'bg-slate-50 dark:bg-muted/50 border-slate-400 dark:border-slate-500 hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                        }`}
                      >
                        {displayTrades.length > 0 && selectedTrades.size === displayTrades.length && (
                          <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayTrades.map((trade) => (
                    <tr key={trade.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      {visibleColumns.status && (
                        <td className="px-1.5 py-1">
                          <Badge className={`${tradeStatusBadgeClass(trade.status)} text-xs font-semibold px-1.5 py-0.5 border`}> 
                            {trade.status === "Open" ? <Clock className="w-3 h-3 mr-0.5" /> : <CheckCircle className="w-3 h-3 mr-0.5" />}
                            {trade.status}
                          </Badge>
                        </td>
                      )}
                      <td className="px-1 py-1 text-xs text-slate-900 dark:text-slate-100 max-w-[92px] truncate" title={accountNameById[String(trade.account_id)] || '-'}>
                        {accountNameById[String(trade.account_id)] || '-'}
                      </td>
                      {visibleColumns.date && (
                        <td className="px-1.5 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          <div>{fmtDate(trade.date)}</div>
                          {(trade.entry_time || trade.time) && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {String(trade.entry_time || trade.time).slice(0, 8)}
                            </div>
                          )}
                        </td>
                      )}
                      {visibleColumns.symbol && (
                        <td className="px-1.5 py-1 text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.symbol}</td>
                      )}
                      {visibleColumns.direction && (
                        <td className="px-1.5 py-1">
                          <Badge className={`${directionBadgeClass(trade.direction)} text-xs font-semibold px-1.5 py-0.5 border`}>
                            {directionLabel(trade.direction, t)}
                          </Badge>
                        </td>
                      )}
                      <td className="px-1 py-1 text-xs text-slate-900 dark:text-slate-100 max-w-[92px] truncate" title={strategyNameById[String(trade.strategy_id)] || '-'}>
                        {strategyNameById[String(trade.strategy_id)] || '-'}
                      </td>
                      {visibleColumns.entry && (
                        <td className="px-1 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          <div>{trade.entry_price ?? '-'}</div>
                          {(trade.entry_time || trade.time) && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {String(trade.entry_time || trade.time).slice(0, 8)}
                            </div>
                          )}
                        </td>
                      )}
                      <td className="px-1 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.stop_loss_pips ?? trade.stop_loss_amount ?? trade.stop_loss ?? '-'}</td>
                      <td className="px-1 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.take_profit_pips ?? trade.take_profit_amount ?? trade.take_profit ?? '-'}</td>
                      {visibleColumns.exit && (
                        <td className="px-1 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          <div>{trade.exit_price ?? '-'}</div>
                          {(trade.exit_time || (trade.close_date && trade.close_date !== trade.date)) && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {trade.close_date && trade.close_date !== trade.date ? `${fmtDate(trade.close_date)} ` : ''}
                              {trade.exit_time ? String(trade.exit_time).slice(0, 8) : ''}
                            </div>
                          )}
                        </td>
                      )}
                      {visibleColumns.position && (
                        <td className="px-1 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap max-w-[72px] truncate" title={String(trade.position_size || '')}>{trade.position_size}</td>
                      )}
                      {visibleColumns.pl && (
                        <td className="px-1.5 py-1">
                          {trade.profit_loss != null ? (() => {
                            const pl = getTradeRealizedPL(trade) ?? 0;
                            return (
                            <div data-private className="flex items-center gap-0.5">
                              {pl > 0 ? (
                                <TrendingUp className="w-3 h-3 text-green-600" />
                              ) : pl < 0 ? (
                                <TrendingDown className="w-3 h-3 text-red-600" />
                              ) : null}
                              <span className={`text-sm font-semibold ${
                                pl > 0 ? 'text-green-600' :
                                pl < 0 ? 'text-red-600' :
                                'text-slate-600'
                              }`} title={trade.commission != null ? `Commission: ${trade.commission}` : undefined}>
                                {pl > 0 ? '+' : ''}{pl.toFixed(2)}
                              </span>
                            </div>
                            );
                          })() : <span className="text-sm text-slate-400">-</span>}
                        </td>
                      )}
                      {visibleColumns.outcome && (
                        <td className="px-1 py-1">
                          {trade.outcome && (
                            <Badge variant="outline" className={`text-xs font-semibold px-1.5 py-0.5 border ${tradeOutcomeBadgeClass(trade.outcome)}`}>
                              {trade.outcome}
                            </Badge>
                          )}
                        </td>
                      )}
                      <td className="px-1 py-1">
                        <div className="flex items-center gap-1 w-[72px]">
                          {getScreenshotList(trade).length > 0 ? (
                            getScreenshotList(trade).map((imageUrl, index) => (
                              <button
                                key={`${trade.id}-shot-${index}`}
                                type="button"
                                className="h-7 w-7 rounded-[6px] overflow-hidden border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-muted shrink-0"
                                onClick={() => openQuickImage(imageUrl)}
                                title={`${t('screenshot') || 'Screenshot'} ${index + 1}`}
                              >
                                <img src={imageUrl} alt={`${t('screenshot') || 'Screenshot'} ${index + 1}`} className="h-full w-full object-cover" />
                              </button>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </div>
                      </td>
                      {visibleColumns.actions && (
                        <td className="px-1 py-1">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => handleViewTrade(trade)} className="h-5 w-5 p-0">
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingTrade(trade)} className="h-5 w-5 p-0">
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(trade.id)} className="text-red-600 h-5 w-5 p-0">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      )}
                      <td className="text-center px-1 py-1">
                        <div 
                          onClick={() => toggleTradeSelection(trade.id)}
                          className={`w-4 h-4 rounded-full border-[2px] cursor-pointer transition-all mx-auto shadow-sm hover:shadow-md ${
                            selectedTrades.has(trade.id)
                              ? 'bg-blue-600 border-blue-600'
                              : 'bg-slate-50 dark:bg-muted/50 border-slate-400 dark:border-slate-500 hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                          }`}
                        >
                          {selectedTrades.has(trade.id) && (
                            <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

              {displayTrades.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-500">No trades to display</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!isSingleStatusMode && (statusFilters.includes("all") || statusFilters.includes("Planned")) && (
          <Card className="bg-yellow-50 dark:bg-yellow-950/40 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-yellow-700">{t('plannedTrades')}</CardTitle>
              <Button
                size="icon"
                variant="ghost"
                className="text-yellow-700 hover:text-yellow-800"
                onClick={() => setPlannedOpen(prev => !prev)}
                aria-label={t('plannedTrades')}
              >
                {plannedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CardHeader>
            {plannedOpen ? (
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed divide-y divide-slate-200 dark:divide-[#23233a] text-xs [&_th]:px-1 [&_td]:px-1 [&_th]:py-1 [&_td]:py-1 [&_th]:leading-tight [&_td]:leading-tight [&_th]:overflow-hidden [&_th]:text-ellipsis [&_td]:overflow-hidden [&_td]:text-ellipsis [&_button]:min-h-0 [&_button]:min-w-0">
                    <thead>
                      <tr>
                        {visibleColumns.date && (
                          <th className="px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('date')}</th>
                        )}
                        <th className="px-1 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap w-[92px]">{t('account') || 'Account'}</th>
                        {visibleColumns.symbol && (
                          <th className="px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('symbol')}</th>
                        )}
                        {visibleColumns.direction && (
                          <th className="px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('direction')}</th>
                        )}
                        <th className="px-1 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap w-[92px]">{t('strategy') || 'Strategy'}</th>
                        <th className="px-1 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('entryPrice')}</th>
                        <th className="px-1 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('stopLossPips')}</th>
                        <th className="px-1 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('takeProfitPips')}</th>
                        {visibleColumns.notes && (
                          <th className="px-1 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('notes')}</th>
                        )}
                        <th className="px-1 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('screenshots') || 'Scr'}</th>
                        {visibleColumns.actions && (
                          <th className="text-right px-1 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('actions')}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {plannedTrades.map((trade) => (
                        <tr key={trade.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors">
                          {visibleColumns.date && (
                            <td className="px-1 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{fmtDate(trade.date)}</td>
                          )}
                          <td className="px-1 py-1 text-xs text-slate-900 dark:text-slate-100 max-w-[92px] truncate" title={accountNameById[String(trade.account_id)] || '-'}>
                            {accountNameById[String(trade.account_id)] || '-'}
                          </td>
                          {visibleColumns.symbol && (
                            <td className="px-1 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.symbol}</td>
                          )}
                          {visibleColumns.direction && (
                            <td className="px-1 py-1">
                              <Badge className={`${directionBadgeClass(trade.direction)} text-xs font-semibold px-1.5 py-0.5 border`}>
                                {directionLabel(trade.direction, t)}
                              </Badge>
                            </td>
                          )}
                          <td className="px-1 py-1 text-xs text-slate-900 dark:text-slate-100 max-w-[92px] truncate" title={strategyNameById[String(trade.strategy_id)] || '-'}>
                            {strategyNameById[String(trade.strategy_id)] || '-'}
                          </td>
                          <td className="px-1 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.entry_price ?? '-'}</td>
                          <td className="px-1 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.stop_loss_pips ?? '-'}</td>
                          <td className="px-1 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.take_profit_pips ?? '-'}</td>
                          {visibleColumns.notes && (
                            <td className="px-1 py-1 text-sm text-slate-900 dark:text-slate-100 line-clamp-2">{trade.notes}</td>
                          )}
                          <td className="px-1 py-1">
                            <div className="flex items-center gap-1 w-[72px]">
                              {getScreenshotList(trade).length > 0 ? (
                                getScreenshotList(trade).map((imageUrl, index) => (
                                  <button
                                    key={`${trade.id}-planned-shot-${index}`}
                                    type="button"
                                    className="h-7 w-7 rounded-[6px] overflow-hidden border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-muted shrink-0"
                                    onClick={() => openQuickImage(imageUrl)}
                                    title={`${t('screenshot') || 'Screenshot'} ${index + 1}`}
                                  >
                                    <img src={imageUrl} alt={`${t('screenshot') || 'Screenshot'} ${index + 1}`} className="h-full w-full object-cover" />
                                  </button>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </div>
                          </td>
                          {visibleColumns.actions && (
                            <td className="px-1 py-1">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => handleViewTrade(trade)} className="h-5 w-5 p-0">
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingTrade(trade)}
                                  className="text-blue-600 h-5 w-5 p-0"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleDelete(trade.id)} className="text-red-600 h-5 w-5 p-0">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {plannedTrades.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-slate-500">{t('noTradesToDisplay')}</p>
                  </div>
                )}
              </CardContent>
            ) : (
              <CardContent className="p-4">
                <p className="text-sm text-slate-600">
                  {t('plannedTrades')}: {plannedTrades.length}
                </p>
              </CardContent>
            )}
          </Card>
        )}


        {/* Add Trade Dialog */}
        <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
          <DialogContent
            className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-card p-0"
            {...preventDialogDismissProps}
            onEscapeKeyDown={(event) => event.preventDefault()}
          >
            <div className="sticky top-0 bg-white dark:bg-card p-6 border-b border-border">
              <DialogTitle>{t('addTrade')}</DialogTitle>
            </div>
            <div className="p-6">
              <TradeFormNew
                defaultStatus={isPlannedMode ? "Planned" : isMissedMode ? "Missed" : "Open"}
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
            className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-card p-0"
            {...preventDialogDismissProps}
          >
            <div className="sticky top-0 bg-white dark:bg-card p-6 border-b border-border">
              <DialogTitle>Edit Trade</DialogTitle>
            </div>
            <div className="p-6">
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

        {/* View Trade Dialog */}
        <Dialog open={viewingTrade !== null} onOpenChange={() => setViewingTrade(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 bg-white dark:bg-card border-slate-200 dark:border-slate-700">
            <DialogHeader className="cyber-dialog-header sticky top-0 z-10 text-white px-6 py-4 border-b">
              <DialogTitle className="text-white text-xl font-bold">Trade Details</DialogTitle>
            </DialogHeader>
            <div className="p-6 bg-white dark:bg-card">
              {viewingTrade && (
                <TradeCard
                  trade={viewingTrade}
                  onEdit={(tradeToEdit) => {
                    setViewingTrade(null);
                    setEditingTrade(tradeToEdit);
                  }}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        <ImageViewer open={viewerOpen} onOpenChange={setViewerOpen} imageUrl={viewerImage} />

        <AlertDialog
          open={deleteDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteDialog({ open: false, mode: null, tradeId: null, count: 0 });
            }
          }}
        >
          <AlertDialogContent className="bg-white dark:bg-card border-slate-200 dark:border-slate-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-slate-900 dark:text-white">
                {deleteDialog.mode === "bulk" ? "Usunąć zaznaczone transakcje?" : "Usunąć transakcję?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
                {deleteDialog.mode === "bulk"
                  ? `Ta operacja usunie ${deleteDialog.count} transakcje i nie da sie jej cofnac.`
                  : "Ta operacja usunie transakcje i nie da sie jej cofnac."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="dark:bg-card dark:text-slate-200 dark:border-slate-700">
                Anuluj
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Usuń
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
