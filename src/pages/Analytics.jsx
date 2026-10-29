import { useState, useRef, useEffect } from "react";
import { useAuth } from '@/lib/AuthContext';
import { getTrades, getTradingAccounts, getStrategies } from '@/lib/localStorage';
import { directionChartColor, getActiveAccountIds, getTradeRealizedPL, isClosedTrade, isTradingAccountActive, tradeBelongsToActiveAccount, tradeOutcomeDisplay } from '@/lib/utils';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, TrendingUp, AlertCircle, Wallet, Activity, X, ChevronDown, Clock, ListChecks, AlertTriangle, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ComposedChart } from "recharts";
import { ExportButton } from "../components/ExportButton";
import { ImportButton } from "../components/ImportButton";
import { useLanguage } from "@/components/LanguageProvider";
import { usePnlDisplay } from "@/hooks/use-pnl-display";
import { normalizeEmotions, countFilledEmotionStages } from "@/components/EmotionsPanel";
import { getTradeEntryMinutes } from "@/lib/userSettings";
import { aggregateTagPerformance } from "@/lib/tradeTags";
import { CHART, chartTooltipStyle, chartGridProps, chartBarRadius, chartSeriesProps } from "@/lib/chartTheme";
import { SkeletonKpiRow, SkeletonBlock } from "@/components/ui/skeleton-block";
import QuoteLine from "@/components/QuoteLine";
import CountUpText from "@/components/CountUpText";
import MultiSelectFilter, { FILTER_LABEL_CLASS, FILTER_PANEL_CLASS, FILTER_TRIGGER_CLASS, filterItemClass } from "@/components/MultiSelectFilter";
import DateRangeCalendar from "@/components/DateRangeCalendar";
import { balanceForTrades } from "@/lib/pnlDisplay";
import {
  DATE_PRESETS,
  buildEquitySeries,
  computeAnalyticsKpis,
  dateRangeForPreset,
  hourWeekdayHeatmap,
  sortTradesChronoAsc,
  tradeInDateRange,
  weekdayStats,
} from "@/lib/analyticsStats";

const decidedWinRate = (wins, losses) => {
  const decided = wins + losses;
  return decided > 0 ? Number(((wins / decided) * 100).toFixed(1)) : 0;
};

const CHART_MARGIN = { top: 8, right: 16, left: 0, bottom: 8 };

// Oś Y z marginesem 10% nad i pod danymi (bezpieczna dla pustych serii).
const paddedDomain = [
  (dataMin) => (Number.isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.1)) : -10),
  (dataMax) => (Number.isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.1)) : 10),
];

const tooltipProps = {
  contentStyle: chartTooltipStyle,
  itemStyle: { color: "hsl(var(--popover-foreground))" },
  labelStyle: { color: "hsl(var(--foreground))" },
};

const fmtDay = (key) => String(key || "").slice(0, 10).split("-").reverse().join(".");
const fmtShortDay = (key) => fmtDay(key).slice(0, 5);

