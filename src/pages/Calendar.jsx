import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, addMonths, addYears, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import { useAuth } from "@/lib/AuthContext";
import { getStrategies, getTrades, getTradingAccounts } from "@/lib/localStorage";
import { useLanguage } from "@/components/LanguageProvider";
import { useUserSettings } from "@/hooks/use-user-settings";
import { usePnlDisplay } from "@/hooks/use-pnl-display";
import { getActiveAccountIds, getTradeRealizedPL, isClosedTrade, tradeBelongsToActiveAccount } from "@/lib/utils";
import { goToTradeDetails } from "@/lib/tradeDetailsNav";
import { createPageUrl } from "@/utils";
import TradePreviewPanel from "../components/TradePreviewPanel";
import {
  buildDayIndex, buildInsights, buildMonth, buildWeek, buildYear, dateOfKey, dayKeyOf, matchesFilters,
} from "@/lib/calendarAggregates";
import { makeValueFormat, useMediaQuery } from "@/components/calendar/calendarUi";
import CalendarToolbar from "@/components/calendar/CalendarToolbar";
import CalendarFilters, { EMPTY_FILTERS, buildFilterDefs } from "@/components/calendar/CalendarFilters";
import { InsightsRow, MonthSummary } from "@/components/calendar/CalendarMonthSummary";
import CalendarMonthGrid from "@/components/calendar/CalendarMonthGrid";
import { WeekView, YearHeatmap } from "@/components/calendar/CalendarAltViews";
import { CalendarAgenda, CalendarEmpty, CalendarSkeleton } from "@/components/calendar/CalendarStates";
import CalendarDayPanel from "@/components/calendar/CalendarDayPanel";

const isWeekend = (date) => date.getDay() === 0 || date.getDay() === 6;

// Keyboard map for the month grid; returns the next focused date or null for unhandled keys.
function nextFocusDate(key, date, { shiftKey, hideWeekends }) {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[key];
  if (step) {
    let next = addDays(date, step);
    while (hideWeekends && isWeekend(next)) next = addDays(next, Math.sign(step));
    return next;
  }
  if (key === "Home") return startOfWeek(date, { weekStartsOn: 1 });
  if (key === "End") return addDays(endOfWeek(date, { weekStartsOn: 1 }), hideWeekends ? -2 : 0);
  if (key === "PageUp") return shiftKey ? addYears(date, -1) : addMonths(date, -1);
  if (key === "PageDown") return shiftKey ? addYears(date, 1) : addMonths(date, 1);
  return null;
}

// The roving tab stop must sit on a rendered cell: a hidden weekend falls back to its Friday,
// a key outside the grid to the first visible day of the month.
function resolveGridFocus(month, focusKey, hideWeekends) {
  const visible = month.weeks.flatMap((week) => week.cells).filter((cell) => !(hideWeekends && isWeekend(cell.date)));
  if (visible.some((cell) => cell.key === focusKey)) return focusKey;
  const date = dateOfKey(focusKey);
  if (hideWeekends && isWeekend(date)) {
    const friday = dayKeyOf(addDays(date, date.getDay() === 6 ? -1 : -2));
    if (visible.some((cell) => cell.key === friday)) return friday;
  }
  return (visible.find((cell) => cell.inMonth) || visible[0]).key;
}

function useCalendarData(userId) {
  const trades = useQuery({ queryKey: ["trades", userId], queryFn: () => getTrades(userId), enabled: !!userId });
  const accounts = useQuery({ queryKey: ["accounts", userId], queryFn: () => getTradingAccounts(userId), enabled: !!userId });
  const strategies = useQuery({ queryKey: ["strategies", userId], queryFn: () => getStrategies(userId), enabled: !!userId });
  return {
    trades: trades.data || [],
    accounts: accounts.data || [],
    strategies: strategies.data || [],
    isLoading: trades.isLoading || accounts.isLoading,
  };
}

