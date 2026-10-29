import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from '@/lib/AuthContext';
import { getTrades, deleteTrade, deleteTradesBatch, getTradingAccounts, getStrategies } from '@/lib/localStorage';
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
  CalendarRange
} from "lucide-react";
import { parseISO, isSameDay, isSameWeek, isSameMonth } from "date-fns";
import DateRangeCalendar from "@/components/DateRangeCalendar";
import { Dialog, DialogContent, DialogTitle, preventDialogDismissProps } from "@/components/ui/dialog";
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
import JournalMobileList from "../components/JournalMobileList";
import { useLanguage } from "@/components/LanguageProvider";
import { stripNoteMarkdown } from "@/lib/noteMarkdown";
import { usePnlDisplay } from "@/hooks/use-pnl-display";
import { directionBadgeClass, directionLabel, getActiveAccountIds, getTradeRealizedPL, isClosedTrade, isTradingAccountActive, normalizeTradeStatus, tradeBelongsToActiveAccount, tradeStatusBadgeClass, tradeOutcomeBadgeClass, tradeStatusMatchesFilter, tradeStatusDisplay, tradeOutcomeDisplay } from "@/lib/utils";
import ImageViewer from "@/components/common/ImageViewer";
import SafeImage from "@/components/common/SafeImage";
import { formatTradeDate, formatTradeClock, formatTradeClockDate, getDateFormat } from "@/lib/userSettings";
import QuoteLine from "@/components/QuoteLine";
import { EmptyState } from "@/components/ui/empty-state";
import TradePreviewPanel from "../components/TradePreviewPanel";
import { goToTradeDetails } from "@/lib/tradeDetailsNav";
import { toast } from "sonner";


const TradeFormNew = lazy(() => import("../components/TradeFormNew"));

const FormFallback = () => (
  <div className="flex justify-center py-10">
    <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
  </div>
);