function SegToggle({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-[10px] border border-ds-line bg-ds-s2 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${value === option.value ? 'bg-ds-s3 text-ds-text' : 'text-ds-text3 hover:text-ds-text'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const DATE_PRESET_LABEL_KEYS = {
  all: 'anRangeAll',
  '7d': 'anRange7d',
  '30d': 'anRange30d',
  month: 'anRangeMonth',
  quarter: 'anRangeQuarter',
  year: 'anRangeYear',
  custom: 'anRangeCustom',
};

const weekStartKeyLocal = (dateStr) => {
  const s = String(dateStr || "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  dt.setDate(dt.getDate() - dt.getDay());
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
};

export default function Analytics() {
  const { t } = useLanguage();
  const pnl = usePnlDisplay();
  const { user } = useAuth();
  const [selectedAccounts, setSelectedAccounts] = useState(["all"]);
  const [filterSymbols, setFilterSymbols] = useState(["all"]);
  const [filterStrategies, setFilterStrategies] = useState(["all"]);
  const [filterDirections, setFilterDirections] = useState(["all"]);
  const [filterOutcomes, setFilterOutcomes] = useState(["all"]);
  const [filterTimeframes, setFilterTimeframes] = useState(["all"]);
  
  const [datePreset, setDatePreset] = useState("all");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = useRef(null);
  const [equityView, setEquityView] = useState("equity");
  const [equityAxis, setEquityAxis] = useState("trades");
  const queryClient = useQueryClient();
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [timePeriod, setTimePeriod] = useState("weekly");
  const [activeTab, setActiveTab] = useState("overview");
  // Po pierwszej zmianie zakładki karty nie mają już efektu "pojawiania się" — wystarcza fade zakładki.
  const [tabSwitched, setTabSwitched] = useState(false);

  const { data: trades = [], isLoading } = useQuery({
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

  const { data: strategies = [] } = useQuery({
    queryKey: ['strategies', user?.id],
    queryFn: () => getStrategies(user?.id),
    enabled: !!user?.id,
  });

  // Close date picker on outside click (multi-select filters close themselves)
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) setDatePickerOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const validIds = new Set(activeAccounts.map((acc) => String(acc.id)));
    setSelectedAccounts((prev) => {
      if (prev.includes('all')) return prev;
      const sanitized = prev.filter((id) => validIds.has(String(id)));
      return sanitized.length ? sanitized : ['all'];
    });
  }, [accounts]);

  const normalizeDirection = (direction) => {
    if (!direction) return "";
    const normalized = direction.toLowerCase();
    if (normalized === "long" || normalized === "buy") return "Long";
    if (normalized === "short" || normalized === "sell") return "Short";
    return direction;
  };

  const uniqueSymbols = [...new Set(tradesFromActiveAccounts.map(t => t.symbol).filter(Boolean))];
  const uniqueDirections = [...new Set(tradesFromActiveAccounts.map(t => normalizeDirection(t.direction)).filter(Boolean))];
  const uniqueOutcomes = [...new Set([
    ...["Win", "Loss", "Breakeven"],
    ...tradesFromActiveAccounts.map(t => t.outcome).filter(Boolean),
  ])];
  const uniqueTimeframes = [...new Set(tradesFromActiveAccounts.map(t => t.timeframe).filter(Boolean))];

  const getMultiFilterLabel = (values, allLabel, resolver) => {
    if (values.includes("all")) return allLabel;
    return values
      .map((value) => resolver(value))
      .filter(Boolean)
      .join(", ");
  };

  const selectedAccountsLabel = getMultiFilterLabel(
    selectedAccounts,
    t('allAccounts'),
    (value) => activeAccounts.find((account) => String(account.id) === String(value))?.name
  );
  const selectedSymbolsLabel = getMultiFilterLabel(filterSymbols, t('all'), (value) => value);
  const selectedStrategiesLabel = getMultiFilterLabel(
    filterStrategies,
    t('all'),
    (value) => strategies.find((strategy) => String(strategy.id) === String(value))?.name
  );
  const selectedDirectionsLabel = getMultiFilterLabel(filterDirections, t('all'), (value) => value);
  const selectedOutcomesLabel = getMultiFilterLabel(filterOutcomes, t('all'), (value) => tradeOutcomeDisplay(value));
  const selectedTimeframesLabel = getMultiFilterLabel(filterTimeframes, t('all'), (value) => value);

  const dateRange = datePreset === "custom" ? customRange : dateRangeForPreset(datePreset);

  // Filter trades by selected filters
  const filteredTrades = tradesFromActiveAccounts.filter(t => (
    isClosedTrade(t) &&
    tradeInDateRange(t, dateRange) &&
    (selectedAccounts.includes("all") || selectedAccounts.includes(String(t.account_id))) &&
    (filterSymbols.includes("all") || filterSymbols.includes(String(t.symbol))) &&
    (filterStrategies.includes("all") || filterStrategies.includes(String(t.strategy_id))) &&
    (filterDirections.includes("all") || filterDirections.includes(String(normalizeDirection(t.direction)))) &&
    (filterOutcomes.includes("all") || filterOutcomes.includes(String(t.outcome))) &&
    (filterTimeframes.includes("all") || filterTimeframes.includes(String(t.timeframe)))
  ));

  // Symbol analysis
  const symbolStats = {};
  filteredTrades.forEach(trade => {
    if (!trade.symbol) return;
    if (!symbolStats[trade.symbol]) {
      symbolStats[trade.symbol] = { wins: 0, losses: 0, total: 0, pl: 0 };
    }
    symbolStats[trade.symbol].total++;
    if (trade.outcome === "Win") symbolStats[trade.symbol].wins++;
    if (trade.outcome === "Loss") symbolStats[trade.symbol].losses++;
    symbolStats[trade.symbol].pl += (getTradeRealizedPL(trade) ?? 0);
  });

  const symbolData = Object.entries(symbolStats)
    .map(([symbol, stats]) => ({
      symbol,
      winRate: decidedWinRate(stats.wins, stats.losses),
      avgPL: stats.total > 0 ? Number((stats.pl / stats.total).toFixed(2)) : 0,
      totalPL: Number(stats.pl.toFixed(2)),
      trades: stats.total
    }))
    .sort((a, b) => b.totalPL - a.totalPL)
    .slice(0, 10);

  // Strategy analysis
  const strategyStats = {};
  filteredTrades.forEach(trade => {
    const strategy = strategies.find(s => String(s.id) === String(trade.strategy_id));
    const strategyName = strategy?.name || "Bez strategii";
    
    if (!strategyStats[strategyName]) {
      strategyStats[strategyName] = { wins: 0, losses: 0, total: 0, pl: 0 };
    }
    strategyStats[strategyName].total++;
    if (trade.outcome === "Win") strategyStats[strategyName].wins++;
    if (trade.outcome === "Loss") strategyStats[strategyName].losses++;
    strategyStats[strategyName].pl += (getTradeRealizedPL(trade) ?? 0);
  });

  const strategyData = Object.entries(strategyStats).map(([name, stats]) => ({
    name,
    winRate: decidedWinRate(stats.wins, stats.losses),
    avgPL: stats.total > 0 ? Number((stats.pl / stats.total).toFixed(2)) : 0,
    totalPL: Number(stats.pl.toFixed(2)),
    trades: stats.total
  }));

  // Timeframe analysis
  const timeframeStats = {};
  filteredTrades.forEach(trade => {
    if (trade.timeframe) {
      if (!timeframeStats[trade.timeframe]) {
        timeframeStats[trade.timeframe] = { wins: 0, losses: 0, total: 0, pl: 0 };
      }
      timeframeStats[trade.timeframe].total++;
      if (trade.outcome === "Win") timeframeStats[trade.timeframe].wins++;
      if (trade.outcome === "Loss") timeframeStats[trade.timeframe].losses++;
      timeframeStats[trade.timeframe].pl += (getTradeRealizedPL(trade) ?? 0);
    }
  });

  const timeframeData = Object.entries(timeframeStats).map(([tf, stats]) => ({
    timeframe: tf,
    winRate: decidedWinRate(stats.wins, stats.losses),
    avgPL: stats.total > 0 ? Number((stats.pl / stats.total).toFixed(2)) : 0,
    trades: stats.total
  }));

  // Direction analysis
  const directionStats = { Long: { wins: 0, losses: 0, total: 0, pl: 0 }, Short: { wins: 0, losses: 0, total: 0, pl: 0 } };
  filteredTrades.forEach(trade => {
    const direction = normalizeDirection(trade.direction);
    if (directionStats[direction]) {
      directionStats[direction].total++;
      if (trade.outcome === "Win") directionStats[direction].wins++;
      if (trade.outcome === "Loss") directionStats[direction].losses++;
      directionStats[direction].pl += (getTradeRealizedPL(trade) ?? 0);
    }
  });

  const directionData = Object.entries(directionStats).map(([dir, stats]) => ({
    direction: dir,
    winRate: decidedWinRate(stats.wins, stats.losses),
    avgPL: stats.total > 0 ? Number((stats.pl / stats.total).toFixed(2)) : 0,
    totalPL: Number(stats.pl.toFixed(2)),
    trades: stats.total
  }));

  // Session analysis
  const sessionStats = {};
  filteredTrades.forEach(trade => {
    if (trade.session) {
      if (!sessionStats[trade.session]) {
        sessionStats[trade.session] = { wins: 0, losses: 0, total: 0, pl: 0 };
      }
      sessionStats[trade.session].total++;
      if (trade.outcome === "Win") sessionStats[trade.session].wins++;
      if (trade.outcome === "Loss") sessionStats[trade.session].losses++;
      sessionStats[trade.session].pl += (getTradeRealizedPL(trade) ?? 0);
    }
  });

  const sessionData = Object.entries(sessionStats).map(([session, stats]) => ({
    session,
    winRate: decidedWinRate(stats.wins, stats.losses),
    avgPL: stats.total > 0 ? Number((stats.pl / stats.total).toFixed(2)) : 0,
    trades: stats.total
  }));

  // Setup quality analysis
  const setupStats = {};
  filteredTrades.forEach(trade => {
    if (trade.setup_quality) {
      if (!setupStats[trade.setup_quality]) {
        setupStats[trade.setup_quality] = { wins: 0, losses: 0, total: 0, pl: 0 };
      }
      setupStats[trade.setup_quality].total++;
      if (trade.outcome === "Win") setupStats[trade.setup_quality].wins++;
      if (trade.outcome === "Loss") setupStats[trade.setup_quality].losses++;
      setupStats[trade.setup_quality].pl += (getTradeRealizedPL(trade) ?? 0);
    }
  });

  const setupData = Object.entries(setupStats).map(([quality, stats]) => ({
    quality,
    winRate: decidedWinRate(stats.wins, stats.losses),
    avgPL: stats.total > 0 ? Number((stats.pl / stats.total).toFixed(2)) : 0,
    trades: stats.total
  })).sort((a, b) => a.quality.localeCompare(b.quality));

  // Emotional state analysis
  const emotionalStats = {};
  filteredTrades.forEach(trade => {
    if (trade.emotional_state) {
      if (!emotionalStats[trade.emotional_state]) {
        emotionalStats[trade.emotional_state] = { wins: 0, losses: 0, total: 0, pl: 0 };
      }
      emotionalStats[trade.emotional_state].total++;
      if (trade.outcome === "Win") emotionalStats[trade.emotional_state].wins++;
      if (trade.outcome === "Loss") emotionalStats[trade.emotional_state].losses++;
      emotionalStats[trade.emotional_state].pl += (getTradeRealizedPL(trade) ?? 0);
    }
  });

  const emotionalData = Object.entries(emotionalStats).map(([state, stats]) => ({
    state,
    winRate: decidedWinRate(stats.wins, stats.losses),
    avgPL: stats.total > 0 ? Number((stats.pl / stats.total).toFixed(2)) : 0,
    trades: stats.total
  }));

  // === Dziennik emocji (przed / w trakcie / po) z formularza trejdu ===
  const emoStages = [
    { key: 'before', label: t('emoStageBefore') },
    { key: 'during', label: t('emoStageDuring') },
    { key: 'after', label: t('emoStageAfter') },
  ];

  const tradesWithEmotions = filteredTrades.filter((tr) => countFilledEmotionStages(tr.emotions) > 0);

  // Emocja (tag) -> skuteczność. Liczona raz na trejd, nawet jeśli tag powtarza się w etapach.
  const emoTagMap = {};
  let ratingSum = 0;
  let ratingCount = 0;
  tradesWithEmotions.forEach((tr) => {
    const em = normalizeEmotions(tr.emotions);
    const pl = getTradeRealizedPL(tr) ?? 0;
    const isWin = tr.outcome === 'Win';
    const seen = new Set();
    emoStages.forEach((s) => {
      const st = em[s.key];
      if (st.rating > 0) { ratingSum += st.rating; ratingCount++; }
      st.tags.forEach((tag) => {
        if (seen.has(tag)) return;
        seen.add(tag);
        if (!emoTagMap[tag]) emoTagMap[tag] = { tag, wins: 0, losses: 0, total: 0, pl: 0 };
        emoTagMap[tag].total++;
        if (isWin) emoTagMap[tag].wins++;
        else if (tr.outcome === 'Loss') emoTagMap[tag].losses++;
        emoTagMap[tag].pl += pl;
      });
    });
  });

  const emotionPerf = Object.values(emoTagMap)
    .map((x) => ({
      tag: x.tag,
      winRate: decidedWinRate(x.wins, x.losses),
      avgPL: x.total > 0 ? Number((x.pl / x.total).toFixed(2)) : 0,
      totalPL: Number(x.pl.toFixed(2)),
      trades: x.total,
    }))
    .sort((a, b) => a.avgPL - b.avgPL); // od najgorszej do najlepszej

  const avgEmotionRating = ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(1)) : 0;

  // Średnia ocena emocji wg etapu: wygrane vs przegrane
  const stageRatingByOutcome = emoStages.map((s) => {
    let winSum = 0, winN = 0, lossSum = 0, lossN = 0, beSum = 0, beN = 0;
    tradesWithEmotions.forEach((tr) => {
      const st = normalizeEmotions(tr.emotions)[s.key];
      if (st.rating > 0) {
        if (tr.outcome === 'Win') { winSum += st.rating; winN++; }
        else if (tr.outcome === 'Loss') { lossSum += st.rating; lossN++; }
        else if (tr.outcome === 'Breakeven') { beSum += st.rating; beN++; }
      }
    });
    return {
      stage: s.label,
      win: winN > 0 ? Number((winSum / winN).toFixed(2)) : 0,
      loss: lossN > 0 ? Number((lossSum / lossN).toFixed(2)) : 0,
      breakeven: beN > 0 ? Number((beSum / beN).toFixed(2)) : 0,
    };
  });

  // Tiltometr w czasie — średnia ocena emocji per trejd, chronologicznie
  const tiltOverTime = sortTradesChronoAsc(tradesWithEmotions).map((tr, i) => {
    const em = normalizeEmotions(tr.emotions);
    const vals = emoStages.map((s) => em[s.key].rating).filter((r) => r > 0);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { idx: i + 1, rating: Number(avg.toFixed(2)), date: tr.date };
  });

  // Najczęstsze emocje wg etapu (top 5 każdy)
  const topTagsByStage = emoStages.map((s) => {
    const m = {};
    tradesWithEmotions.forEach((tr) => {
      const st = normalizeEmotions(tr.emotions)[s.key];
      st.tags.forEach((tag) => {
        if (!m[tag]) m[tag] = { tag, wins: 0, losses: 0, total: 0 };
        m[tag].total++;
        if (tr.outcome === 'Win') m[tag].wins++;
        else if (tr.outcome === 'Loss') m[tag].losses++;
      });
    });
    const items = Object.values(m)
      .map((x) => ({ ...x, winRate: Math.round(decidedWinRate(x.wins, x.losses)) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    return { stage: s.label, items };
  });

  const worstEmotion = emotionPerf.length ? emotionPerf[0] : null;
  const bestEmotion = emotionPerf.length ? emotionPerf[emotionPerf.length - 1] : null;
  const emotionCoverage = filteredTrades.length > 0
    ? Math.round((tradesWithEmotions.length / filteredTrades.length) * 100)
    : 0;

  // Warunki wejścia + błędy — z zaznaczonych chipów na trejdach
  const confluenceAgg = aggregateTagPerformance(filteredTrades, "confluences", {
    decidedWinRate,
    getPl: (tr) => getTradeRealizedPL(tr) ?? 0,
  });
  const mistakeAgg = aggregateTagPerformance(filteredTrades, "mistakes", {
    decidedWinRate,
    getPl: (tr) => getTradeRealizedPL(tr) ?? 0,
  });
  const confluencePerf = [...confluenceAgg.rows].sort((a, b) => a.avgPL - b.avgPL);
  const mistakePerf = [...mistakeAgg.rows].sort((a, b) => a.avgPL - b.avgPL);
  const confluenceByFreq = confluenceAgg.rows;
  const mistakeByFreq = mistakeAgg.rows;
  const bestConfluence = confluencePerf.length ? confluencePerf[confluencePerf.length - 1] : null;
  const worstConfluence = confluencePerf.length ? confluencePerf[0] : null;
  const bestMistakeAvoid = mistakePerf.length ? mistakePerf[mistakePerf.length - 1] : null;
  const costliestMistake = mistakePerf.length ? mistakePerf[0] : null;
  const confluenceCoverage = filteredTrades.length > 0
    ? Math.round((confluenceAgg.taggedTrades / filteredTrades.length) * 100)
    : 0;
  const mistakeCoverage = filteredTrades.length > 0
    ? Math.round((mistakeAgg.taggedTrades / filteredTrades.length) * 100)
    : 0;

  // === Poziom pewności setupu (1–5⭐) z formularza trejdu ===
  const confidenceMap = {};
  let confSum = 0;
  let confCount = 0;
  filteredTrades.forEach((tr) => {
    const level = Number(tr.setup_confidence) || 0;
    if (level < 1 || level > 5) return;
    confSum += level;
    confCount++;
    if (!confidenceMap[level]) confidenceMap[level] = { level, wins: 0, losses: 0, total: 0, pl: 0 };
    confidenceMap[level].total++;
    if (tr.outcome === 'Win') confidenceMap[level].wins++;
    if (tr.outcome === 'Loss') confidenceMap[level].losses++;
    confidenceMap[level].pl += getTradeRealizedPL(tr) ?? 0;
  });

  const confidenceData = [1, 2, 3, 4, 5].map((level) => {
    const s = confidenceMap[level];
    return {
      level: `${level}⭐`,
      winRate: s ? decidedWinRate(s.wins, s.losses) : 0,
      avgPL: s && s.total > 0 ? Number((s.pl / s.total).toFixed(2)) : 0,
      trades: s ? s.total : 0,
    };
  });

  const hasConfidenceData = confCount > 0;
  const avgConfidence = confCount > 0 ? Number((confSum / confCount).toFixed(1)) : 0;

  // === Analiza czasu wejścia (przedziały 15-minutowe + godzinowe) ===
  const parseEntryMinutes = (tr) => getTradeEntryMinutes(tr);

  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtSlot = (slotStart) => {
    const end = slotStart + 15;
    return `${pad2(Math.floor(slotStart / 60))}:${pad2(slotStart % 60)}–${pad2(Math.floor(end / 60) % 24)}:${pad2(end % 60)}`;
  };

  const timeSlotMap = {};
  const hourMap = {};
  filteredTrades.forEach((tr) => {
    const mins = parseEntryMinutes(tr);
    if (mins == null) return;
    const pl = getTradeRealizedPL(tr) ?? 0;

    const slot = Math.floor(mins / 15) * 15;
    if (!timeSlotMap[slot]) timeSlotMap[slot] = { slot, wins: 0, losses: 0, total: 0, pl: 0 };
    timeSlotMap[slot].total++;
    if (tr.outcome === 'Win') timeSlotMap[slot].wins++;
    if (tr.outcome === 'Loss') timeSlotMap[slot].losses++;
    timeSlotMap[slot].pl += pl;

    const hour = Math.floor(mins / 60);
    if (!hourMap[hour]) hourMap[hour] = { hour, wins: 0, losses: 0, total: 0, pl: 0 };
    hourMap[hour].total++;
    if (tr.outcome === 'Win') hourMap[hour].wins++;
    if (tr.outcome === 'Loss') hourMap[hour].losses++;
    hourMap[hour].pl += pl;
  });

  const timeSlotData = Object.values(timeSlotMap)
    .sort((a, b) => a.slot - b.slot)
    .map((s) => ({
      slot: fmtSlot(s.slot),
      slotStart: s.slot,
      winRate: decidedWinRate(s.wins, s.losses),
      avgPL: s.total > 0 ? Number((s.pl / s.total).toFixed(2)) : 0,
      totalPL: Number(s.pl.toFixed(2)),
      trades: s.total,
    }));

  const hourData = Object.values(hourMap)
    .sort((a, b) => a.hour - b.hour)
    .map((s) => ({
      hour: `${pad2(s.hour)}:00`,
      winRate: decidedWinRate(s.wins, s.losses),
      avgPL: s.total > 0 ? Number((s.pl / s.total).toFixed(2)) : 0,
      totalPL: Number(s.pl.toFixed(2)),
      trades: s.total,
    }));

  const tradesWithTime = timeSlotData.reduce((sum, s) => sum + s.trades, 0);
  const rankedSlots = timeSlotData.filter((s) => s.trades >= 2);
  const bestSlot = rankedSlots.length ? rankedSlots.reduce((a, b) => (b.avgPL > a.avgPL ? b : a)) : null;
  const worstSlot = rankedSlots.length ? rankedSlots.reduce((a, b) => (b.avgPL < a.avgPL ? b : a)) : null;
  const rankedHours = hourData.filter((h) => h.trades >= 2);
  const bestHour = rankedHours.length ? rankedHours.reduce((a, b) => (b.winRate > a.winRate ? b : a)) : null;

  // KPI, krzywa kapitału i obsunięcie — chronologicznie po dacie i godzinie wejścia
  const statsBalance = balanceForTrades(filteredTrades, accounts);
  const kpis = computeAnalyticsKpis(filteredTrades, { startBalance: statsBalance });
  const equitySeries = buildEquitySeries(sortTradesChronoAsc(filteredTrades), statsBalance);
  // Oś „Daty”: ostatni stan kapitału z każdego dnia, żeby etykiety osi się nie powtarzały.
  const equityByDate = Object.values(
    equitySeries.points.slice(1).reduce((acc, point) => {
      acc[point.date] = point;
      return acc;
    }, {})
  );
  const equityCurve = equityAxis === "dates" ? equityByDate : equitySeries.points;
  const weekdayData = weekdayStats(filteredTrades).map((row) => ({
    ...row,
    label: t('anWeekdays').split(',')[row.day] || String(row.day + 1),
  }));
  const heatmap = hourWeekdayHeatmap(filteredTrades, parseEntryMinutes);

  // Period performance (daily, weekly, monthly, yearly)
  const periodStats = {};
  filteredTrades.forEach(trade => {
    if (!trade?.date) return;
    const dateKey = String(trade.date).slice(0, 10);
    let period;
    if (timePeriod === "daily") {
      period = dateKey;
    } else if (timePeriod === "weekly") {
      period = weekStartKeyLocal(dateKey);
    } else if (timePeriod === "monthly") {
      period = dateKey.substring(0, 7);
    } else if (timePeriod === "yearly") {
      period = dateKey.substring(0, 4);
    }
    if (!period) return;

    if (!periodStats[period]) {
      periodStats[period] = { wins: 0, losses: 0, total: 0, pl: 0 };
    }
    periodStats[period].total++;
    if (trade.outcome === "Win") periodStats[period].wins++;
    if (trade.outcome === "Loss") periodStats[period].losses++;
    periodStats[period].pl += (getTradeRealizedPL(trade) ?? 0);
  });

  const periodData = Object.entries(periodStats)
    .map(([period, stats]) => ({
      period,
      pl: Math.round(stats.pl * 100) / 100,
      trades: stats.total,
      winRate: decidedWinRate(stats.wins, stats.losses)
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const bestPeriod = periodData.length
    ? periodData.reduce((best, current) => (current.pl > best.pl ? current : best), periodData[0])
    : null;
  const bestWinRatePeriod = periodData.length
    ? periodData.reduce((best, current) => (current.winRate > best.winRate ? current : best), periodData[0])
    : null;

  // Account comparison — respect page filters
  const accountData = activeAccounts.map(account => {
    const accountTrades = filteredTrades.filter(t => String(t.account_id) === String(account.id));
    const wins = accountTrades.filter(t => t.outcome === "Win").length;
    const losses = accountTrades.filter(t => t.outcome === "Loss").length;
    const totalPL = accountTrades.reduce((sum, t) => sum + ((getTradeRealizedPL(t) ?? 0)), 0);

    return {
      name: account.name,
      trades: accountTrades.length,
      wins,
      winRate: decidedWinRate(wins, losses),
      totalPL: Number(totalPL.toFixed(2)),
      avgPL: accountTrades.length > 0 ? Number((totalPL / accountTrades.length).toFixed(2)) : 0,
      roi: account.initial_balance > 0 ? Number(((totalPL / parseFloat(account.initial_balance)) * 100).toFixed(2)) : 0
    };
  }).filter(a => a.trades > 0);

  if (isLoading) {
    return (
      <div className="w-full mx-auto space-y-3 dashboard-surface py-2">
        <SkeletonKpiRow count={4} />
        <SkeletonBlock rows={8} className="rounded-lg border border-ds-line" />
      </div>
    );
  }

  const COLORS = [CHART.line, CHART.profit, CHART.accent, CHART.warning, CHART.loss, CHART.muted, CHART.line, CHART.profit];

  const outcomeCounts = {
    wins: filteredTrades.filter(t => t.outcome === 'Win').length,
    losses: filteredTrades.filter(t => t.outcome === 'Loss').length,
    breakeven: filteredTrades.filter(t => t.outcome === 'Breakeven').length
  };
  const outcomeDecided = outcomeCounts.wins + outcomeCounts.losses;
  const outcomeWinRate = outcomeDecided > 0 ? (outcomeCounts.wins / outcomeDecided) * 100 : 0;
  const fmtMoney = (value) => pnl.formatAmount(value, statsBalance);
  const kpiTiles = [
    {
      key: 'net',
      label: t('anNetResult'),
      value: fmtMoney(kpis.netPL),
      hint: `${kpis.trades} ${t('trades')}`,
      tone: kpis.netPL > 0 ? 'profit' : kpis.netPL < 0 ? 'loss' : 'default',
    },
    {
      key: 'winRate',
      label: t('winRate'),
      value: `${kpis.winRate}%`,
      hint: `${t('wins')} ${kpis.wins} · BE ${kpis.breakeven} · ${t('losses')} ${kpis.losses}`,
      title: t('anWinRateTitle'),
    },
    {
      key: 'pf',
      label: t('profitFactor'),
      value: kpis.profitFactor == null ? '∞' : kpis.profitFactor.toFixed(2),
      hint: `${fmtMoney(kpis.grossProfit)} / ${fmtMoney(-kpis.grossLoss)}`,
      tone: kpis.profitFactor == null || kpis.profitFactor >= 1 ? (kpis.trades ? 'profit' : 'default') : 'loss',
    },
    { key: 'avgWin', label: t('avgWin'), value: fmtMoney(kpis.avgWin), hint: t('anPerWinningTrade'), tone: kpis.avgWin > 0 ? 'profit' : 'default' },
    { key: 'avgLoss', label: t('avgLoss'), value: fmtMoney(kpis.avgLoss), hint: t('anPerLosingTrade'), tone: kpis.avgLoss < 0 ? 'loss' : 'default' },
    { key: 'payoff', label: t('anPayoff'), value: kpis.payoff == null ? '—' : kpis.payoff.toFixed(2), hint: t('anPayoffHint') },
    {
      key: 'expectancy',
      label: t('expectancy'),
      value: fmtMoney(kpis.expectancy),
      hint: t('anPerTrade'),
      tone: kpis.expectancy > 0 ? 'profit' : kpis.expectancy < 0 ? 'loss' : 'default',
    },
    {
      key: 'dd',
      label: t('maxDrawdown'),
      value: fmtMoney(kpis.maxDrawdown),
      hint: kpis.maxDrawdownPct == null ? t('anFromPeak') : `${kpis.maxDrawdownPct.toFixed(2)}% ${t('anFromPeak')}`,
      tone: kpis.maxDrawdown < 0 ? 'loss' : 'default',
    },
    {
      key: 'streaks',
      label: t('streaks'),
      value: `${kpis.maxWinStreak} / ${kpis.maxLossStreak}`,
      hint: t('anStreakHint'),
    },
  ];

  const dateRangeLabel = datePreset === "custom"
    ? customRange.from
      ? customRange.to && customRange.to !== customRange.from
        ? `${fmtDay(customRange.from)} – ${fmtDay(customRange.to)}`
        : fmtDay(customRange.from)
      : t('anRangeCustom')
    : t(DATE_PRESET_LABEL_KEYS[datePreset]);

  const directionEdgeData = directionData.map((entry) => ({
    direction: entry.direction,
    netPL: Number(entry.totalPL),
    winRate: Number(entry.winRate),
    trades: entry.trades
  }));

  const directionTop = directionEdgeData.length
    ? directionEdgeData.reduce((best, current) => (current.netPL > best.netPL ? current : best), directionEdgeData[0])
    : null;

  return (
    <div className="analytics-page w-full min-h-0 space-y-3 dashboard-surface">
      <div className="max-w-none mx-0 space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="cyber-page-title">{t('advancedAnalytics')}</h1>
            <p className="cyber-page-sub">{t('detailedAnalysisOfAllAspects')}</p>
          </div>
          
          <div className="flex gap-3 items-center">
            <QuoteLine className="hidden lg:flex shrink-0" />
            <ImportButton 
              onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ['trades'] })}
              accounts={accounts} 
              strategies={strategies} 
            />
            <ExportButton 
              trades={filteredTrades} 
              accounts={accounts} 
              strategies={strategies} 
              type="analytics"
              analytics={{
                totalPL: filteredTrades.reduce((sum, t) => sum + ((getTradeRealizedPL(t) ?? 0)), 0),
                winRate: outcomeWinRate,
                profitFactor: (() => {
                  const wins = filteredTrades.filter(t => (getTradeRealizedPL(t) ?? 0) > 0).reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0);
                  const losses = Math.abs(filteredTrades.filter(t => (getTradeRealizedPL(t) ?? 0) < 0).reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0));
                  return losses > 0 ? wins / losses : wins > 0 ? 999 : 0;
                })(),
                avgWin: (() => {
                  const winTrades = filteredTrades.filter(t => (getTradeRealizedPL(t) ?? 0) > 0);
                  return winTrades.length > 0 ? winTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0) / winTrades.length : 0;
                })(),
                avgLoss: (() => {
                  const lossTrades = filteredTrades.filter(t => (getTradeRealizedPL(t) ?? 0) < 0);
                  return lossTrades.length > 0 ? lossTrades.reduce((sum, t) => sum + (getTradeRealizedPL(t) ?? 0), 0) / lossTrades.length : 0;
                })()
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 items-end">
          <div className="flex flex-col gap-1">
            <span className={FILTER_LABEL_CLASS}>{t('anPeriod')}</span>
            <div className="relative" ref={datePickerRef}>
              <button
                type="button"
                aria-expanded={datePickerOpen}
                data-open={datePickerOpen ? "true" : undefined}
                onClick={() => setDatePickerOpen(!datePickerOpen)}
                className={FILTER_TRIGGER_CLASS}
              >
                <CalendarRange className="absolute left-3 w-4 h-4 opacity-50" />
                <span className="truncate text-center w-full px-5">{dateRangeLabel}</span>
                <ChevronDown className="absolute right-3 w-4 h-4 opacity-50" />
              </button>
              {datePickerOpen && (
                <div className={`${FILTER_PANEL_CLASS} w-[300px] max-w-[calc(100vw-32px)] p-2`}>
                  <div className="grid grid-cols-2 gap-1">
                    {DATE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          setDatePreset(preset);
                          if (preset !== "custom") setDatePickerOpen(false);
                        }}
                        className={filterItemClass(datePreset === preset)}
                      >
                        {t(DATE_PRESET_LABEL_KEYS[preset])}
                      </button>
                    ))}
                  </div>
                  {datePreset === "custom" && (
                    <div className="mt-2 border-t border-ds-line pt-3 px-1">
                      <DateRangeCalendar
                        from={customRange.from}
                        to={customRange.to}
                        onSelect={(from, to) => setCustomRange({ from, to })}
                      />
                      <div className="mt-3 flex justify-end gap-2">
                        <button type="button" onClick={() => setCustomRange({ from: "", to: "" })} className="journal-cal-action">
                          {t('anClear')}
                        </button>
                        <button type="button" onClick={() => setDatePickerOpen(false)} className="journal-cal-action journal-cal-action-primary">
                          {t('anClose')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <MultiSelectFilter
            label={t('account')}
            allLabel={t('allAccounts')}
            valueLabel={selectedAccountsLabel}
            options={activeAccounts.map((acc) => ({ value: String(acc.id), label: acc.name }))}
            values={selectedAccounts}
            onChange={setSelectedAccounts}
          />
          <MultiSelectFilter
            label={t('symbol')}
            allLabel={t('all')}
            valueLabel={selectedSymbolsLabel}
            options={uniqueSymbols.map((sym) => ({ value: sym, label: sym }))}
            values={filterSymbols}
            onChange={setFilterSymbols}
          />
          <MultiSelectFilter
            label={t('strategy')}
            allLabel={t('all')}
            valueLabel={selectedStrategiesLabel}
            options={strategies.map((strategy) => ({ value: String(strategy.id), label: strategy.name }))}
            values={filterStrategies}
            onChange={setFilterStrategies}
          />
          <MultiSelectFilter
            label={t('direction')}
            allLabel={t('all')}
            valueLabel={selectedDirectionsLabel}
            options={uniqueDirections.map((dir) => ({ value: dir, label: dir }))}
            values={filterDirections}
            onChange={setFilterDirections}
          />
          <MultiSelectFilter
            label={t('outcome')}
            allLabel={t('all')}
            valueLabel={selectedOutcomesLabel}
            options={uniqueOutcomes.map((out) => ({ value: out, label: tradeOutcomeDisplay(out) }))}
            values={filterOutcomes}
            onChange={setFilterOutcomes}
          />
          <MultiSelectFilter
            label={t('timeframe')}
            allLabel={t('all')}
            valueLabel={selectedTimeframesLabel}
            options={uniqueTimeframes.map((tf) => ({ value: tf, label: tf }))}
            values={filterTimeframes}
            onChange={setFilterTimeframes}
          />

          <div className="flex flex-col gap-1">
            <span className={`${FILTER_LABEL_CLASS} opacity-0`} aria-hidden="true">{t('reset')}</span>
            <button
              type="button"
              className="flex h-9 w-full items-center justify-center rounded-[10px] border border-[color:var(--ds-neg-tint)] bg-ds-neg-tint text-[13px] font-medium text-ds-neg transition-colors duration-200 hover:border-[color:var(--ds-neg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ds-focus)]"
              onClick={() => {
                setFilterSymbols(["all"]);
                setFilterStrategies(["all"]);
                setFilterDirections(["all"]);
                setFilterOutcomes(["all"]);
                setFilterTimeframes(["all"]);
                setSelectedAccounts(["all"]);
                setDatePreset("all");
                setCustomRange({ from: "", to: "" });
                setSelectedSymbol(null);
                setSelectedStrategy(null);
              }}
            >
              {t('reset')}
            </button>
          </div>
        </div>

        {/* Osobne szklane kafelki jak we wzorcu docs/design-reference/wzorzec-3; 5+4 na laptopie, 9 w rzędzie na szerokim ekranie. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 min-[1700px]:grid-cols-9">
          {kpiTiles.map((tile) => (
            <div
              key={tile.key}
              className="min-w-0 rounded-[16px] border border-ds-line bg-ds-s2 px-4 py-3.5"
              title={tile.title || `${tile.label}: ${tile.value} — ${tile.hint}`}
            >
              <p className="type-section mb-2 break-words">{tile.label}</p>
              <p className={`type-metric-sm font-semibold break-words ${tile.tone === 'profit' ? 'text-ds-pos' : tile.tone === 'loss' ? 'text-ds-neg' : 'text-ds-text'}`}>
                <CountUpText text={tile.value} />
              </p>
              <p className="type-secondary mt-1.5 line-clamp-2">{tile.hint}</p>
            </div>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value); setTabSwitched(true); }} className="space-y-6">
          <TabsList indicator className="flex w-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="overview" className="shrink-0">{t('overview')}</TabsTrigger>
            <TabsTrigger value="symbols" className="shrink-0">{t('symbols')}</TabsTrigger>
            <TabsTrigger value="strategies" className="shrink-0">{t('strategiesAnalytics')}</TabsTrigger>
            <TabsTrigger value="accounts" className="shrink-0">{t('accountsAnalytics')}</TabsTrigger>
            <TabsTrigger value="time" className="shrink-0">{t('timeTab')}</TabsTrigger>
            <TabsTrigger value="psychology" className="shrink-0">{t('psychology')}</TabsTrigger>
            <TabsTrigger value="confluences" className="shrink-0">{t('entryConditionsTab')}</TabsTrigger>
            <TabsTrigger value="mistakes" className="shrink-0">{t('mistakesTab')}</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="motion-tab-in space-y-6" data-reveal-skip={tabSwitched ? "true" : undefined}>
            {/* Equity / Drawdown + weekday */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <Card className="overflow-hidden xl:col-span-2">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    {equityView === "drawdown" ? t('drawdown') : t('equityCurve')}
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <SegToggle
                      value={equityView}
                      onChange={setEquityView}
                      options={[{ value: "equity", label: t('anEquity') }, { value: "drawdown", label: t('drawdown') }]}
                    />
                    <SegToggle
                      value={equityAxis}
                      onChange={setEquityAxis}
                      options={[{ value: "trades", label: t('anAxisTrades') }, { value: "dates", label: t('anAxisDates') }]}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={equityCurve} margin={CHART_MARGIN}>
                      <defs>
                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART.line} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={CHART.line} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorDrawdown" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="5%" stopColor={CHART.loss} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={CHART.loss} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis
                        dataKey={equityAxis === "dates" ? "date" : "trade"}
                        stroke={CHART.axis}
                        tickFormatter={equityAxis === "dates" ? fmtShortDay : undefined}
                        minTickGap={24}
                      />
                      <YAxis stroke={CHART.axis} width={70} domain={paddedDomain} />
                      <Tooltip
                        {...tooltipProps}
                        labelFormatter={(label, payload) => {
                          const point = payload?.[0]?.payload;
                          if (!point) return label;
                          if (!point.date) return t('anStart');
                          return equityAxis === "dates"
                            ? fmtDay(point.date)
                            : `${t('anTradeNo')} ${point.trade} · ${fmtDay(point.date)}`;
                        }}
                        formatter={(value) => [fmtMoney(value), equityView === "drawdown" ? t('drawdown') : t('anEquity')]}
                      />
                      <Area {...chartSeriesProps}
                        type="monotone"
                        dataKey={equityView === "drawdown" ? "drawdown" : "equity"}
                        stroke={equityView === "drawdown" ? CHART.loss : CHART.line}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill={equityView === "drawdown" ? "url(#colorDrawdown)" : "url(#colorEquity)"}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>{t('anByWeekday')}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={weekdayData} margin={CHART_MARGIN}>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis dataKey="label" stroke={CHART.axis} interval={0} />
                      <YAxis stroke={CHART.axis} width={60} domain={paddedDomain} />
                      <Tooltip
                        {...tooltipProps}
                        labelFormatter={(label, payload) => {
                          const row = payload?.[0]?.payload;
                          return row ? `${label} · ${row.trades} ${t('trades')} · ${t('winRate')} ${row.winRate}%` : label;
                        }}
                        formatter={(value) => [fmtMoney(value), t('netPL')]}
                      />
                      <Bar {...chartSeriesProps} dataKey="pl" radius={chartBarRadius} maxBarSize={40}>
                        {weekdayData.map((entry) => (
                          <Cell key={entry.day} fill={entry.pl >= 0 ? CHART.profit : CHART.loss} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Period Performance */}
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <CardTitle>
                    {t('results')} {timePeriod === "daily" ? (t('daily') || 'Daily') : timePeriod === "weekly" ? t('weekly') : timePeriod === "monthly" ? t('monthly') : t('yearly')}
                  </CardTitle>
                  <Select value={timePeriod} onValueChange={setTimePeriod}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{t('daily') || 'Daily'}</SelectItem>
                      <SelectItem value="weekly">{t('weekly')}</SelectItem>
                      <SelectItem value="monthly">{t('monthly')}</SelectItem>
                      <SelectItem value="yearly">{t('yearly')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="overflow-hidden p-4 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div className="rounded-lg border border-ds-line bg-ds-s2 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('bestPeriod')}</p>
                    <p className="text-sm font-semibold text-foreground">
                      {bestPeriod ? bestPeriod.period : '--'}
                    </p>
                    <p className={`text-xs ${bestPeriod && Number(bestPeriod.pl) >= 0 ? 'text-ds-pos' : 'text-ds-neg'}`}>
                      {bestPeriod ? `${bestPeriod.pl >= 0 ? '+' : ''}${bestPeriod.pl.toFixed(2)}` : '--'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-ds-line bg-ds-s2 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('maxWinRate')}</p>
                    <p className="text-sm font-semibold text-foreground">
                      {bestWinRatePeriod ? `${bestWinRatePeriod.winRate}%` : '--'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {bestWinRatePeriod ? bestWinRatePeriod.period : '--'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-ds-line bg-ds-s2 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('totalPeriods')}</p>
                    <p className="text-sm font-semibold text-foreground">{periodData.length}</p>
                    <p className="text-xs text-muted-foreground">{t('results')}</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={periodData} margin={{ ...CHART_MARGIN, bottom: timePeriod === "weekly" ? 24 : 8 }}>
                    <CartesianGrid {...chartGridProps} />
                    <XAxis dataKey="period" stroke={CHART.axis} angle={timePeriod === "weekly" ? -45 : 0} textAnchor={timePeriod === "weekly" ? "end" : "middle"} height={timePeriod === "weekly" ? 70 : 30} minTickGap={8} />
                    <YAxis stroke={CHART.axis} width={70} domain={paddedDomain} />
                    <Tooltip
                      {...tooltipProps}
                      labelFormatter={(label, payload) => {
                        const row = payload?.[0]?.payload;
                        return row ? `${label} · ${row.trades} ${t('trades')} · ${t('winRate')} ${row.winRate}%` : label;
                      }}
                      formatter={(value) => [fmtMoney(value), t('netPL')]}
                    />
                    <Bar {...chartSeriesProps} dataKey="pl" name={t('netPL')} radius={chartBarRadius}>
                      {periodData.map((entry) => (
                        <Cell key={entry.period} fill={entry.pl >= 0 ? CHART.profit : CHART.loss} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Long vs Short + Timeframe */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>{t('longVsShort')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    {directionData.map((entry) => (
                      <div key={entry.direction} className="rounded-lg border border-ds-line bg-ds-s2 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{entry.direction}</p>
                        <p className={`text-xl font-semibold ${entry.totalPL > 0 ? 'text-ds-pos' : entry.totalPL < 0 ? 'text-ds-neg' : 'text-foreground'}`}>
                          {fmtMoney(entry.totalPL)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('winRate')}: {entry.winRate}% · {entry.trades} {t('trades')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('avgPLLabel')}: {fmtMoney(entry.avgPL)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={directionEdgeData} layout="vertical" margin={CHART_MARGIN}>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis type="number" stroke={CHART.axis} domain={paddedDomain} />
                      <YAxis type="category" dataKey="direction" stroke={CHART.axis} width={60} />
                      <Tooltip {...tooltipProps} formatter={(value) => [fmtMoney(value), t('netPL')]} />
                      <Bar {...chartSeriesProps} dataKey="netPL" radius={[0, 6, 6, 0]} maxBarSize={48}>
                        {directionEdgeData.map((entry) => (
                          <Cell key={entry.direction} fill={entry.netPL >= 0 ? directionChartColor(entry.direction) : CHART.loss} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="rounded-lg border border-ds-line bg-ds-s2 px-3 py-2 text-xs text-muted-foreground">
                    {directionTop && directionTop.trades > 0
                      ? `${t('insightDirectionBest')} ${directionTop.direction} · ${directionTop.winRate}% ${t('winRate')}`
                      : t('insightDirectionEmpty')}
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>{t('timeframeAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={timeframeData} margin={CHART_MARGIN}>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis dataKey="timeframe" stroke={CHART.axis} />
                      <YAxis stroke={CHART.axis} width={50} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        {...tooltipProps}
                        labelFormatter={(label, payload) => {
                          const row = payload?.[0]?.payload;
                          return row ? `${label} · ${row.trades} ${t('trades')} · ${t('avgPLLabel')} ${fmtMoney(row.avgPL)}` : label;
                        }}
                        formatter={(value) => [`${value}%`, t('winRate')]}
                      />
                      <Bar {...chartSeriesProps} dataKey="winRate" fill={CHART.line} radius={chartBarRadius} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Session Analysis: win rate i średni P&L na osobnych wykresach */}
            {sessionData.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>{t('sessionsAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 pt-0">
                  <div>
                    <p className="type-section mb-2">{t('winRate')} (%)</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={sessionData} margin={CHART_MARGIN}>
                        <CartesianGrid {...chartGridProps} />
                        <XAxis dataKey="session" stroke={CHART.axis} interval={0} />
                        <YAxis stroke={CHART.axis} width={50} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          {...tooltipProps}
                          labelFormatter={(label, payload) => {
                            const row = payload?.[0]?.payload;
                            return row ? `${label} · ${row.trades} ${t('trades')}` : label;
                          }}
                          formatter={(value) => [`${value}%`, t('winRate')]}
                        />
                        <Bar {...chartSeriesProps} dataKey="winRate" fill={CHART.line} radius={chartBarRadius} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <p className="type-section mb-2">{t('avgPLLabel')}</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={sessionData} margin={CHART_MARGIN}>
                        <CartesianGrid {...chartGridProps} />
                        <XAxis dataKey="session" stroke={CHART.axis} interval={0} />
                        <YAxis stroke={CHART.axis} width={60} domain={paddedDomain} />
                        <Tooltip
                          {...tooltipProps}
                          labelFormatter={(label, payload) => {
                            const row = payload?.[0]?.payload;
                            return row ? `${label} · ${row.trades} ${t('trades')}` : label;
                          }}
                          formatter={(value) => [fmtMoney(value), t('avgPLLabel')]}
                        />
                        <Bar {...chartSeriesProps} dataKey="avgPL" radius={chartBarRadius} maxBarSize={48}>
                          {sessionData.map((entry) => (
                            <Cell key={entry.session} fill={entry.avgPL >= 0 ? CHART.profit : CHART.loss} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Symbols Tab */}
          <TabsContent value="symbols" className="motion-tab-in space-y-6" data-reveal-skip={tabSwitched ? "true" : undefined}>
            <Card>
              <CardHeader>
                <CardTitle>{t('top10Symbols')}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden p-4">
                <div className="w-full overflow-hidden px-4 py-2">
                  <ResponsiveContainer width="100%" height={450}>
                    <BarChart data={symbolData} layout="vertical" margin={{ top: 30, right: 35, left: 95, bottom: 30 }}>
                        <CartesianGrid {...chartGridProps} />
                        <XAxis xAxisId="bottom" type="number" stroke={CHART.axis} domain={[(dataMin) => !isNaN(dataMin) && isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.2)) : -10, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.2)) : 10]} />
                        <XAxis xAxisId="top" orientation="top" type="number" stroke={CHART.axis} domain={[0, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax * 1.1) : 100]} />
                        <YAxis dataKey="symbol" type="category" stroke={CHART.axis} width={90} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Legend />
                        <Bar {...chartSeriesProps} dataKey="totalPL" xAxisId="bottom" fill={CHART.profit} name={t('totalPLLabel')} radius={[0, 6, 6, 0]} />
                        <Bar {...chartSeriesProps} dataKey="winRate" xAxisId="top" fill={CHART.line} name={`${t('winRate')} (%)`} radius={[0, 6, 6, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {symbolData.map((symbol) => (
                <Card 
                  key={symbol.symbol} 
                  className={`border cursor-pointer transition-colors ${
                    selectedSymbol === symbol.symbol ? 'border-primary/40 bg-ds-s2' : 'border-ds-line'
                  }`}
                  onClick={() => setSelectedSymbol(symbol.symbol)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{symbol.symbol}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('winRate')}:</span>
                      <span className="font-bold text-foreground">{symbol.winRate}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('avgPLLabel')}:</span>
                      <span className={`font-bold ${symbol.avgPL >= 0 ? 'text-ds-pos' : 'text-ds-neg'}`}>
                        {symbol.avgPL > 0 ? '+' : ''}{symbol.avgPL.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('totalPLLabel')}:</span>
                      <span className={`font-bold ${symbol.totalPL >= 0 ? 'text-ds-pos' : 'text-ds-neg'}`}>
                        {symbol.totalPL > 0 ? '+' : ''}{symbol.totalPL.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('trades')}:</span>
                      <span className="font-bold text-foreground">{symbol.trades}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Detailed Symbol Analysis */}
            {selectedSymbol && (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-2xl text-foreground">
                      {t('detailedAnalysisSymbol')}: {selectedSymbol}
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedSymbol(null)}
                      className="text-muted-foreground hover:text-foreground"
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
                      const account = accounts.find(a => String(a.id) === String(trade.account_id));
                      const accountName = account?.name || "Nieznane";
                      if (!accountBreakdown[accountName]) {
                        accountBreakdown[accountName] = { wins: 0, losses: 0, total: 0, pl: 0 };
                      }
                      accountBreakdown[accountName].total++;
                      if (trade.outcome === "Win") accountBreakdown[accountName].wins++;
                      accountBreakdown[accountName].pl += (getTradeRealizedPL(trade) ?? 0);
                    });

                    const accountBreakdownData = Object.entries(accountBreakdown).map(([name, stats]) => ({
                      name,
                      winRate: decidedWinRate(stats.wins, stats.losses),
                      pl: Number(stats.pl.toFixed(2)),
                      trades: stats.total
                    }));

                    // Strategy breakdown
                    const strategyBreakdown = {};
                    symbolTrades.forEach(trade => {
                      const strategy = strategies.find(s => String(s.id) === String(trade.strategy_id));
                      const strategyName = strategy?.name || "Bez strategii";
                      if (!strategyBreakdown[strategyName]) {
                        strategyBreakdown[strategyName] = { wins: 0, losses: 0, total: 0, pl: 0 };
                      }
                      strategyBreakdown[strategyName].total++;
                      if (trade.outcome === "Win") strategyBreakdown[strategyName].wins++;
                      strategyBreakdown[strategyName].pl += (getTradeRealizedPL(trade) ?? 0);
                    });

                    const strategyBreakdownData = Object.entries(strategyBreakdown).map(([name, stats]) => ({
                      name,
                      winRate: decidedWinRate(stats.wins, stats.losses),
                      pl: Number(stats.pl.toFixed(2)),
                      trades: stats.total
                    }));

                    // Direction breakdown
                    const directionBreakdown = { Long: { wins: 0, losses: 0, total: 0, pl: 0 }, Short: { wins: 0, losses: 0, total: 0, pl: 0 } };
                    symbolTrades.forEach(trade => {
                      const direction = normalizeDirection(trade.direction);
                      if (directionBreakdown[direction]) {
                        directionBreakdown[direction].total++;
                        if (trade.outcome === "Win") directionBreakdown[direction].wins++;
                        directionBreakdown[direction].pl += (getTradeRealizedPL(trade) ?? 0);
                      }
                    });

                    const directionBreakdownData = Object.entries(directionBreakdown)
                      .filter(([_, stats]) => stats.total > 0)
                      .map(([dir, stats]) => ({
                        direction: dir,
                        winRate: decidedWinRate(stats.wins, stats.losses),
                        pl: Number(stats.pl.toFixed(2)),
                        trades: stats.total
                      }));

                    // Timeframe breakdown
                    const timeframeBreakdown = {};
                    symbolTrades.forEach(trade => {
                      if (trade.timeframe) {
                        if (!timeframeBreakdown[trade.timeframe]) {
                          timeframeBreakdown[trade.timeframe] = { wins: 0, losses: 0, total: 0, pl: 0 };
                        }
                        timeframeBreakdown[trade.timeframe].total++;
                        if (trade.outcome === "Win") timeframeBreakdown[trade.timeframe].wins++;
                        timeframeBreakdown[trade.timeframe].pl += (getTradeRealizedPL(trade) ?? 0);
                      }
                    });

                    const timeframeBreakdownData = Object.entries(timeframeBreakdown).map(([tf, stats]) => ({
                      timeframe: tf,
                      winRate: decidedWinRate(stats.wins, stats.losses),
                      pl: Number(stats.pl.toFixed(2)),
                      trades: stats.total
                    }));

                    // Best and worst trades
                    const sortedTrades = [...symbolTrades].sort((a, b) => 
                      ((getTradeRealizedPL(b) ?? 0) || 0) - ((getTradeRealizedPL(a) ?? 0) || 0)
                    );
                    const bestTrade = sortedTrades[0];
                    const worstTrade = sortedTrades[sortedTrades.length - 1];

                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Account Breakdown */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Wallet className="w-4 h-4" />
                                Według kont
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {accountBreakdownData.map(item => (
                                  <div key={item.name} className="flex justify-between items-center p-2 bg-ds-s2 rounded-lg">
                                    <div>
                                      <p className="font-semibold text-sm text-foreground">{item.name}</p>
                                      <p className="text-xs text-muted-foreground">{item.trades} transakcji</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-sm text-foreground">{item.winRate}%</p>
                                      <p className={`text-xs font-semibold ${item.pl >= 0 ? 'text-ds-pos' : 'text-ds-neg'}`}>
                                        {item.pl > 0 ? '+' : ''}{item.pl.toFixed(2)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Strategy Breakdown */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Brain className="w-4 h-4" />
                                {t('byStrategies')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {strategyBreakdownData.map(item => (
                                  <div key={item.name} className="flex justify-between items-center p-2 bg-ds-s2 rounded-lg">
                                    <div>
                                      <p className="font-semibold text-sm text-foreground">{item.name}</p>
                                      <p className="text-xs text-muted-foreground">{item.trades} transakcji</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-sm text-foreground">{item.winRate}%</p>
                                      <p className={`text-xs font-semibold ${item.pl >= 0 ? 'text-ds-pos' : 'text-ds-neg'}`}>
                                        {item.pl > 0 ? '+' : ''}{item.pl.toFixed(2)}
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
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">{t('longVsShort')}</CardTitle>
                            </CardHeader>
                            <CardContent className="overflow-hidden p-3">
                              <div className="w-full overflow-hidden px-2 py-1">
                                <ResponsiveContainer width="100%" height={230}>
                                  <BarChart data={directionBreakdownData} margin={{ top: 25, right: 25, left: 15, bottom: 25 }}>
                                    <CartesianGrid {...chartGridProps} />
                                    <XAxis dataKey="direction" stroke={CHART.axis} />
                                    <YAxis stroke={CHART.axis} width={50} domain={[0, (dataMax) => Math.ceil(dataMax * 1.1)]} />
                                    <Tooltip
                                      contentStyle={chartTooltipStyle}
                                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Legend />
                                    <Bar {...chartSeriesProps} dataKey="winRate" name={`${t('winRate')} (%)`} radius={chartBarRadius}>
                                      {directionBreakdownData.map((entry) => (
                                        <Cell key={entry.direction} fill={directionChartColor(entry.direction)} />
                                      ))}
                                    </Bar>
                                    <Bar {...chartSeriesProps} dataKey="trades" fill={CHART.muted} name={t('noOfTrades')} radius={chartBarRadius} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Timeframe Breakdown */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">{t('byTimeframe')}</CardTitle>
                            </CardHeader>
                            <CardContent className="overflow-hidden p-3">
                              <div className="w-full overflow-hidden px-2 py-1">
                                <ResponsiveContainer width="100%" height={230}>
                                  <BarChart data={timeframeBreakdownData} margin={{ top: 25, right: 25, left: 15, bottom: 25 }}>
                                    <CartesianGrid {...chartGridProps} />
                                    <XAxis dataKey="timeframe" stroke={CHART.axis} />
                                    <YAxis stroke={CHART.axis} width={50} domain={[0, (dataMax) => Math.ceil(dataMax * 1.1)]} />
                                    <Tooltip
                                      contentStyle={chartTooltipStyle}
                                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Legend />
                                    <Bar {...chartSeriesProps} dataKey="winRate" fill={CHART.muted} name={`${t('winRate')} (%)`} radius={chartBarRadius} />
                                    <Bar {...chartSeriesProps} dataKey="trades" fill={CHART.warning} name={t('noOfTrades')} radius={chartBarRadius} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Best and Worst Trades */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {bestTrade && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-base text-ds-pos flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4" />
                                  {t('bestTradeSingle')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('date')}:</span>
                                  <span className="text-sm font-semibold text-foreground">{bestTrade.date}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('direction')}:</span>
                                  <span className="text-sm font-semibold text-foreground">{normalizeDirection(bestTrade.direction)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('profitLoss')}:</span>
                                  <span className="text-lg font-bold text-ds-pos">
                                    {pnl.formatTrade(bestTrade)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('setup')}:</span>
                                  <span className="text-sm font-semibold text-foreground">{bestTrade.setup_quality}</span>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {worstTrade && (getTradeRealizedPL(worstTrade) ?? 0) < 0 && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-base text-ds-neg flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  {t('worstTradeSingle')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('date')}:</span>
                                  <span className="text-sm font-semibold text-foreground">{worstTrade.date}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('direction')}:</span>
                                  <span className="text-sm font-semibold text-foreground">{normalizeDirection(worstTrade.direction)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('profitLoss')}:</span>
                                  <span className="text-lg font-bold text-ds-neg">
                                    {pnl.formatTrade(worstTrade)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('setup')}:</span>
                                  <span className="text-sm font-semibold text-foreground">{worstTrade.setup_quality}</span>
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
          <TabsContent value="strategies" className="motion-tab-in space-y-6" data-reveal-skip={tabSwitched ? "true" : undefined}>
            <Card>
              <CardHeader>
                <CardTitle>{t('strategiesComparison')}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden p-4">
                <div className="w-full overflow-hidden px-4 py-2">
                  <ResponsiveContainer width="100%" height={450}>
                    <BarChart data={strategyData} margin={{ top: 30, right: 35, left: 20, bottom: 100 }}>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis dataKey="name" stroke={CHART.axis} angle={-45} textAnchor="end" height={95} />
                      <YAxis yAxisId="left" stroke={CHART.axis} width={60} domain={[0, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax * 1.1) : 100]} />
                      <YAxis yAxisId="right" orientation="right" stroke={CHART.axis} width={60} domain={[(dataMin) => !isNaN(dataMin) && isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.2)) : -10, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.2)) : 10]} />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Legend />
                      <Bar {...chartSeriesProps} dataKey="winRate" yAxisId="left" fill={CHART.line} name={`${t('winRate')} (%)`} radius={chartBarRadius} />
                      <Bar {...chartSeriesProps} dataKey="avgPL" yAxisId="right" fill={CHART.profit} name={t('avgPLLabel')} radius={chartBarRadius} />
                      <Bar {...chartSeriesProps} dataKey="trades" yAxisId="left" fill={CHART.muted} name={t('noOfTrades')} radius={chartBarRadius} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {strategyData.map((strategy) => (
                <Card 
                  key={strategy.name} 
                  className={`border cursor-pointer transition-colors ${
                    selectedStrategy === strategy.name ? 'border-primary/40 bg-ds-s2' : 'border-ds-line'
                  }`}
                  onClick={() => setSelectedStrategy(strategy.name)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{strategy.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-ds-s2 rounded-md text-center">
                        <p className="text-2xl font-bold text-foreground">{strategy.winRate}%</p>
                        <p className="text-xs text-muted-foreground">{t('winRate')}</p>
                      </div>
                      <div className="p-3 bg-ds-pos-tint dark:bg-ds-pos-tint rounded-lg text-center">
                        <p className={`text-2xl font-bold ${strategy.avgPL >= 0 ? 'text-ds-pos' : 'text-ds-neg'}`}>
                          {strategy.avgPL > 0 ? '+' : ''}{strategy.avgPL.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">{t('avgPLLabel')}</p>
                        </div>
                        </div>
                        <div className="flex justify-between p-3 bg-ds-s2 rounded-lg">
                        <span className="text-sm text-muted-foreground">{t('totalPLLabel')}:</span>
                      <span className={`font-bold ${strategy.totalPL >= 0 ? 'text-ds-pos' : 'text-ds-neg'}`}>
                        {strategy.totalPL > 0 ? '+' : ''}{strategy.totalPL.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 bg-ds-s2 rounded-lg">
                      <span className="text-sm text-muted-foreground">{t('trades')}:</span>
                      <span className="font-bold text-foreground">{strategy.trades}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Detailed Strategy Analysis */}
            {selectedStrategy && (
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-2xl text-foreground">
                      {t('detailedAnalysisSymbol')}: {selectedStrategy}
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedStrategy(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {(() => {
                    const strategyTrades = filteredTrades.filter(t => {
                      const strategy = strategies.find(s => String(s.id) === String(t.strategy_id));
                      return (strategy?.name || "Bez strategii") === selectedStrategy;
                    });
                    
                    // Account breakdown
                    const accountBreakdown = {};
                    strategyTrades.forEach(trade => {
                      const account = accounts.find(a => String(a.id) === String(trade.account_id));
                      const accountName = account?.name || "Nieznane";
                      if (!accountBreakdown[accountName]) {
                        accountBreakdown[accountName] = { wins: 0, losses: 0, total: 0, pl: 0 };
                      }
                      accountBreakdown[accountName].total++;
                      if (trade.outcome === "Win") accountBreakdown[accountName].wins++;
                      accountBreakdown[accountName].pl += (getTradeRealizedPL(trade) ?? 0);
                    });

                    const accountBreakdownData = Object.entries(accountBreakdown).map(([name, stats]) => ({
                      name,
                      winRate: decidedWinRate(stats.wins, stats.losses),
                      pl: Number(stats.pl.toFixed(2)),
                      trades: stats.total
                    }));

                    // Symbol breakdown
                    const symbolBreakdown = {};
                    strategyTrades.forEach(trade => {
                      if (!symbolBreakdown[trade.symbol]) {
                        symbolBreakdown[trade.symbol] = { wins: 0, losses: 0, total: 0, pl: 0 };
                      }
                      symbolBreakdown[trade.symbol].total++;
                      if (trade.outcome === "Win") symbolBreakdown[trade.symbol].wins++;
                      symbolBreakdown[trade.symbol].pl += (getTradeRealizedPL(trade) ?? 0);
                    });

                    const symbolBreakdownData = Object.entries(symbolBreakdown).map(([symbol, stats]) => ({
                      symbol,
                      winRate: decidedWinRate(stats.wins, stats.losses),
                      pl: Number(stats.pl.toFixed(2)),
                      trades: stats.total
                    })).sort((a, b) => b.pl - a.pl);

                    // Direction breakdown
                    const directionBreakdown = { Long: { wins: 0, losses: 0, total: 0, pl: 0 }, Short: { wins: 0, losses: 0, total: 0, pl: 0 } };
                    strategyTrades.forEach(trade => {
                      const direction = normalizeDirection(trade.direction);
                      if (directionBreakdown[direction]) {
                        directionBreakdown[direction].total++;
                        if (trade.outcome === "Win") directionBreakdown[direction].wins++;
                        directionBreakdown[direction].pl += (getTradeRealizedPL(trade) ?? 0);
                      }
                    });

                    const directionBreakdownData = Object.entries(directionBreakdown)
                      .filter(([_, stats]) => stats.total > 0)
                      .map(([dir, stats]) => ({
                        direction: dir,
                        winRate: decidedWinRate(stats.wins, stats.losses),
                        pl: Number(stats.pl.toFixed(2)),
                        trades: stats.total
                      }));

                    // Timeframe breakdown
                    const timeframeBreakdown = {};
                    strategyTrades.forEach(trade => {
                      if (trade.timeframe) {
                        if (!timeframeBreakdown[trade.timeframe]) {
                          timeframeBreakdown[trade.timeframe] = { wins: 0, losses: 0, total: 0, pl: 0 };
                        }
                        timeframeBreakdown[trade.timeframe].total++;
                        if (trade.outcome === "Win") timeframeBreakdown[trade.timeframe].wins++;
                        timeframeBreakdown[trade.timeframe].pl += (getTradeRealizedPL(trade) ?? 0);
                      }
                    });

                    const timeframeBreakdownData = Object.entries(timeframeBreakdown).map(([tf, stats]) => ({
                      timeframe: tf,
                      winRate: decidedWinRate(stats.wins, stats.losses),
                      pl: Number(stats.pl.toFixed(2)),
                      trades: stats.total
                    }));

                    // Best and worst trades
                    const sortedTrades = [...strategyTrades].sort((a, b) => 
                      ((getTradeRealizedPL(b) ?? 0) || 0) - ((getTradeRealizedPL(a) ?? 0) || 0)
                    );
                    const bestTrade = sortedTrades[0];
                    const worstTrade = sortedTrades[sortedTrades.length - 1];

                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Account Breakdown */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Wallet className="w-4 h-4" />
                                Według kont
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {accountBreakdownData.map(item => (
                                  <div key={item.name} className="flex justify-between items-center p-2 bg-ds-s2 rounded-lg">
                                    <div>
                                      <p className="font-semibold text-sm text-foreground">{item.name}</p>
                                      <p className="text-xs text-muted-foreground">{item.trades} transakcji</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-sm text-foreground">{item.winRate}%</p>
                                      <p className={`text-xs font-semibold ${item.pl >= 0 ? 'text-ds-pos' : 'text-ds-neg'}`}>
                                        {item.pl > 0 ? '+' : ''}{item.pl.toFixed(2)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Symbol Breakdown */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                {t('bySymbols')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                              {symbolBreakdownData.map(item => (
                               <div key={item.symbol} className="flex justify-between items-center p-2 bg-ds-s2 rounded-lg">
                                 <div>
                                   <p className="font-semibold text-sm text-foreground">{item.symbol}</p>
                                   <p className="text-xs text-muted-foreground">{item.trades} {t('trades')}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-sm text-foreground">{item.winRate}%</p>
                                      <p className={`text-xs font-semibold ${item.pl >= 0 ? 'text-ds-pos' : 'text-ds-neg'}`}>
                                        {item.pl > 0 ? '+' : ''}{item.pl.toFixed(2)}
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
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">{t('longVsShort')}</CardTitle>
                            </CardHeader>
                            <CardContent className="overflow-hidden p-3">
                              <div className="w-full overflow-hidden px-2 py-1">
                                <ResponsiveContainer width="100%" height={230}>
                                  <BarChart data={directionBreakdownData} margin={{ top: 25, right: 25, left: 15, bottom: 25 }}>
                                    <CartesianGrid {...chartGridProps} />
                                    <XAxis dataKey="direction" stroke={CHART.axis} />
                                    <YAxis stroke={CHART.axis} width={50} domain={[0, (dataMax) => Math.ceil(dataMax * 1.1)]} />
                                    <Tooltip
                                      contentStyle={chartTooltipStyle}
                                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Legend />
                                    <Bar {...chartSeriesProps} dataKey="winRate" name={`${t('winRate')} (%)`} radius={chartBarRadius}>
                                      {directionBreakdownData.map((entry) => (
                                        <Cell key={entry.direction} fill={directionChartColor(entry.direction)} />
                                      ))}
                                    </Bar>
                                    <Bar {...chartSeriesProps} dataKey="trades" fill={CHART.muted} name={t('noOfTrades')} radius={chartBarRadius} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Timeframe Breakdown */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">{t('byTimeframe')}</CardTitle>
                            </CardHeader>
                            <CardContent className="overflow-hidden p-3">
                              <div className="w-full overflow-hidden px-2 py-1">
                                <ResponsiveContainer width="100%" height={230}>
                                  <BarChart data={timeframeBreakdownData} margin={{ top: 25, right: 25, left: 15, bottom: 25 }}>
                                    <CartesianGrid {...chartGridProps} />
                                    <XAxis dataKey="timeframe" stroke={CHART.axis} />
                                    <YAxis stroke={CHART.axis} width={50} domain={[0, (dataMax) => Math.ceil(dataMax * 1.1)]} />
                                    <Tooltip
                                      contentStyle={chartTooltipStyle}
                                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Legend />
                                    <Bar {...chartSeriesProps} dataKey="winRate" fill={CHART.muted} name={`${t('winRate')} (%)`} radius={chartBarRadius} />
                                    <Bar {...chartSeriesProps} dataKey="trades" fill={CHART.warning} name={t('noOfTrades')} radius={chartBarRadius} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Best and Worst Trades */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {bestTrade && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-base text-ds-pos flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4" />
                                  {t('bestTradeSingle')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('date')}:</span>
                                  <span className="text-sm font-semibold text-foreground">{bestTrade.date}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('symbol')}:</span>
                                  <span className="text-sm font-semibold text-foreground">{bestTrade.symbol}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('direction')}:</span>
                                  <span className="text-sm font-semibold text-foreground">{bestTrade.direction}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('profitLoss')}:</span>
                                  <span className="text-lg font-bold text-ds-pos">
                                    {pnl.formatTrade(bestTrade)}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {worstTrade && (getTradeRealizedPL(worstTrade) ?? 0) < 0 && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-base text-ds-neg flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  {t('worstTradeSingle')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('date')}:</span>
                                  <span className="text-sm font-semibold text-foreground">{worstTrade.date}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('symbol')}:</span>
                                  <span className="text-sm font-semibold text-foreground">{worstTrade.symbol}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('direction')}:</span>
                                  <span className="text-sm font-semibold text-foreground">{worstTrade.direction}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('profitLoss')}:</span>
                                  <span className="text-lg font-bold text-ds-neg">
                                    {pnl.formatTrade(worstTrade)}
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
          <TabsContent value="accounts" className="motion-tab-in space-y-6" data-reveal-skip={tabSwitched ? "true" : undefined}>
            {/* Account Type Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Rozkład typów kont</CardTitle>
                </CardHeader>
                <CardContent className="overflow-hidden p-4">
                  <div className="w-full overflow-hidden">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                        <Pie {...chartSeriesProps}
                          data={[
                            { name: 'Live', value: accounts.filter(a => a.account_type === 'Live').length, fill: CHART.profit },
                            { name: 'Demo', value: accounts.filter(a => a.account_type === 'Demo').length, fill: CHART.muted },
                            { name: 'Challenge', value: accounts.filter(a => a.account_type === 'Challenge').length, fill: CHART.accent },
                            { name: 'Funded', value: accounts.filter(a => a.account_type === 'Funded').length, fill: CHART.warning }
                          ].filter(item => item.value > 0)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={85}
                          dataKey="value"
                        >
                          {[
                            { name: 'Live', value: accounts.filter(a => a.account_type === 'Live').length, fill: CHART.profit },
                            { name: 'Demo', value: accounts.filter(a => a.account_type === 'Demo').length, fill: CHART.muted },
                            { name: 'Challenge', value: accounts.filter(a => a.account_type === 'Challenge').length, fill: CHART.accent },
                            { name: 'Funded', value: accounts.filter(a => a.account_type === 'Funded').length, fill: CHART.warning }
                          ].filter(item => item.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Status kont</CardTitle>
                </CardHeader>
                <CardContent className="overflow-hidden p-4">
                  <div className="w-full overflow-hidden px-4 py-2">
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart data={[
                        { status: 'Aktywne', count: accounts.filter(a => a.status === 'Active').length, fill: CHART.profit },
                        { status: 'Nieaktywne', count: accounts.filter(a => a.status === 'Inactive').length, fill: CHART.muted },
                        { status: 'Zawieszone', count: accounts.filter(a => a.status === 'Suspended').length, fill: CHART.warning },
                        { status: 'Zamknięte', count: accounts.filter(a => a.status === 'Closed').length, fill: CHART.loss }
                      ].filter(item => item.count > 0)} margin={{ top: 30, right: 35, left: 20, bottom: 30 }}>
                        <CartesianGrid {...chartGridProps} />
                        <XAxis dataKey="status" stroke={CHART.axis} />
                        <YAxis stroke={CHART.axis} width={60} domain={[0, (dataMax) => Math.ceil(dataMax * 1.2)]} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Bar {...chartSeriesProps} dataKey="count" fill={CHART.line} radius={chartBarRadius} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('accountsComparison')}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden p-4">
                <div className="w-full overflow-hidden px-4 py-2">
                  <ResponsiveContainer width="100%" height={390}>
                    <BarChart data={accountData} margin={{ top: 30, right: 35, left: 20, bottom: 30 }}>
                      <CartesianGrid {...chartGridProps} />
                      <XAxis dataKey="name" stroke={CHART.axis} />
                      <YAxis yAxisId="left" stroke={CHART.axis} width={60} domain={[0, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax * 1.1) : 100]} />
                      <YAxis yAxisId="right" orientation="right" stroke={CHART.axis} width={60} domain={[(dataMin) => !isNaN(dataMin) && isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.2)) : -10, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.2)) : 10]} />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Legend />
                      <Bar {...chartSeriesProps} dataKey="winRate" yAxisId="left" fill={CHART.line} name="Win Rate (%)" radius={chartBarRadius} />
                      <Bar {...chartSeriesProps} dataKey="roi" yAxisId="right" fill={CHART.profit} name={t('roi')} radius={chartBarRadius} />
                      <Bar {...chartSeriesProps} dataKey="trades" yAxisId="left" fill={CHART.muted} name={t('noOfTrades')} radius={chartBarRadius} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {accountData.map((account) => (
                <Card key={account.name}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-foreground" />
                      {account.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-ds-s2 rounded-md text-center">
                        <p className="text-xl font-bold text-foreground">{account.winRate}%</p>
                        <p className="text-xs text-muted-foreground">{t('winRate')}</p>
                      </div>
                      <div className="p-3 bg-ds-pos-tint dark:bg-ds-pos-tint rounded-lg text-center">
                        <p className={`text-xl font-bold ${account.roi >= 0 ? 'text-ds-pos' : 'text-ds-neg'}`}>
                          {account.roi > 0 ? '+' : ''}{account.roi.toFixed(2)}%
                        </p>
                        <p className="text-xs text-muted-foreground">{t('roi')}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-ds-s2 rounded-lg">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-muted-foreground">{t('totalPLLabel')}:</span>
                        <span className={`font-bold ${account.totalPL >= 0 ? 'text-ds-pos' : 'text-ds-neg'}`}>
                          {account.totalPL > 0 ? '+' : ''}{account.totalPL.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t('trades')}:</span>
                        <span className="font-bold text-foreground">{account.trades}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Psychology Tab */}
          <TabsContent value="time" className="motion-tab-in space-y-6" data-reveal-skip={tabSwitched ? "true" : undefined}>
            {tradesWithTime === 0 ? (
              <Card>
                <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-3">
                  <Clock className="w-10 h-10 text-muted-foreground" />
                  <p className="max-w-md text-sm text-muted-foreground">{t('noTimeData')}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* KPI czasu */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">{t('tradesWithTime')}</span>
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
                        {tradesWithTime}<span className="text-base text-muted-foreground">/{filteredTrades.length}</span>
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-ds-pos">{t('bestSlot')}</span>
                        <TrendingUp className="w-4 h-4 text-ds-pos" />
                      </div>
                      <p className="mt-2 text-lg font-bold text-ds-pos">{bestSlot ? bestSlot.slot : '—'}</p>
                      <p className="text-[11px] text-ds-pos dark:text-ds-pos">
                        {bestSlot ? `${bestSlot.avgPL >= 0 ? '+' : ''}${bestSlot.avgPL} ${t('avg')} · ${bestSlot.winRate}%` : t('noData')}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-ds-neg">{t('worstSlot')}</span>
                        <AlertCircle className="w-4 h-4 text-ds-neg" />
                      </div>
                      <p className="mt-2 text-lg font-bold text-ds-neg">{worstSlot ? worstSlot.slot : '—'}</p>
                      <p className="text-[11px] text-ds-neg dark:text-ds-neg">
                        {worstSlot ? `${worstSlot.avgPL} ${t('avg')} · ${worstSlot.winRate}%` : t('noData')}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">{t('bestHour')}</span>
                        <Activity className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <p className="mt-2 text-2xl font-bold text-foreground">{bestHour ? bestHour.hour : '—'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {bestHour ? `${bestHour.winRate}% · ${bestHour.trades} ${t('trades')}` : t('noData')}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Wg godziny */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('byHourTitle')}</CardTitle>
                    <p className="text-xs text-muted-foreground">{t('byHourDesc')}</p>
                  </CardHeader>
                  <CardContent className="overflow-hidden p-4">
                    <div className="w-full overflow-hidden px-2 py-2">
                      <ResponsiveContainer width="100%" height={320}>
                        <ComposedChart data={hourData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                          <defs>
                            <linearGradient id="hourPLGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={CHART.profit} stopOpacity={0.25} />
                              <stop offset="95%" stopColor={CHART.profit} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...chartGridProps} />
                          <XAxis dataKey="hour" stroke={CHART.axis} />
                          <YAxis yAxisId="left" stroke={CHART.line} width={50} domain={[0, 100]} />
                          <YAxis yAxisId="right" orientation="right" stroke={CHART.profit} width={55} domain={[(dataMin) => !isNaN(dataMin) && isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.2)) : -10, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.2)) : 10]} />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                          />
                          <Legend />
                          <Area {...chartSeriesProps} yAxisId="right" type="monotone" dataKey="avgPL" name={t('avgPLLabel')} stroke={CHART.profit} strokeWidth={2.5} fill="url(#hourPLGradient)" dot={{ r: 3, fill: CHART.profit }} activeDot={{ r: 5 }} />
                          <Line {...chartSeriesProps} yAxisId="left" type="monotone" dataKey="winRate" name={`${t('winRate')} (%)`} stroke={CHART.line} strokeWidth={2.5} dot={{ r: 2, fill: CHART.line }} activeDot={{ r: 4 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Wg przedziału 15-minutowego */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t('bySlotTitle')}</CardTitle>
                    <p className="text-xs text-muted-foreground">{t('bySlotDesc')}</p>
                  </CardHeader>
                  <CardContent className="overflow-hidden p-4">
                    <div className="w-full overflow-x-auto py-2">
                      <ResponsiveContainer width="100%" height={Math.max(320, timeSlotData.length * 30)} minWidth={320}>
                        <BarChart data={timeSlotData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                          <CartesianGrid {...chartGridProps} />
                          <XAxis type="number" stroke={CHART.axis} />
                          <YAxis type="category" dataKey="slot" stroke={CHART.axis} width={110} tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                          />
                          <Legend />
                          <Bar {...chartSeriesProps} dataKey="avgPL" name={t('avgPLLabel')} radius={[0, 6, 6, 0]}>
                            {timeSlotData.map((d, i) => (
                              <Cell key={i} fill={d.avgPL >= 0 ? CHART.profit : CHART.loss} />
                            ))}
                          </Bar>
                          <Bar {...chartSeriesProps} dataKey="winRate" name={`${t('winRate')} (%)`} fill={CHART.line} radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-ds-line text-muted-foreground">
                            <th className="text-left py-2 px-2">{t('timeSlot')}</th>
                            <th className="text-right py-2 px-2">{t('trades')}</th>
                            <th className="text-right py-2 px-2">{t('winRate')}</th>
                            <th className="text-right py-2 px-2">{t('avg')}</th>
                            <th className="text-right py-2 px-2">{t('total')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timeSlotData.map((s) => (
                            <tr key={s.slotStart} className="border-b border-ds-line">
                              <td className="py-1.5 px-2 font-medium text-foreground">{s.slot}</td>
                              <td className="py-1.5 px-2 text-right text-muted-foreground">{s.trades}</td>
                              <td className={`py-1.5 px-2 text-right font-semibold ${s.winRate >= 50 ? 'text-ds-pos' : 'text-ds-neg'}`}>{s.winRate}%</td>
                              <td className={`py-1.5 px-2 text-right ${s.avgPL >= 0 ? 'text-ds-pos' : 'text-ds-neg'}`}>{s.avgPL >= 0 ? '+' : ''}{s.avgPL}</td>
                              <td className={`py-1.5 px-2 text-right font-semibold ${s.totalPL >= 0 ? 'text-ds-pos' : 'text-ds-neg'}`}>{s.totalPL >= 0 ? '+' : ''}{s.totalPL}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle>{t('anHeatmapTitle')}</CardTitle>
                    <p className="text-sm text-muted-foreground">{t('anHeatmapDesc')}</p>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="overflow-x-auto">
                      <div
                        className="grid gap-1 min-w-max"
                        style={{ gridTemplateColumns: `2.5rem repeat(${heatmap.hours.length}, minmax(2.25rem, 1fr))` }}
                      >
                        <div />
                        {heatmap.hours.map((hour) => (
                          <div key={hour} className="text-center text-[11px] text-muted-foreground">{String(hour).padStart(2, '0')}</div>
                        ))}
                        {t('anWeekdays').split(',').map((dayLabel, day) => (
                          <div key={dayLabel} className="contents">
                            <div className="flex items-center text-[11px] font-medium text-muted-foreground">{dayLabel}</div>
                            {heatmap.hours.map((hour) => {
                              const cell = heatmap.cells.find((c) => c.day === day && c.hour === hour);
                              const strength = cell && heatmap.maxAbs > 0 ? 0.15 + 0.75 * (Math.abs(cell.pl) / heatmap.maxAbs) : 0;
                              const color = cell ? (cell.pl >= 0 ? CHART.profit : CHART.loss) : null;
                              return (
                                <div
                                  key={hour}
                                  className="h-8 rounded-md border border-ds-line flex items-center justify-center text-[10px] font-medium text-foreground"
                                  style={color ? { backgroundColor: `color-mix(in srgb, ${color} ${Math.round(strength * 100)}%, transparent)` } : undefined}
                                  title={cell
                                    ? `${dayLabel} ${String(hour).padStart(2, '0')}:00 · ${fmtMoney(cell.pl)} · ${cell.trades} ${t('trades')}`
                                    : `${dayLabel} ${String(hour).padStart(2, '0')}:00 · —`}
                                >
                                  {cell ? cell.trades : ''}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="psychology" className="motion-tab-in space-y-6" data-reveal-skip={tabSwitched ? "true" : undefined}>
            {/* Tiltometr — kluczowe wskaźniki psychologiczne */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{t('emotionControl')}</span>
                    <Brain className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {avgEmotionRating > 0 ? `${avgEmotionRating}/5` : '—'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{t('emotionControlDesc')}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{t('emotionCoverage')}</span>
                    <Activity className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {tradesWithEmotions.length}<span className="text-base text-muted-foreground">/{filteredTrades.length}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{emotionCoverage}% {t('emotionCoverageDesc')}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ds-neg">{t('costliestEmotion')}</span>
                    <AlertCircle className="w-4 h-4 text-ds-neg" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-ds-neg truncate" title={worstEmotion?.tag}>
                    {worstEmotion && worstEmotion.avgPL < 0 ? worstEmotion.tag : '—'}
                  </p>
                  <p className="text-[11px] text-ds-neg dark:text-ds-neg">
                    {worstEmotion && worstEmotion.avgPL < 0 ? `${worstEmotion.avgPL} ${t('perTrade')}` : t('noData')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ds-pos">{t('bestEmotionLabel')}</span>
                    <TrendingUp className="w-4 h-4 text-ds-pos" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-ds-pos truncate" title={bestEmotion?.tag}>
                    {bestEmotion && bestEmotion.avgPL > 0 ? bestEmotion.tag : '—'}
                  </p>
                  <p className="text-[11px] text-ds-pos dark:text-ds-pos">
                    {bestEmotion && bestEmotion.avgPL > 0 ? `+${bestEmotion.avgPL} ${t('perTrade')}` : t('noData')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {tradesWithEmotions.length === 0 ? (
              <Card>
                <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-3">
                  <Brain className="w-10 h-10 text-muted-foreground" />
                  <p className="max-w-md text-sm text-muted-foreground">{t('noEmotionData')}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Emocje a wynik */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('emotionVsResult')}</CardTitle>
                      <p className="text-xs text-muted-foreground">{t('emotionVsResultDesc')}</p>
                    </CardHeader>
                    <CardContent className="overflow-hidden p-4">
                      <div className="w-full overflow-hidden px-2 py-2">
                        <ResponsiveContainer width="100%" height={Math.max(320, emotionPerf.length * 46)}>
                          <BarChart data={emotionPerf} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                            <CartesianGrid {...chartGridProps} />
                            <XAxis type="number" stroke={CHART.axis} />
                            <YAxis type="category" dataKey="tag" stroke={CHART.axis} width={150} tick={{ fontSize: 11 }} />
                            <Tooltip
                              contentStyle={chartTooltipStyle}
                              itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Legend />
                            <Bar {...chartSeriesProps} dataKey="avgPL" name={t('avgPLLabel')} radius={[0, 6, 6, 0]}>
                              {emotionPerf.map((e, i) => (
                                <Cell key={i} fill={e.avgPL >= 0 ? CHART.profit : CHART.loss} />
                              ))}
                            </Bar>
                            <Bar {...chartSeriesProps} dataKey="winRate" name={`${t('winRate')} (%)`} fill={CHART.muted} radius={[0, 6, 6, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Ocena wg etapu: wygrane vs przegrane */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('ratingByOutcomeTitle')}</CardTitle>
                      <p className="text-xs text-muted-foreground">{t('ratingByOutcomeDesc')}</p>
                    </CardHeader>
                    <CardContent className="overflow-hidden p-4">
                      <div className="w-full overflow-hidden px-2 py-2">
                        <ResponsiveContainer width="100%" height={340}>
                          <BarChart data={stageRatingByOutcome} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                            <CartesianGrid {...chartGridProps} />
                            <XAxis dataKey="stage" stroke={CHART.axis} />
                            <YAxis stroke={CHART.axis} domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} width={40} />
                            <Tooltip
                              contentStyle={chartTooltipStyle}
                              itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Legend />
                            <Bar {...chartSeriesProps} dataKey="win" name={t('ratingWin')} fill={CHART.profit} radius={chartBarRadius} />
                            <Bar {...chartSeriesProps} dataKey="breakeven" name={t('ratingBreakeven')} fill={CHART.warning} radius={chartBarRadius} />
                            <Bar {...chartSeriesProps} dataKey="loss" name={t('ratingLoss')} fill={CHART.loss} radius={chartBarRadius} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Tiltometr w czasie */}
                  <Card>
                    <CardHeader>
                      <CardTitle>{t('tiltMeterTitle')}</CardTitle>
                      <p className="text-xs text-muted-foreground">{t('tiltMeterDesc')}</p>
                    </CardHeader>
                    <CardContent className="overflow-hidden p-4">
                      <div className="w-full overflow-hidden px-2 py-2">
                        <ResponsiveContainer width="100%" height={320}>
                          <AreaChart data={tiltOverTime} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                            <defs>
                              <linearGradient id="tiltGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={CHART.muted} stopOpacity={0.5} />
                                <stop offset="95%" stopColor={CHART.muted} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid {...chartGridProps} />
                            <XAxis dataKey="idx" stroke={CHART.axis} />
                            <YAxis stroke={CHART.axis} domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} width={40} />
                            <Tooltip
                              contentStyle={chartTooltipStyle}
                              itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Area {...chartSeriesProps} type="monotone" dataKey="rating" name={t('emotionRatingShort')} stroke={CHART.muted} strokeWidth={2} fill="url(#tiltGradient)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Najczęstsze emocje wg etapu */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-foreground">{t('topEmotionsTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {topTagsByStage.map((stage) => (
                        <div key={stage.stage}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{stage.stage}</p>
                          {stage.items.length === 0 ? (
                            <p className="text-xs text-muted-foreground pl-1">{t('noData')}</p>
                          ) : (
                            <div className="space-y-1.5">
                              {stage.items.map((it) => (
                                <div key={it.tag} className="flex justify-between items-center px-3 py-1.5 bg-ds-s2 rounded-lg">
                                  <span className="text-sm text-foreground truncate">{it.tag}</span>
                                  <span className="flex items-center gap-3 shrink-0">
                                    <span className="text-xs text-muted-foreground">×{it.total}</span>
                                    <span className={`text-xs font-semibold ${it.winRate >= 50 ? 'text-ds-pos' : 'text-ds-neg'}`}>{it.winRate}%</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {/* Pewność setupu a wynik */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>{t('confidenceVsResultTitle')}</CardTitle>
                  <p className="text-xs text-muted-foreground">{t('confidenceVsResultDesc')}</p>
                </CardHeader>
                <CardContent className="overflow-hidden p-4">
                  {!hasConfidenceData ? (
                    <div className="h-[320px] flex items-center justify-center text-center rounded-lg border border-dashed border-ds-line text-muted-foreground px-6">
                      {t('noConfidenceData')}
                    </div>
                  ) : (
                    <div className="w-full overflow-hidden px-2 py-2">
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={confidenceData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                          <CartesianGrid {...chartGridProps} />
                          <XAxis dataKey="level" stroke={CHART.axis} />
                          <YAxis yAxisId="left" stroke={CHART.axis} width={50} domain={[0, 100]} />
                          <YAxis yAxisId="right" orientation="right" stroke={CHART.axis} width={55} domain={[(dataMin) => !isNaN(dataMin) && isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.2)) : -10, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.2)) : 10]} />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                          />
                          <Legend />
                          <Bar {...chartSeriesProps} dataKey="winRate" yAxisId="left" fill={CHART.warning} name={`${t('winRate')} (%)`} radius={chartBarRadius} />
                          <Bar {...chartSeriesProps} dataKey="avgPL" yAxisId="right" name={t('avgPLLabel')} radius={chartBarRadius}>
                            {confidenceData.map((d, i) => (
                              <Cell key={i} fill={d.avgPL >= 0 ? CHART.profit : CHART.loss} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-ds-warn flex items-center justify-between">
                    <span>{t('avgConfidence')}</span>
                    <span className="text-2xl">{hasConfidenceData ? `${avgConfidence}⭐` : '—'}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!hasConfidenceData ? (
                    <p className="text-xs text-ds-warn">{t('noConfidenceData')}</p>
                  ) : (
                    confidenceData.filter((d) => d.trades > 0).map((d) => (
                      <div key={d.level} className="flex justify-between items-center px-3 py-2 bg-ds-s2 rounded-lg">
                        <span className="text-sm font-semibold text-foreground">{d.level}</span>
                        <span className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground">×{d.trades}</span>
                          <span className={`text-xs font-semibold ${d.winRate >= 50 ? 'text-ds-pos' : 'text-ds-neg'}`}>{d.winRate}%</span>
                          <span className={`text-xs font-semibold ${d.avgPL >= 0 ? 'text-ds-pos' : 'text-ds-neg'}`}>{d.avgPL >= 0 ? '+' : ''}{d.avgPL}</span>
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Jakość setupu (uzupełniająco) */}
            <Card>
              <CardHeader>
                <CardTitle>{t('setupQuality')}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden p-4">
                {setupData.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center rounded-lg border border-dashed border-ds-line text-muted-foreground">
                    {t('noData')}
                  </div>
                ) : (
                  <div className="w-full overflow-hidden px-4 py-2">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={setupData} margin={{ top: 30, right: 35, left: 20, bottom: 30 }}>
                        <CartesianGrid {...chartGridProps} />
                        <XAxis dataKey="quality" stroke={CHART.axis} />
                        <YAxis yAxisId="left" stroke={CHART.axis} width={60} domain={[0, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax * 1.1) : 100]} />
                        <YAxis yAxisId="right" orientation="right" stroke={CHART.axis} width={60} domain={[(dataMin) => !isNaN(dataMin) && isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.2)) : -10, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.2)) : 10]} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Legend />
                        <Bar {...chartSeriesProps} dataKey="winRate" yAxisId="left" fill={CHART.warning} name={`${t('winRate')} (%)`} radius={chartBarRadius} />
                        <Bar {...chartSeriesProps} dataKey="avgPL" yAxisId="right" fill={CHART.profit} name={t('avgPLLabel')} radius={chartBarRadius} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="confluences" className="motion-tab-in space-y-6" data-reveal-skip={tabSwitched ? "true" : undefined}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ds-pos">{t('tagCoverage')}</span>
                    <ListChecks className="w-4 h-4 text-ds-pos" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-ds-pos">
                    {confluenceAgg.taggedTrades}<span className="text-base text-ds-pos">/{filteredTrades.length}</span>
                  </p>
                  <p className="text-[11px] text-ds-pos dark:text-ds-pos">{confluenceCoverage}% {t('entryConditionsCoverageDesc')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{t('mostFrequentTag')}</span>
                    <Activity className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-foreground truncate" title={confluenceByFreq[0]?.tag}>
                    {confluenceByFreq[0]?.tag || "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {confluenceByFreq[0] ? `${confluenceByFreq[0].trades} ${t('trades')}` : t('noData')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ds-neg">{t('weakestCondition')}</span>
                    <AlertCircle className="w-4 h-4 text-ds-neg" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-ds-neg truncate" title={worstConfluence?.tag}>
                    {worstConfluence && worstConfluence.avgPL < 0 ? worstConfluence.tag : "—"}
                  </p>
                  <p className="text-[11px] text-ds-neg dark:text-ds-neg">
                    {worstConfluence && worstConfluence.avgPL < 0 ? `${worstConfluence.avgPL} ${t('perTrade')}` : t('noData')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ds-pos">{t('strongestCondition')}</span>
                    <TrendingUp className="w-4 h-4 text-ds-pos" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-ds-pos truncate" title={bestConfluence?.tag}>
                    {bestConfluence && bestConfluence.avgPL > 0 ? bestConfluence.tag : "—"}
                  </p>
                  <p className="text-[11px] text-ds-pos dark:text-ds-pos">
                    {bestConfluence && bestConfluence.avgPL > 0 ? `+${bestConfluence.avgPL} ${t('perTrade')}` : t('noData')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {confluencePerf.length === 0 ? (
              <Card>
                <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-3">
                  <ListChecks className="w-10 h-10 text-ds-pos" />
                  <p className="max-w-md text-sm text-muted-foreground">{t('noEntryConditionData')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('conditionVsResult')}</CardTitle>
                    <p className="text-xs text-muted-foreground">{t('conditionVsResultDesc')}</p>
                  </CardHeader>
                  <CardContent className="overflow-hidden p-4">
                    <ResponsiveContainer width="100%" height={Math.max(320, confluencePerf.length * 44)}>
                      <BarChart data={confluencePerf} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                        <CartesianGrid {...chartGridProps} />
                        <XAxis type="number" stroke={CHART.axis} />
                        <YAxis type="category" dataKey="tag" stroke={CHART.axis} width={140} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Legend />
                        <Bar {...chartSeriesProps} dataKey="avgPL" name={t("avgPLLabel")} radius={[0, 6, 6, 0]}>
                          {confluencePerf.map((e, i) => (
                            <Cell key={i} fill={e.avgPL >= 0 ? CHART.profit : CHART.loss} />
                          ))}
                        </Bar>
                        <Bar {...chartSeriesProps} dataKey="winRate" name={`${t("winRate")} (%)`} fill={CHART.profit} radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle>{t('conditionTableTitle')}</CardTitle>
                    <p className="text-xs text-muted-foreground">{t('conditionTableDesc')}</p>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ds-line bg-ds-s2 text-xs text-muted-foreground">
                          <th className="text-left py-2 px-3 font-medium">{t('entryConditionsTab')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('trades')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('winRate')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('avg')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('total')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {confluenceByFreq.map((row) => (
                          <tr key={row.tag} className="border-b border-ds-line">
                            <td className="py-2 px-3 font-medium truncate max-w-[160px]" title={row.tag}>{row.tag}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{row.trades}</td>
                            <td className={`py-2 px-3 text-right font-semibold tabular-nums ${row.winRate >= 50 ? "text-ds-pos" : "text-ds-neg"}`}>{row.winRate}%</td>
                            <td className={`py-2 px-3 text-right tabular-nums ${row.avgPL >= 0 ? "text-ds-pos" : "text-ds-neg"}`}>{row.avgPL >= 0 ? "+" : ""}{row.avgPL}</td>
                            <td className={`py-2 px-3 text-right font-semibold tabular-nums ${row.totalPL >= 0 ? "text-ds-pos" : "text-ds-neg"}`}>{row.totalPL >= 0 ? "+" : ""}{row.totalPL}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="mistakes" className="motion-tab-in space-y-6" data-reveal-skip={tabSwitched ? "true" : undefined}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ds-neg">{t('tagCoverage')}</span>
                    <AlertTriangle className="w-4 h-4 text-ds-neg" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-ds-neg">
                    {mistakeAgg.taggedTrades}<span className="text-base text-ds-neg">/{filteredTrades.length}</span>
                  </p>
                  <p className="text-[11px] text-ds-neg dark:text-ds-neg">{mistakeCoverage}% {t('mistakesCoverageDesc')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ds-warn">{t('mostFrequentMistake')}</span>
                    <Activity className="w-4 h-4 text-ds-warn" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-ds-warn truncate" title={mistakeByFreq[0]?.tag}>
                    {mistakeByFreq[0]?.tag || "—"}
                  </p>
                  <p className="text-[11px] text-ds-warn">
                    {mistakeByFreq[0] ? `${mistakeByFreq[0].trades}×` : t('noData')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ds-neg">{t('costliestMistake')}</span>
                    <AlertCircle className="w-4 h-4 text-ds-neg" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-ds-neg truncate" title={costliestMistake?.tag}>
                    {costliestMistake && costliestMistake.avgPL < 0 ? costliestMistake.tag : "—"}
                  </p>
                  <p className="text-[11px] text-ds-neg dark:text-ds-neg">
                    {costliestMistake && costliestMistake.avgPL < 0
                      ? `${costliestMistake.avgPL} ${t('perTrade')} · Σ ${costliestMistake.totalPL}`
                      : t('noData')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{t('leastHarmfulMistake')}</span>
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-foreground truncate" title={bestMistakeAvoid?.tag}>
                    {bestMistakeAvoid?.tag || "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {bestMistakeAvoid ? `${bestMistakeAvoid.avgPL >= 0 ? "+" : ""}${bestMistakeAvoid.avgPL} ${t('perTrade')}` : t('noData')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {mistakePerf.length === 0 ? (
              <Card>
                <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-3">
                  <AlertTriangle className="w-10 h-10 text-ds-neg" />
                  <p className="max-w-md text-sm text-muted-foreground">{t('noMistakeData')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('mistakeVsResult')}</CardTitle>
                    <p className="text-xs text-muted-foreground">{t('mistakeVsResultDesc')}</p>
                  </CardHeader>
                  <CardContent className="overflow-hidden p-4">
                    <ResponsiveContainer width="100%" height={Math.max(320, mistakePerf.length * 44)}>
                      <BarChart data={mistakePerf} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                        <CartesianGrid {...chartGridProps} />
                        <XAxis type="number" stroke={CHART.axis} />
                        <YAxis type="category" dataKey="tag" stroke={CHART.axis} width={140} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Legend />
                        <Bar {...chartSeriesProps} dataKey="avgPL" name={t("avgPLLabel")} radius={[0, 6, 6, 0]}>
                          {mistakePerf.map((e, i) => (
                            <Cell key={i} fill={e.avgPL >= 0 ? CHART.profit : CHART.loss} />
                          ))}
                        </Bar>
                        <Bar {...chartSeriesProps} dataKey="winRate" name={`${t("winRate")} (%)`} fill={CHART.loss} radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle>{t('mistakeTableTitle')}</CardTitle>
                    <p className="text-xs text-muted-foreground">{t('mistakeTableDesc')}</p>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ds-line bg-ds-s2 text-xs text-muted-foreground">
                          <th className="text-left py-2 px-3 font-medium">{t('mistakesTab')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('trades')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('winRate')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('avg')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('total')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mistakeByFreq.map((row) => (
                          <tr key={row.tag} className="border-b border-ds-line">
                            <td className="py-2 px-3 font-medium truncate max-w-[160px]" title={row.tag}>{row.tag}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{row.trades}</td>
                            <td className={`py-2 px-3 text-right font-semibold tabular-nums ${row.winRate >= 50 ? "text-ds-pos" : "text-ds-neg"}`}>{row.winRate}%</td>
                            <td className={`py-2 px-3 text-right tabular-nums ${row.avgPL >= 0 ? "text-ds-pos" : "text-ds-neg"}`}>{row.avgPL >= 0 ? "+" : ""}{row.avgPL}</td>
                            <td className={`py-2 px-3 text-right font-semibold tabular-nums ${row.totalPL >= 0 ? "text-ds-pos" : "text-ds-neg"}`}>{row.totalPL >= 0 ? "+" : ""}{row.totalPL}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}