export default function Calendar() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { show_weekends: showWeekends } = useUserSettings();
  const pnl = usePnlDisplay();
  const plText = language === "pl";
  const locale = plText ? pl : enUS;
  const todayKey = dayKeyOf(new Date());
  const isWide = useMediaQuery("(min-width: 1280px)");
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { trades, accounts, strategies, isLoading } = useCalendarData(user?.id);

  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [focusKey, setFocusKey] = useState(todayKey);
  const [selectedKey, setSelectedKey] = useState("");
  const [slideDir, setSlideDir] = useState("none");
  const [view, setView] = useState("month");
  const [unit, setUnit] = useState("pnl");
  const [density, setDensity] = useState("comfortable");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [viewingTrade, setViewingTrade] = useState(null);

  // Same trade set as Dashboard and Analytics: active accounts, closed/breakeven only.
  const activeIds = useMemo(() => getActiveAccountIds(accounts), [accounts]);
  const baseTrades = useMemo(
    () => trades.filter((trade) => tradeBelongsToActiveAccount(trade, activeIds) && isClosedTrade(trade)),
    [trades, activeIds],
  );
  const strategyOf = useCallback(
    (trade) => strategies.find((item) => String(item.id) === String(trade?.strategy_id))?.name || String(trade?.setup || "").trim(),
    [strategies],
  );
  const filterDefs = useMemo(
    () => buildFilterDefs({ trades: baseTrades, accounts, strategyOf, plText, t }),
    [baseTrades, accounts, strategyOf, plText, t],
  );
  const filteredTrades = useMemo(
    () => baseTrades.filter((trade) => matchesFilters(trade, filters, strategyOf)),
    [baseTrades, filters, strategyOf],
  );
  const dayIndex = useMemo(() => buildDayIndex(filteredTrades), [filteredTrades]);
  const month = useMemo(() => buildMonth(dayIndex, monthDate), [dayIndex, monthDate]);
  const insights = useMemo(() => buildInsights(dayIndex, month), [dayIndex, month]);
  const week = useMemo(() => (view === "week" ? buildWeek(dayIndex, dateOfKey(focusKey)) : null), [view, dayIndex, focusKey]);
  const year = useMemo(() => (view === "year" ? buildYear(dayIndex, monthDate.getFullYear()) : null), [view, dayIndex, monthDate]);
  const monthsWithData = useMemo(() => new Set([...dayIndex.keys()].map((key) => key.slice(0, 7))), [dayIndex]);
  const latestKey = useMemo(() => [...dayIndex.keys()].sort().pop() || "", [dayIndex]);

  // Drop filter values that no longer exist in the data (e.g. an account was deactivated).
  useEffect(() => {
    setFilters((prev) => {
      const next = { ...prev };
      Object.keys(prev).forEach((id) => {
        const def = filterDefs.find((item) => item.id === id);
        if (prev[id] !== "all" && !def?.options.some((option) => option.value === prev[id])) next[id] = "all";
      });
      return Object.keys(next).some((id) => next[id] !== prev[id]) ? next : prev;
    });
  }, [filterDefs]);

  const hasR = useMemo(() => [...dayIndex.values()].some((bucket) => bucket.rCount > 0), [dayIndex]);
  const activeUnit = unit === "r" && !hasR ? "pnl" : unit;
  const fmt = makeValueFormat(pnl, activeUnit);
  const hideWeekends = showWeekends === false && !month.weekendTrades;
  const filtered = Object.values(filters).some((value) => value !== "all");
  const gridFocusKey = resolveGridFocus(month, focusKey, hideWeekends);

  const goToDate = useCallback((date) => {
    const key = dayKeyOf(date);
    const nextMonth = startOfMonth(date);
    setFocusKey(key);
    setMonthDate((current) => {
      if (current.getTime() === nextMonth.getTime()) return current;
      setSlideDir(nextMonth > current ? "next" : "prev");
      return nextMonth;
    });
  }, []);

  const selectDay = useCallback((key) => {
    goToDate(dateOfKey(key));
    setSelectedKey(key);
  }, [goToDate]);

  const shiftPeriod = (delta) => {
    const base = dateOfKey(focusKey);
    if (view === "week") return goToDate(addDays(base, delta * 7));
    if (view === "year") return goToDate(addYears(base, delta));
    const target = addMonths(monthDate, delta);
    return goToDate(target.getMonth() === new Date().getMonth() && target.getFullYear() === new Date().getFullYear() ? new Date() : target);
  };

  const handleGridKey = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectDay(gridFocusKey);
      return;
    }
    const next = nextFocusDate(event.key, dateOfKey(gridFocusKey), { shiftKey: event.shiftKey, hideWeekends });
    if (!next) return;
    event.preventDefault();
    goToDate(next);
  };

  // Esc closes the inline panel; the drawer and the trade preview handle Esc themselves.
  useEffect(() => {
    if (!selectedKey || !isWide || viewingTrade) return undefined;
    const onKey = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setSelectedKey("");
      document.querySelector(`[role="grid"] [data-day="${selectedKey}"]`)?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedKey, isWide, viewingTrade]);

  const handleViewTrade = (trade) => {
    if (!trade) return;
    const symbolTrades = baseTrades.filter((item) => item.symbol === trade.symbol);
    const wins = symbolTrades.filter((item) => item.outcome === "Win").length;
    const total = symbolTrades.length;
    const totalPL = symbolTrades.reduce((sum, item) => sum + (getTradeRealizedPL(item) ?? 0), 0);
    const account = accounts.find((item) => String(item.id) === String(trade.account_id));
    const strategy = strategies.find((item) => String(item.id) === String(trade.strategy_id));
    setViewingTrade({
      ...trade,
      accountName: account?.name || "",
      strategyName: strategy?.name || "",
      symbolStats: {
        total,
        wins,
        winRate: total ? ((wins / total) * 100).toFixed(1) : "0.0",
        totalPL: totalPL.toFixed(2),
        avgPL: (total ? totalPL / total : 0).toFixed(2),
      },
    });
  };

  const unitOptions = [
    { id: "money", label: pnl.currencyLabel, title: plText ? "Wyniki w walucie konta" : "Results in account currency" },
    { id: "percent", label: "%", title: plText ? "Wyniki jako % salda konta" : "Results as % of account balance" },
    hasR ? { id: "r", label: "R", title: plText ? "Wyniki w R (tylko w kalendarzu)" : "Results in R (calendar only)" } : null,
  ].filter(Boolean);
  const onUnit = (id) => {
    if (id === "r") return setUnit("r");
    setUnit("pnl");
    return pnl.setMode(id);
  };

  const panelOpen = Boolean(selectedKey);
  const panelProps = {
    dayKey: selectedKey,
    bucket: dayIndex.get(selectedKey) || null,
    pnl,
    fmt,
    plText,
    locale,
    t,
    accounts,
    onOpenTrade: handleViewTrade,
    onClose: () => setSelectedKey(""),
    onOpenDashboard: () => navigate(`${createPageUrl("Dashboard")}?date=${selectedKey}`),
  };
  const emptyState = (
    <CalendarEmpty
      plText={plText}
      filtered={filtered}
      latestKey={latestKey}
      locale={locale}
      onJump={() => goToDate(dateOfKey(latestKey))}
      onClearFilters={() => setFilters(EMPTY_FILTERS)}
    />
  );

  const monthBody = isMobile ? (
    month.tradingDays ? <CalendarAgenda month={month} fmt={fmt} plText={plText} locale={locale} selectedKey={selectedKey} onSelect={selectDay} /> : emptyState
  ) : (
    <CalendarMonthGrid
      month={month}
      fmt={fmt}
      plText={plText}
      locale={locale}
      todayKey={todayKey}
      selectedKey={selectedKey}
      focusKey={gridFocusKey}
      onFocusKey={setFocusKey}
      onSelect={selectDay}
      onKeyNav={handleGridKey}
      hideWeekends={hideWeekends}
      density={density}
      slideDir={slideDir}
    />
  );

  return (
    <div className="w-full min-h-0 space-y-3 dashboard-surface">
      <CalendarToolbar
        plText={plText}
        locale={locale}
        monthDate={monthDate}
        monthsWithData={monthsWithData}
        onShift={shiftPeriod}
        onToday={() => goToDate(new Date())}
        onPickMonth={(date) => goToDate(date.getMonth() === new Date().getMonth() && date.getFullYear() === new Date().getFullYear() ? new Date() : date)}
        view={view}
        onView={setView}
        unitValue={activeUnit === "r" ? "r" : pnl.mode}
        unitOptions={unitOptions}
        onUnit={onUnit}
        density={density}
        onDensity={setDensity}
        periodLabel={{ month: plText ? "miesiąc" : "month", week: plText ? "tydzień" : "week", year: plText ? "rok" : "year" }[view]}
      />
      <CalendarFilters defs={filterDefs} filters={filters} onChange={setFilters} plText={plText} />

      {isLoading ? <CalendarSkeleton plText={plText} /> : (
        <div className={`grid items-start gap-3 ${isWide && panelOpen ? "grid-cols-[minmax(0,1fr)_400px]" : "grid-cols-1"}`}>
          <div className="min-w-0 space-y-3">
            {view === "month" ? (
              <>
                {month.tradingDays ? (
                  <>
                    <MonthSummary month={month} fmt={fmt} plText={plText} locale={locale} onPickDay={selectDay} stacked={isWide && panelOpen} />
                    <InsightsRow insights={insights} pnl={pnl} plText={plText} locale={locale} />
                  </>
                ) : (!isMobile ? emptyState : null)}
                {monthBody}
              </>
            ) : null}
            {view === "week" && week ? (
              <WeekView
                week={week}
                fmt={fmt}
                plText={plText}
                locale={locale}
                t={t}
                todayKey={todayKey}
                selectedKey={selectedKey}
                onSelect={selectDay}
                onOpenTrade={handleViewTrade}
                hideWeekends={hideWeekends}
                stacked={isMobile}
              />
            ) : null}
            {view === "year" && year ? (
              <YearHeatmap
                year={year}
                yearNumber={monthDate.getFullYear()}
                fmt={fmt}
                plText={plText}
                locale={locale}
                todayKey={todayKey}
                selectedKey={selectedKey}
                onPick={(key) => { setView("month"); selectDay(key); }}
              />
            ) : null}
          </div>
          <CalendarDayPanel inline={isWide} open={panelOpen} {...panelProps} />
        </div>
      )}

      <TradePreviewPanel
        open={viewingTrade !== null}
        trade={viewingTrade}
        trades={baseTrades}
        strategy={strategies.find((item) => String(item.id) === String(viewingTrade?.strategy_id)) || null}
        onOpenChange={(next) => {
          if (!next) setViewingTrade(null);
        }}
        onSelectTrade={handleViewTrade}
        onEdit={(tradeToEdit) => {
          if (!tradeToEdit?.id) return;
          setViewingTrade(null);
          goToTradeDetails(navigate, tradeToEdit, baseTrades);
        }}
        onPatched={(patch) => {
          setViewingTrade((prev) => (prev ? { ...prev, ...patch } : prev));
          queryClient.invalidateQueries({ queryKey: ["trades"] });
        }}
      />
    </div>
  );
}