/** Normalize HH:MM[:SS] so string compare works (9:00 vs 15:00). */
function padTradeTime(time) {
  const match = String(time || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return "00:00:00";
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}:${match[3] || "00"}`;
}

/** Sort key: entry/exit date + time (newest-first when compared descending). */
function tradeDateTimeSortKey(trade, which = "entry") {
  if (which === "exit") {
    const date = String(trade?.close_date || trade?.date || "").slice(0, 10);
    return `${date}T${padTradeTime(trade?.exit_time)}`;
  }
  const date = String(trade?.date || "").slice(0, 10);
  return `${date}T${padTradeTime(trade?.entry_time || trade?.open_time || trade?.time)}`;
}


const JOURNAL_PAGE_SIZE = 40;

export default function JournalSimple({ mode = "all" }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const pnl = usePnlDisplay();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
    if (searchParams.get("add") !== "1") return;
    setShowAddForm(true);
    const next = new URLSearchParams(searchParams);
    next.delete("add");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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

  const { data: trades = [], isFetching, isError, refetch } = useQuery({
    queryKey: ['trades', user?.id],
    queryFn: () => getTrades(user?.id),
    enabled: !!user?.id,
    placeholderData: [],
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: () => getTradingAccounts(user?.id),
    enabled: !!user?.id
  });

  const activeAccounts = useMemo(
    () => accounts.filter(isTradingAccountActive),
    [accounts]
  );
  const tradesFromActiveAccounts = useMemo(() => {
    const activeAccountIds = getActiveAccountIds(accounts);
    return trades.filter((trade) => {
      if (tradeBelongsToActiveAccount(trade, activeAccountIds)) return true;
      // Planned/missed are often saved before an account is chosen.
      const status = normalizeTradeStatus(trade?.status);
      return (status === "planned" || status === "missed") && !trade?.account_id;
    });
  }, [accounts, trades]);

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
      try {
        await deleteTradesBatch(user?.id, [...selectedTrades]);
        setSelectedTrades(new Set());
        queryClient.invalidateQueries({ queryKey: ['trades', user?.id] });
        refetch();
      } catch (error) {
        toast.error(error?.message || "Nie udało się usunąć transakcji");
      } finally {
        setDeleteDialog({ open: false, mode: null, tradeId: null, count: 0 });
      }
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

  const handleRowPreview = (trade, event) => {
    if (event.target.closest("button, a, input, textarea, [data-row-action]")) return;
    handleViewTrade(trade);
  };

  const sortTrades = (list) => {
    return [...list].sort((a, b) => {
      let cmp = 0;

      if (sortField === "profit_loss") {
        const aVal = getTradeRealizedPL(a) ?? 0;
        const bVal = getTradeRealizedPL(b) ?? 0;
        cmp = aVal === bVal ? 0 : aVal > bVal ? 1 : -1;
      } else if (sortField === "date") {
        cmp = tradeDateTimeSortKey(a, "entry").localeCompare(tradeDateTimeSortKey(b, "entry"));
        if (cmp === 0) {
          cmp = tradeDateTimeSortKey(a, "exit").localeCompare(tradeDateTimeSortKey(b, "exit"));
        }
      } else {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (aVal == null && bVal == null) cmp = 0;
        else if (aVal == null) cmp = -1;
        else if (bVal == null) cmp = 1;
        else if (aVal === bVal) cmp = 0;
        else cmp = aVal > bVal ? 1 : -1;
        if (cmp === 0) {
          cmp = tradeDateTimeSortKey(a, "entry").localeCompare(tradeDateTimeSortKey(b, "entry"));
        }
      }

      if (cmp === 0) return 0;
      return sortOrder === "asc" ? cmp : -cmp;
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
  const {
    baseFilteredTrades,
    filteredTrades,
    plannedTrades,
    missedTrades,
    displayTrades,
  } = useMemo(() => {
  const baseFilteredTrades = tradesFromActiveAccounts.filter(t => {
    if (searchTerm && !(t.symbol || "").toLowerCase().includes(searchTerm.toLowerCase())) return false;

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
  const plannedTrades = sortTrades(baseFilteredTrades.filter(t => normalizeTradeStatus(t.status) === "planned"));
  const missedTrades = sortTrades(baseFilteredTrades.filter(t => normalizeTradeStatus(t.status) === "missed"));
  const executedTrades = filteredTrades.filter(t => {
    const status = normalizeTradeStatus(t.status);
    return status !== "planned" && status !== "missed";
  });
  const displayTrades = isPlannedMode
    ? plannedTrades
    : isMissedMode
      ? missedTrades
      : executedTrades;
  return { baseFilteredTrades, filteredTrades, plannedTrades, missedTrades, displayTrades };
  }, [
    tradesFromActiveAccounts,
    searchTerm,
    dateRange.from,
    dateRange.to,
    timeFilters,
    accountFilters,
    statusFilters,
    outcomeFilters,
    sortField,
    sortOrder,
    isPlannedMode,
    isMissedMode,
  ]);
  const [visibleCount, setVisibleCount] = useState(JOURNAL_PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(JOURNAL_PAGE_SIZE);
  }, [searchTerm, dateRange.from, dateRange.to, timeFilters, accountFilters, statusFilters, outcomeFilters, mode]);
  const visibleTrades = displayTrades.slice(0, visibleCount);
  const visiblePlanned = plannedTrades.slice(0, visibleCount);

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
    planned: baseFilteredTrades.filter(t => normalizeTradeStatus(t.status) === "planned").length,
    missed: baseFilteredTrades.filter(t => normalizeTradeStatus(t.status) === "missed").length,
    wins: statsSource.filter(t => t.outcome === "Win").length,
    losses: statsSource.filter(t => t.outcome === "Loss").length,
    breakeven: statsSource.filter(t => t.outcome === "Breakeven").length,
    totalPL: statsSource.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0)
  };

  if (!user?.id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Please log in to view your journal</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-0 space-y-3 dashboard-surface">
      <div className="w-full mx-auto space-y-4">
        {isFetching && trades.length === 0 && (
          <p className="text-sm text-muted-foreground">Ładowanie transakcji…</p>
        )}
        {isError && (
          <button
            type="button"
            onClick={() => refetch()}
            className="text-sm text-loss underline"
          >
            Nie udało się załadować dziennika. Kliknij, żeby spróbować ponownie.
          </button>
        )}
        {/* Bulk Actions Bar */}
        {selectedTrades.size > 0 && (
          <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-card rounded-md border border-border px-4 md:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-4 animate-in slide-in-from-top-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center">
                <span className="text-xs md:text-sm font-bold text-primary">{selectedTrades.size}</span>
              </div>
              <span className="text-xs md:text-sm font-semibold text-foreground">
                {selectedTrades.size} {selectedTrades.size === 1 ? 'trade' : 'trades'} selected
              </span>
            </div>
            <div className="h-6 w-px bg-border"></div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => setSelectedTrades(new Set())}
              className="border-border"
            >
              Clear
            </Button>
            <Button 
              size="sm" 
              variant="destructive" 
              onClick={handleBulkDelete}
              className="bg-loss text-white hover:bg-loss/90"
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
          <div className="flex gap-3 items-center">
            <QuoteLine className="hidden lg:flex shrink-0" />
            <Button
              onClick={() => setShowAddForm(true)}
              className="h-10 px-4 gap-2 w-full sm:w-auto"
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
            { key: "open",   label: t('openStatus'),       count: stats.open,    active: statusFilters.includes("Open"),     accent: "lime",    onClick: () => { setStatusFilters(["Open"]);   setOutcomeFilters(["all"]); } },
            { key: "closed", label: t('closedStatus'),     count: stats.closed,  active: statusFilters.includes("Closed"),   accent: "emerald", onClick: () => { setStatusFilters(["Closed"]); setOutcomeFilters(["all"]); } },
            { key: "wins",   label: t('wins'),             count: stats.wins,    active: outcomeFilters.includes("Win"),     accent: "yellow",  onClick: () => { setStatusFilters(["all"]);    setOutcomeFilters(["Win"]); } },
            { key: "be",     label: "BE",                  count: stats.breakeven, active: outcomeFilters.includes("Breakeven"), accent: "orange",  onClick: () => { setStatusFilters(["all"]);    setOutcomeFilters(["Breakeven"]); } },
            { key: "losses", label: t('losses'),           count: stats.losses,  active: outcomeFilters.includes("Loss"),    accent: "red",     onClick: () => { setStatusFilters(["all"]);    setOutcomeFilters(["Loss"]); } },
          ];
          const accentMap = {
            slate:   { dot: "bg-muted-foreground",   text: "text-muted-foreground",   badgeActive: "bg-muted text-foreground" },
            lime:    { dot: "bg-primary",     text: "text-foreground",                          badgeActive: "bg-primary/15 text-primary" },
            emerald: { dot: "bg-profit", text: "text-profit dark:text-profit", badgeActive: "bg-profit/10 text-profit dark:bg-profit/10 dark:text-profit" },
            yellow:  { dot: "bg-profit",  text: "text-profit", badgeActive: "bg-profit/10 text-profit" },
            orange:  { dot: "bg-warning",  text: "text-warning", badgeActive: "bg-warning/10 text-warning" },
            red:     { dot: "bg-loss",     text: "text-loss dark:text-loss",       badgeActive: "bg-loss/10 text-loss" },
          };
          return (
            <div className="overflow-hidden rounded-[12px] border border-border bg-card shadow-none">
              <div
                role="tablist"
                className="journal-stat-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7"
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
                      className={`group relative inline-flex min-h-[64px] flex-col items-start justify-center gap-1 border-b border-r border-border px-3 py-2 text-left focus-visible:outline-none ${
                        tab.active
                          ? `${a.text} bg-ds-s3 shadow-[inset_0_0_0_1px_var(--ds-accent)]`
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${a.dot} ${tab.active ? "opacity-100" : "opacity-60"}`} />
                      <span className="text-xs sm:text-sm font-semibold tracking-tight whitespace-nowrap">{tab.label}</span>
                      <span
                        className={`ml-0.5 min-w-[1.5rem] text-center text-[11px] font-bold px-1.5 py-0.5 rounded-full transition-colors ${
                          tab.active ? a.badgeActive : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
                <div className="flex min-h-[64px] flex-col justify-center border-b border-r border-border px-3 py-2 col-span-2 md:col-span-3 lg:col-span-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ds-text2">{t('totalPL')}</p>
                  <p data-private className={`text-[18px] font-semibold leading-tight ${stats.totalPL >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {pnl.formatTrades(statsSource)}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Filters */}
        <Card className="relative z-50 isolate overflow-visible">
          <CardContent className="overflow-visible p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by symbol..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 rounded-lg pl-10"
                />
              </div>
              <div className="relative z-10 w-full shrink-0 md:w-[220px]" ref={accountFilterRef}>
                <button
                  type="button"
                  data-open={accountFilterOpen ? "true" : undefined}
                  onClick={() => setAccountFilterOpen((prev) => !prev)}
                  className="journal-filter-trigger relative flex w-full items-center justify-center px-4 py-2 text-sm hover:bg-ds-s3"
                >
                  <span className="w-full truncate pr-4 text-center">
                    {activeAccountFilterLabel || (t('allAccounts') || 'All Accounts')}
                  </span>
                  <ChevronDown className="journal-filter-chevron absolute right-3 h-4 w-4" />
                </button>
                {accountFilterOpen && (
                  <div className="ds-float-panel ds-float-in absolute left-0 z-[80] mt-2 max-h-64 w-full overflow-y-auto rounded-[16px] p-2">
                    <button
                      type="button"
                      onClick={() => {
                        toggleAccountFilter("all");
                      }}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted"
                    >
                      <span className="text-sm text-foreground truncate">{t('allAccounts') || 'All Accounts'}</span>
                      <div
                        className={`w-4 h-4 rounded-full border transition-all ${
                          accountFilters.includes("all")
                            ? 'border-ds-accent bg-ds-accent'
                            : 'bg-background border-border'
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
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted"
                        >
                          <span className="text-sm text-foreground truncate">{account.name}</span>
                          <div
                            className={`w-4 h-4 rounded-full border transition-all ${
                              isSelected
                                ? 'border-ds-accent bg-ds-accent'
                                : 'bg-background border-border'
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
              <div className="relative z-10 w-full shrink-0 md:w-[168px]" ref={timeFilterRef}>
                <button
                  type="button"
                  data-open={timeFilterOpen ? "true" : undefined}
                  onClick={() => setTimeFilterOpen((prev) => !prev)}
                  className="journal-filter-trigger relative flex w-full items-center justify-center px-4 py-2 text-sm hover:bg-ds-s3"
                >
                  <span className="w-full truncate pr-4 text-center">{activeTimeFilterLabel}</span>
                  <ChevronDown className="journal-filter-chevron absolute right-3 h-4 w-4" />
                </button>
                {timeFilterOpen && (
                  <div className="ds-float-panel ds-float-in absolute right-0 z-[80] mt-2 w-full rounded-[16px] p-2">
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
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted"
                        >
                          <span className="text-sm text-foreground">{option.label}</span>
                          <div
                            className={`w-4 h-4 rounded-full border transition-all ${
                              isChecked
                                ? 'border-ds-accent bg-ds-accent'
                                : 'bg-background border-border'
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
              <div className="w-full shrink-0 md:w-auto" ref={datePickerRef}>
                <button
                  type="button"
                  data-open={datePickerOpen ? "true" : undefined}
                  onClick={() => setDatePickerOpen((prev) => !prev)}
                  className={`journal-filter-trigger relative flex w-full items-center gap-2 px-4 py-2 text-sm md:w-auto ${
                    dateRangeActive && !datePickerOpen ? "bg-ds-s3" : ""
                  }`}
                >
                  <CalendarRange className="h-4 w-4 shrink-0" />
                  <span className="max-w-[150px] truncate">{dateRangeLabel}</span>
                  <ChevronDown className="journal-filter-chevron h-4 w-4 shrink-0" />
                </button>
                {datePickerOpen && (
                  <div className="journal-date-panel ds-float-panel ds-float-in absolute mt-2">
                    <DateRangeCalendar
                      from={dateRange.from}
                      to={dateRange.to}
                      onSelect={(f, t) => {
                        setDateRange({ from: f, to: t });
                        setTimeFilters(["all"]);
                      }}
                    />
                    {(dateRange.from || dateRange.to) && (
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-ds-frame pt-3">
                        <span className="text-[11px] text-ds-text3">
                          {dateRange.from && dateRange.to
                            ? `${dateRange.from.split("-").reverse().join(".")} – ${dateRange.to.split("-").reverse().join(".")}`
                            : dateRange.from
                              ? `Od ${dateRange.from.split("-").reverse().join(".")}`
                              : ""}
                        </span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setDateRange({ from: "", to: "" }); }} className="journal-cal-action">
                            Wyczyść
                          </button>
                          <button type="button" onClick={() => setDatePickerOpen(false)} className="journal-cal-action journal-cal-action-primary">
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
          <Card className="relative z-0 bg-card border-border">
            <CardContent className="p-0">
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="journal-table w-full min-w-[1180px] text-xs border-collapse [&_th]:px-1.5 [&_td]:px-1.5 [&_th]:py-2 [&_td]:py-2 [&_th]:leading-tight [&_td]:leading-tight [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                <thead className="bg-transparent border-b border-border">
                  <tr>
                    {visibleColumns.status && (
                      <th className="text-left px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('statusLabel')}</th>
                    )}
                    <th className="text-left px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap w-[92px]">{t('account') || 'Account'}</th>
                    {visibleColumns.date && (
                      <th className="text-left px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                        <button onClick={() => handleSort("date")} className="flex items-center gap-0.5 hover:text-primary">
                          {t('date')} <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                    )}
                    {visibleColumns.symbol && (
                      <th className="text-left px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('symbol')}</th>
                    )}
                    {visibleColumns.direction && (
                      <th className="text-left px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('direction')}</th>
                    )}
                    <th className="text-left px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap w-[92px]">{t('strategy') || 'Strategy'}</th>
                    {visibleColumns.entry && (
                      <th className="text-left px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('entryPrice')}</th>
                    )}
                    <th className="text-left px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('stopLossPips')}</th>
                    <th className="text-left px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('takeProfitPips')}</th>
                    {visibleColumns.exit && (
                      <th className="text-left px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('exit')}</th>
                    )}
                    {visibleColumns.position && (
                      <th className="text-left px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap w-[72px]">{t('lotSize')}</th>
                    )}
                    {visibleColumns.pl && (
                      <th className="text-left px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                        <button onClick={() => handleSort("profit_loss")} className="flex items-center gap-0.5 hover:text-primary">
                          {t('profitLoss')} <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                    )}
                    {visibleColumns.outcome && (
                      <th className="text-left px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('outcome')}</th>
                    )}
                    <th className="text-left px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap w-[110px]">{t('screenshots') || 'Scr'}</th>
                    {visibleColumns.actions && (
                      <th className="text-right px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('actions')}</th>
                    )}
                    <th className="text-center px-1.5 py-1 w-8">
                      <div 
                        onClick={toggleAllTrades}
                        className={`w-4 h-4 rounded-[4px] border cursor-pointer transition-colors duration-150 mx-auto ${
                          displayTrades.length > 0 && selectedTrades.size === displayTrades.length
                            ? 'border-ds-accent bg-ds-accent'
                            : 'border-ds-frame bg-transparent hover:border-ds-text3'
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
                  {visibleTrades.map((trade) => (
                    <tr
                      key={trade.id}
                      className={`border-b border-border transition-colors cursor-pointer ${selectedTrades.has(trade.id) ? "bg-accent" : "hover:bg-muted"}`}
                      onClick={(event) => handleRowPreview(trade, event)}
                    >
                      {visibleColumns.status && (
                        <td className="px-1.5 py-1">
                          <Badge className={`${tradeStatusBadgeClass(trade.status)} text-xs font-semibold px-1.5 py-0.5 border`}> 
                            {trade.status === "Open" ? <Clock className="w-3 h-3 mr-0.5" /> : <CheckCircle className="w-3 h-3 mr-0.5" />}
                            {tradeStatusDisplay(trade.status)}
                          </Badge>
                        </td>
                      )}
                      <td className="px-1 py-1 text-xs text-foreground max-w-[92px] truncate" title={accountNameById[String(trade.account_id)] || '-'}>
                        {accountNameById[String(trade.account_id)] || '-'}
                      </td>
                      {visibleColumns.date && (
                        <td className="px-1.5 py-1 text-sm text-foreground whitespace-nowrap">
                          <div>{formatTradeClockDate(trade, "entry", dateFormat) || fmtDate(trade.date)}</div>
                          {(trade.entry_time || trade.time) && (
                            <div className="text-[10px] text-muted-foreground">
                              {formatTradeClock(trade, "entry")}
                            </div>
                          )}
                        </td>
                      )}
                      {visibleColumns.symbol && (
                        <td className="px-1.5 py-1 text-sm font-semibold text-foreground whitespace-nowrap">{trade.symbol}</td>
                      )}
                      {visibleColumns.direction && (
                        <td className="px-1.5 py-1">
                          <Badge className={`${directionBadgeClass(trade.direction)} text-xs font-semibold px-1.5 py-0.5 border`}>
                            {directionLabel(trade.direction, t)}
                          </Badge>
                        </td>
                      )}
                      <td className="px-1 py-1 text-xs text-foreground max-w-[92px] truncate" title={strategyNameById[String(trade.strategy_id)] || '-'}>
                        {strategyNameById[String(trade.strategy_id)] || '-'}
                      </td>
                      {visibleColumns.entry && (
                        <td className="px-1 py-1 text-sm text-foreground whitespace-nowrap">
                          <div>{trade.entry_price ?? '-'}</div>
                          {(trade.entry_time || trade.time) && (
                            <div className="text-[10px] text-muted-foreground">
                              {formatTradeClock(trade, "entry")}
                            </div>
                          )}
                        </td>
                      )}
                      <td className="px-1 py-1 text-sm text-foreground whitespace-nowrap">{trade.stop_loss_pips ?? trade.stop_loss_amount ?? trade.stop_loss ?? '-'}</td>
                      <td className="px-1 py-1 text-sm text-foreground whitespace-nowrap">{trade.take_profit_pips ?? trade.take_profit_amount ?? trade.take_profit ?? '-'}</td>
                      {visibleColumns.exit && (
                        <td className="px-1 py-1 text-sm text-foreground whitespace-nowrap">
                          <div>{trade.exit_price ?? '-'}</div>
                          {(trade.exit_time || (trade.close_date && trade.close_date !== trade.date)) && (
                            <div className="text-[10px] text-muted-foreground">
                              {trade.close_date && trade.close_date !== trade.date
                                ? `${formatTradeClockDate(trade, "exit", dateFormat)} `
                                : ""}
                              {trade.exit_time ? formatTradeClock(trade, "exit") : ""}
                            </div>
                          )}
                        </td>
                      )}
                      {visibleColumns.position && (
                        <td className="px-1 py-1 text-sm text-foreground whitespace-nowrap max-w-[72px] truncate" title={String(trade.position_size || '')}>{trade.position_size}</td>
                      )}
                      {visibleColumns.pl && (
                        <td className="px-1.5 py-1">
                          {trade.profit_loss != null ? (() => {
                            const pl = getTradeRealizedPL(trade) ?? 0;
                            return (
                            <div data-private className="flex items-center gap-0.5">
                              {pl > 0 ? (
                                <TrendingUp className="w-3 h-3 text-profit" />
                              ) : pl < 0 ? (
                                <TrendingDown className="w-3 h-3 text-loss" />
                              ) : null}
                              <span className={`text-sm font-semibold ${
                                pl > 0 ? 'text-profit' :
                                pl < 0 ? 'text-loss' :
                                'text-muted-foreground'
                              }`} title={trade.commission != null ? `Commission: ${trade.commission}` : undefined}>
                                {pnl.formatTrade(trade)}
                              </span>
                            </div>
                            );
                          })() : <span className="text-sm text-muted-foreground">-</span>}
                        </td>
                      )}
                      {visibleColumns.outcome && (
                        <td className="px-1 py-1">
                          {trade.outcome && (
                            <Badge variant="outline" className={`text-xs font-semibold px-1.5 py-0.5 border ${tradeOutcomeBadgeClass(trade.outcome)}`}>
                              {tradeOutcomeDisplay(trade.outcome)}
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
                                className="h-7 w-7 rounded-[6px] overflow-hidden border border-border bg-muted shrink-0"
                                onClick={() => openQuickImage(imageUrl)}
                                title={`${t('screenshot') || 'Screenshot'} ${index + 1}`}
                              >
                                <SafeImage src={imageUrl} alt={`${t('screenshot') || 'Screenshot'} ${index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                              </button>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
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
                            <Button size="sm" variant="outline" onClick={() => handleDelete(trade.id)} className="text-loss h-5 w-5 p-0">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      )}
                      <td className="text-center px-1 py-1">
                        <div 
                          data-row-action
                          onClick={() => toggleTradeSelection(trade.id)}
                          className={`w-4 h-4 rounded-[4px] border cursor-pointer transition-colors duration-150 mx-auto ${
                            selectedTrades.has(trade.id)
                              ? 'border-ds-accent bg-ds-accent'
                              : 'border-ds-frame bg-transparent hover:border-ds-text3'
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
              <div className="relative z-0 md:hidden p-3">
                <JournalMobileList
                  trades={visibleTrades}
                  t={t}
                  accountNameById={accountNameById}
                  strategyNameById={strategyNameById}
                  onView={handleViewTrade}
                />
              </div>

              {displayTrades.length === 0 && (
                <div className="hidden md:block text-center py-12">
                  <p className="text-muted-foreground">No trades to display</p>
                </div>
              )}
              {displayTrades.length > visibleTrades.length && (
                <div className="flex justify-center border-t border-border px-3 py-3">
                  <Button type="button" variant="outline" onClick={() => setVisibleCount((count) => count + JOURNAL_PAGE_SIZE)}>
                    {t("showMore") || "Pokaż więcej"} ({visibleTrades.length}/{displayTrades.length})
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!isSingleStatusMode && (statusFilters.includes("all") || statusFilters.includes("Planned")) && (
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">{t('plannedTrades')}</CardTitle>
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setPlannedOpen(prev => !prev)}
                aria-label={t('plannedTrades')}
              >
                {plannedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CardHeader>
            {plannedOpen ? (
              <CardContent className="p-0">
                <div className="hidden md:block overflow-x-auto">
                  <table className="journal-table w-full min-w-[980px] divide-y divide-border text-xs [&_th]:px-1.5 [&_td]:px-1.5 [&_th]:py-2 [&_td]:py-2 [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap">
                    <thead>
                      <tr>
                        {visibleColumns.date && (
                          <th className="px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('date')}</th>
                        )}
                        <th className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap w-[92px]">{t('account') || 'Account'}</th>
                        {visibleColumns.symbol && (
                          <th className="px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('symbol')}</th>
                        )}
                        {visibleColumns.direction && (
                          <th className="px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('direction')}</th>
                        )}
                        <th className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap w-[92px]">{t('strategy') || 'Strategy'}</th>
                        <th className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('entryPrice')}</th>
                        <th className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('stopLossPips')}</th>
                        <th className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('takeProfitPips')}</th>
                        {visibleColumns.notes && (
                          <th className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('notes')}</th>
                        )}
                        <th className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('screenshots') || 'Scr'}</th>
                        {visibleColumns.actions && (
                          <th className="text-right px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{t('actions')}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePlanned.map((trade) => (
                        <tr
                          key={trade.id}
                          className="border-b border-border hover:bg-muted transition-colors cursor-pointer"
                          onClick={(event) => handleRowPreview(trade, event)}
                        >
                          {visibleColumns.date && (
                            <td className="px-1 py-1 text-sm text-foreground whitespace-nowrap">{fmtDate(trade.date)}</td>
                          )}
                          <td className="px-1 py-1 text-xs text-foreground max-w-[92px] truncate" title={accountNameById[String(trade.account_id)] || '-'}>
                            {accountNameById[String(trade.account_id)] || '-'}
                          </td>
                          {visibleColumns.symbol && (
                            <td className="px-1 py-1 text-sm text-foreground whitespace-nowrap">{trade.symbol}</td>
                          )}
                          {visibleColumns.direction && (
                            <td className="px-1 py-1">
                              <Badge className={`${directionBadgeClass(trade.direction)} text-xs font-semibold px-1.5 py-0.5 border`}>
                                {directionLabel(trade.direction, t)}
                              </Badge>
                            </td>
                          )}
                          <td className="px-1 py-1 text-xs text-foreground max-w-[92px] truncate" title={strategyNameById[String(trade.strategy_id)] || '-'}>
                            {strategyNameById[String(trade.strategy_id)] || '-'}
                          </td>
                          <td className="px-1 py-1 text-sm text-foreground whitespace-nowrap">{trade.entry_price ?? '-'}</td>
                          <td className="px-1 py-1 text-sm text-foreground whitespace-nowrap">{trade.stop_loss_pips ?? '-'}</td>
                          <td className="px-1 py-1 text-sm text-foreground whitespace-nowrap">{trade.take_profit_pips ?? '-'}</td>
                          {visibleColumns.notes && (
                            <td className="px-1 py-1 text-sm text-foreground line-clamp-2">{stripNoteMarkdown(trade.notes)}</td>
                          )}
                          <td className="px-1 py-1">
                            <div className="flex items-center gap-1 w-[72px]">
                              {getScreenshotList(trade).length > 0 ? (
                                getScreenshotList(trade).map((imageUrl, index) => (
                                  <button
                                    key={`${trade.id}-planned-shot-${index}`}
                                    type="button"
                                    className="h-7 w-7 rounded-[6px] overflow-hidden border border-border bg-muted shrink-0"
                                    onClick={() => openQuickImage(imageUrl)}
                                    title={`${t('screenshot') || 'Screenshot'} ${index + 1}`}
                                  >
                                    <SafeImage src={imageUrl} alt={`${t('screenshot') || 'Screenshot'} ${index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                  </button>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
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
                                  className="text-primary h-5 w-5 p-0"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleDelete(trade.id)} className="text-loss h-5 w-5 p-0">
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
                <div className="relative z-0 md:hidden p-3">
                  <JournalMobileList
                    trades={visiblePlanned}
                    t={t}
                    accountNameById={accountNameById}
                    strategyNameById={strategyNameById}
                    onView={handleViewTrade}
                  />
                </div>
                {plannedTrades.length === 0 && (
                  <div className="hidden md:block">
                    <EmptyState description={t('noTradesToDisplay')} />
                  </div>
                )}
                {plannedTrades.length > visiblePlanned.length && (
                  <div className="flex justify-center border-t border-border px-3 py-3">
                    <Button type="button" variant="outline" onClick={() => setVisibleCount((count) => count + JOURNAL_PAGE_SIZE)}>
                      {t("showMore") || "Pokaż więcej"} ({visiblePlanned.length}/{plannedTrades.length})
                    </Button>
                  </div>
                )}
              </CardContent>
            ) : (
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  {t('plannedTrades')}: {plannedTrades.length}
                </p>
              </CardContent>
            )}
          </Card>
        )}


        {/* Add Trade Dialog */}
        <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
          <DialogContent
            className="max-w-6xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto gap-0 bg-card text-card-foreground p-0 max-md:!left-0 max-md:!top-0 max-md:!translate-x-0 max-md:!translate-y-0 max-md:!w-full max-md:!max-w-none max-md:!h-[100dvh] max-md:!max-h-[100dvh] max-md:!rounded-none"
            {...preventDialogDismissProps}
            onEscapeKeyDown={(event) => event.preventDefault()}
          >
            <div className="sticky top-0 z-10 bg-card px-4 py-3 pr-12 border-b border-border">
              <DialogTitle>{t('addTrade')}</DialogTitle>
            </div>
            <div className="p-4">
              <Suspense fallback={<FormFallback />}>
              <TradeFormNew
                embedded
                defaultStatus={isPlannedMode ? "Planned" : isMissedMode ? "Missed" : "Open"}
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

        {/* Edit Trade Dialog */}
        <Dialog open={editingTrade !== null} onOpenChange={() => setEditingTrade(null)}>
          <DialogContent
            className="max-w-6xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto gap-0 bg-card text-card-foreground p-0 max-md:!left-0 max-md:!top-0 max-md:!translate-x-0 max-md:!translate-y-0 max-md:!w-full max-md:!max-w-none max-md:!h-[100dvh] max-md:!max-h-[100dvh] max-md:!rounded-none"
            {...preventDialogDismissProps}
          >
            <div className="sticky top-0 z-10 bg-card px-4 py-3 pr-12 border-b border-border">
              <DialogTitle>Edit Trade</DialogTitle>
            </div>
            <div className="p-4">
              {editingTrade && (
                <Suspense fallback={<FormFallback />}>
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
                </Suspense>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <TradePreviewPanel
          open={viewingTrade !== null}
          trade={viewingTrade}
          trades={displayTrades}
          strategy={strategies.find((s) => String(s.id) === String(viewingTrade?.strategy_id)) || null}
          onOpenChange={(next) => {
            if (!next) setViewingTrade(null);
          }}
          onSelectTrade={handleViewTrade}
          onEdit={(tradeToEdit) => {
            if (!tradeToEdit?.id) return;
            setViewingTrade(null);
            goToTradeDetails(navigate, tradeToEdit, displayTrades);
          }}
          onPatched={(patch) => {
            setViewingTrade((prev) => (prev ? { ...prev, ...patch } : prev));
            queryClient.invalidateQueries({ queryKey: ["trades", user?.id] });
          }}
        />

        <ImageViewer open={viewerOpen} onOpenChange={setViewerOpen} imageUrl={viewerImage} />

        <AlertDialog
          open={deleteDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteDialog({ open: false, mode: null, tradeId: null, count: 0 });
            }
          }}
        >
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">
                {deleteDialog.mode === "bulk" ? "Usunąć zaznaczone transakcje?" : "Usunąć transakcję?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                {deleteDialog.mode === "bulk"
                  ? `Ta operacja usunie ${deleteDialog.count} transakcje i nie da sie jej cofnac.`
                  : "Ta operacja usunie transakcje i nie da sie jej cofnac."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-card text-foreground border-border">
                Anuluj
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-loss text-white hover:bg-loss/90"
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
