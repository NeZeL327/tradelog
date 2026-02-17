import React, { useState } from "react";
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
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { parseISO, isSameDay, isSameWeek, isSameMonth } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TradeFormNew from "../components/TradeFormNew";
import TradeCard from "../components/TradeCard";
import { ExportButton } from "../components/ExportButton";
import { useLanguage } from "@/components/LanguageProvider";
import { directionBadgeClass, directionLabel } from "@/lib/utils";

export default function JournalSimple() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilters, setStatusFilters] = useState(["all"]);
  const [timeFilter, setTimeFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [viewingTrade, setViewingTrade] = useState(null);
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [plannedOpen, setPlannedOpen] = useState(false);
  const [selectedTrades, setSelectedTrades] = useState(new Set());
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
    if (confirm("Are you sure you want to delete this trade?")) {
      deleteTradeMutation.mutate(id);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTrades.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedTrades.size} trade(s)?`)) {
      for (const id of selectedTrades) {
        await deleteTrade(user?.id, id);
      }
      setSelectedTrades(new Set());
      queryClient.invalidateQueries({ queryKey: ['trades', user?.id] });
      refetch();
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
    if (selectedTrades.size === executedTrades.length && executedTrades.length > 0) {
      setSelectedTrades(new Set());
    } else {
      setSelectedTrades(new Set(executedTrades.map(t => t.id)));
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
    const symbolTrades = trades.filter(t => t.symbol === trade.symbol && t.status !== "Planned");
    const wins = symbolTrades.filter(t => t.outcome === "Win").length;
    const total = symbolTrades.length;
    const totalPL = symbolTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0);
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
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  // Filter and search (base)
  const baseFilteredTrades = trades.filter(t => {
    if (searchTerm && !t.symbol.toLowerCase().includes(searchTerm.toLowerCase())) return false;

    if (timeFilter !== "all") {
      if (!t.date) return false;
      const tradeDate = parseISO(t.date);
      const now = new Date();

      if (timeFilter === "day" && !isSameDay(tradeDate, now)) return false;
      if (timeFilter === "week" && !isSameWeek(tradeDate, now, { weekStartsOn: 1 })) return false;
      if (timeFilter === "month" && !isSameMonth(tradeDate, now)) return false;
    }

    if (accountFilter !== "all") {
      if (String(t.account_id) !== String(accountFilter)) return false;
    }

    return true;
  });

  const statusFilteredTrades = statusFilters.includes("all")
    ? baseFilteredTrades
    : baseFilteredTrades.filter(t => statusFilters.includes(t.status));

  const outcomeFilteredTrades = outcomeFilter === "all"
    ? statusFilteredTrades
    : statusFilteredTrades.filter(t => t.outcome === outcomeFilter);

  const filteredTrades = sortTrades(outcomeFilteredTrades);
  const plannedTrades = sortTrades(baseFilteredTrades.filter(t => t.status === "Planned"));
  const executedTradesBase = baseFilteredTrades.filter(t => t.status !== "Planned");
  const executedTrades = sortTrades(
    statusFilters.includes("all")
      ? executedTradesBase
      : executedTradesBase.filter(t => statusFilters.includes(t.status))
  );
  const toggleStatusFilter = (value) => {
    setStatusFilters(prev => {
      if (value === "all") return ["all"];
      const withoutAll = prev.filter(v => v !== "all");
      const exists = withoutAll.includes(value);
      const next = exists ? withoutAll.filter(v => v !== value) : [...withoutAll, value];
      return next.length ? next : ["all"];
    });
  };


  const stats = {
    total: filteredTrades.length,
    open: filteredTrades.filter(t => t.status === "Open").length,
    closed: filteredTrades.filter(t => t.status === "Closed").length,
    planned: filteredTrades.filter(t => t.status === "Planned").length,
    wins: filteredTrades.filter(t => t.outcome === "Win").length,
    losses: filteredTrades.filter(t => t.outcome === "Loss").length,
    totalPL: filteredTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0)
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-[#0f0f16] dark:via-[#14141f] dark:to-[#1a1a2e]">
      <div className="w-full mx-auto space-y-4">
        {/* Bulk Actions Bar */}
        {selectedTrades.size > 0 && (
          <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-white dark:bg-slate-800 shadow-2xl rounded-xl border border-slate-200 dark:border-slate-700 px-4 md:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-4 animate-in slide-in-from-top-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <span className="text-xs md:text-sm font-bold text-blue-600 dark:text-blue-300">{selectedTrades.size}</span>
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Trade Journal</h1>
            <p className="text-slate-600 dark:text-slate-400">Track and analyze your trading performance</p>
          </div>
          <div className="flex gap-3">
            <ExportButton
              trades={filteredTrades}
              accounts={accounts}
              strategies={strategies}
              analytics={{
                totalTrades: filteredTrades.length,
                totalPL: filteredTrades.reduce((sum, t) => sum + (parseFloat(t.profit_loss) || 0), 0),
                winRate: filteredTrades.length
                  ? (filteredTrades.filter(t => t.outcome === "Win").length / filteredTrades.length) * 100
                  : 0,
                profitFactor: 0,
                avgWin: 0,
                avgLoss: 0
              }}
              type="journal"
            />
            <Button 
              onClick={() => setShowAddForm(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Trade
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
          <Card
            className={`bg-white dark:bg-[#1a1a2e] shadow-lg cursor-pointer ${statusFilters.includes("all") && outcomeFilter === "all" ? "ring-2 ring-blue-500" : ""}`}
            onClick={() => { setStatusFilters(["all"]); setOutcomeFilter("all"); }}
          >
            <CardContent className="p-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('totalTradesLabel')}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
            </CardContent>
          </Card>
          <Card
            className={`bg-blue-50 dark:bg-blue-950 shadow-lg border-blue-200 dark:border-blue-800 cursor-pointer ${statusFilters.includes("Open") ? "ring-2 ring-blue-500" : ""}`}
            onClick={() => { setStatusFilters(["Open"]); setOutcomeFilter("all"); }}
          >
            <CardContent className="p-4">
              <p className="text-sm text-blue-700 dark:text-blue-400 mb-1">{t('openStatus')}</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.open}</p>
            </CardContent>
          </Card>
          <Card
            className={`bg-green-50 dark:bg-green-950 shadow-lg border-green-200 dark:border-green-800 cursor-pointer ${statusFilters.includes("Closed") ? "ring-2 ring-green-500" : ""}`}
            onClick={() => { setStatusFilters(["Closed"]); setOutcomeFilter("all"); }}
          >
            <CardContent className="p-4">
              <p className="text-sm text-green-700 dark:text-green-400 mb-1">{t('closedStatus')}</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.closed}</p>
            </CardContent>
          </Card>
          <Card
            className={`bg-yellow-50 dark:bg-yellow-950 shadow-lg border-yellow-200 dark:border-yellow-800 cursor-pointer ${outcomeFilter === "Win" ? "ring-2 ring-yellow-500" : ""}`}
            onClick={() => { setOutcomeFilter("Win"); }}
          >
            <CardContent className="p-4">
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-1">{t('wins')}</p>
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{stats.wins}</p>
            </CardContent>
          </Card>
          <Card
            className={`bg-red-50 dark:bg-red-950 shadow-lg border-red-200 dark:border-red-800 cursor-pointer ${outcomeFilter === "Loss" ? "ring-2 ring-red-500" : ""}`}
            onClick={() => { setOutcomeFilter("Loss"); }}
          >
            <CardContent className="p-4">
              <p className="text-sm text-red-700 dark:text-red-400 mb-1">{t('losses')}</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.losses}</p>
            </CardContent>
          </Card>
          <Card
            className={`bg-amber-50 dark:bg-amber-950 shadow-lg border-amber-200 dark:border-amber-800 cursor-pointer ${statusFilters.includes("Planned") ? "ring-2 ring-amber-500" : ""}`}
            onClick={() => { setStatusFilters(["Planned"]); setOutcomeFilter("all"); }}
          >
            <CardContent className="p-4">
              <p className="text-sm text-amber-700 dark:text-amber-400 mb-1">{t('planned')}</p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.planned}</p>
            </CardContent>
          </Card>
          <Card className={`shadow-lg ${stats.totalPL >= 0 ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
            <CardContent className="p-4">
              <p className={`text-sm mb-1 ${stats.totalPL >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{t('totalPL')}</p>
              <p className={`text-2xl font-bold ${stats.totalPL >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {stats.totalPL >= 0 ? '+' : ''}{stats.totalPL.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-white dark:bg-slate-800 shadow-lg">
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
              <div className="flex flex-wrap gap-3 items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div 
                    className={`w-5 h-5 rounded-full border-[3px] transition-all shadow-sm hover:shadow-md ${
                      statusFilters.includes("all")
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-400 dark:border-slate-500 hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                    }`}
                    onClick={() => { toggleStatusFilter("all"); setOutcomeFilter("all"); }}
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
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-400 dark:border-slate-500 hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                    }`}
                    onClick={() => { toggleStatusFilter("Open"); setOutcomeFilter("all"); }}
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
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-400 dark:border-slate-500 hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                    }`}
                    onClick={() => { toggleStatusFilter("Closed"); setOutcomeFilter("all"); }}
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
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-400 dark:border-slate-500 hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                    }`}
                    onClick={() => { toggleStatusFilter("Planned"); setOutcomeFilter("all"); }}
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
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-[#1a1a2e] dark:text-slate-200"
              >
                <option value="all">All Time</option>
                <option value="day">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-[#1a1a2e] dark:text-slate-200"
              >
                <option value="all">{t('allAccounts') || 'All Accounts'}</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {(statusFilters.includes("all") || statusFilters.some(s => s !== "Planned")) && (
          <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl">
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm border-collapse">
                <thead className="bg-slate-50 dark:bg-[#14141f] border-b border-slate-200 dark:border-[#2d2d40]">
                  <tr>
                    {visibleColumns.status && (
                      <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('statusLabel')}</th>
                    )}
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
                    {visibleColumns.entry && (
                      <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('entryPrice')}</th>
                    )}
                    <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('stopLossPips')}</th>
                    <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('takeProfitPips')}</th>
                    {visibleColumns.exit && (
                      <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('exit')}</th>
                    )}
                    {visibleColumns.position && (
                      <th className="text-left px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('lotSize')}</th>
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
                    {visibleColumns.actions && (
                      <th className="text-right px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('actions')}</th>
                    )}
                    <th className="text-center px-1.5 py-1 w-8">
                      <div 
                        onClick={toggleAllTrades}
                        className={`w-4 h-4 rounded-full border-[2px] cursor-pointer transition-all mx-auto shadow-sm hover:shadow-md ${
                          executedTrades.length > 0 && selectedTrades.size === executedTrades.length
                            ? 'bg-blue-600 border-blue-600'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-400 dark:border-slate-500 hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700/70'
                        }`}
                      >
                        {executedTrades.length > 0 && selectedTrades.size === executedTrades.length && (
                          <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {executedTrades.map((trade) => (
                    <tr key={trade.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      {visibleColumns.status && (
                        <td className="px-1.5 py-1">
                          <Badge className={trade.status === "Open" 
                            ? "bg-blue-500 text-white dark:bg-blue-600 dark:text-white text-sm px-2 py-0.5" 
                            : "bg-green-500 text-white dark:bg-green-600 dark:text-white text-sm px-2 py-0.5"
                          }>
                            {trade.status === "Open" ? <Clock className="w-2.5 h-2.5 mr-0.5" /> : <CheckCircle className="w-2.5 h-2.5 mr-0.5" />}
                            {trade.status}
                          </Badge>
                        </td>
                      )}
                      {visibleColumns.date && (
                        <td className="px-1.5 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.date}</td>
                      )}
                      {visibleColumns.symbol && (
                        <td className="px-1.5 py-1 text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.symbol}</td>
                      )}
                      {visibleColumns.direction && (
                        <td className="px-1.5 py-1">
                          <Badge className={`${directionBadgeClass(trade.direction)} text-sm px-2 py-0.5`}>
                            {directionLabel(trade.direction, t)}
                          </Badge>
                        </td>
                      )}
                      {visibleColumns.entry && (
                        <td className="px-1.5 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.entry_price ?? '-'}</td>
                      )}
                      <td className="px-1.5 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.stop_loss_pips ?? '-'}</td>
                      <td className="px-1.5 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.take_profit_pips ?? '-'}</td>
                      {visibleColumns.exit && (
                        <td className="px-1.5 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.exit_price || '-'}</td>
                      )}
                      {visibleColumns.position && (
                        <td className="px-1.5 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.position_size}</td>
                      )}
                      {visibleColumns.pl && (
                        <td className="px-1.5 py-1">
                          {trade.profit_loss != null ? (
                            <div className="flex items-center gap-0.5">
                              {parseFloat(trade.profit_loss) > 0 ? (
                                <TrendingUp className="w-3 h-3 text-green-600" />
                              ) : parseFloat(trade.profit_loss) < 0 ? (
                                <TrendingDown className="w-3 h-3 text-red-600" />
                              ) : null}
                              <span className={`text-sm font-semibold ${
                                parseFloat(trade.profit_loss) > 0 ? 'text-green-600' :
                                parseFloat(trade.profit_loss) < 0 ? 'text-red-600' :
                                'text-slate-600'
                              }`}>
                                {parseFloat(trade.profit_loss) > 0 ? '+' : ''}{parseFloat(trade.profit_loss).toFixed(2)}
                              </span>
                            </div>
                          ) : <span className="text-sm text-slate-400">-</span>}
                        </td>
                      )}
                      {visibleColumns.outcome && (
                        <td className="px-3 py-2.5">
                          {trade.outcome && (
                            <Badge variant="outline" className={`text-sm px-2 py-0.5 ${
                              trade.outcome === "Win" ? "border-green-600 text-green-600" :
                              trade.outcome === "Loss" ? "border-red-600 text-red-600" :
                              "border-slate-600 text-slate-600"
                            }`}>
                              {trade.outcome}
                            </Badge>
                          )}
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className="px-1 py-1">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => handleViewTrade(trade)} className="h-6 w-6 p-0">
                              <Eye className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingTrade(trade)} className="h-6 w-6 p-0">
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(trade.id)} className="text-red-600 h-6 w-6 p-0">
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
                              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-400 dark:border-slate-500 hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700/70'
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

              {executedTrades.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-500">No trades to display</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(statusFilters.includes("all") || statusFilters.includes("Planned")) && (
          <Card className="bg-yellow-50 dark:bg-[#2e2e1a] shadow-xl">
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
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-[#23233a] text-sm">
                    <thead>
                      <tr>
                        {visibleColumns.date && (
                          <th className="px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('date')}</th>
                        )}
                        {visibleColumns.symbol && (
                          <th className="px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('symbol')}</th>
                        )}
                        {visibleColumns.direction && (
                          <th className="px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('direction')}</th>
                        )}
                        <th className="px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('entryPrice')}</th>
                        <th className="px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('stopLossPips')}</th>
                        <th className="px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('takeProfitPips')}</th>
                        {visibleColumns.notes && (
                          <th className="px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('notes')}</th>
                        )}
                        {visibleColumns.actions && (
                          <th className="text-right px-1.5 py-1 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('actions')}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {plannedTrades.map((trade) => (
                        <tr key={trade.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors">
                          {visibleColumns.date && (
                            <td className="px-1.5 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.date}</td>
                          )}
                          {visibleColumns.symbol && (
                            <td className="px-1.5 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.symbol}</td>
                          )}
                          {visibleColumns.direction && (
                            <td className="px-1.5 py-1">
                              <Badge className={`${directionBadgeClass(trade.direction)} text-sm px-2 py-0.5`}>
                                {directionLabel(trade.direction, t)}
                              </Badge>
                            </td>
                          )}
                          <td className="px-1.5 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.entry_price ?? '-'}</td>
                          <td className="px-1.5 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.stop_loss_pips ?? '-'}</td>
                          <td className="px-1.5 py-1 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">{trade.take_profit_pips ?? '-'}</td>
                          {visibleColumns.notes && (
                            <td className="px-1.5 py-1 text-sm text-slate-900 dark:text-slate-100 line-clamp-2">{trade.notes}</td>
                          )}
                          {visibleColumns.actions && (
                            <td className="px-1 py-1">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => handleViewTrade(trade)} className="h-6 w-6 p-0">
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingTrade(trade)}
                                  className="text-blue-600 h-6 w-6 p-0"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleDelete(trade.id)} className="text-red-600 h-6 w-6 p-0">
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
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white p-0">
            <div className="sticky top-0 bg-white p-6 border-b">
              <DialogTitle>Add New Trade</DialogTitle>
            </div>
            <div className="p-6">
              <TradeFormNew
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

        {/* View Trade Dialog */}
        <Dialog open={viewingTrade !== null} onOpenChange={() => setViewingTrade(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 bg-white dark:bg-[#1a1a2e] border-slate-200 dark:border-slate-700">
            <DialogHeader className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 text-white px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <DialogTitle className="text-white text-xl font-bold">Trade Details</DialogTitle>
            </DialogHeader>
            <div className="p-6 bg-white dark:bg-[#1a1a2e]">
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
      </div>
    </div>
  );
}
