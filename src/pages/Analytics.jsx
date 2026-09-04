import { useState, useRef, useEffect } from "react";
import { useAuth } from '@/lib/AuthContext';
import { getTrades, getTradingAccounts, getStrategies } from '@/lib/localStorage';
import { directionChartColor, getTradeRealizedPL, isClosedTrade, tradeOutcomeDisplay } from '@/lib/utils';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, TrendingUp, AlertCircle, Wallet, Activity, X, ChevronDown, Clock, ListChecks, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ComposedChart } from "recharts";
import { ExportButton } from "../components/ExportButton";
import { ImportButton } from "../components/ImportButton";
import { useLanguage } from "@/components/LanguageProvider";
import { normalizeEmotions, countFilledEmotionStages } from "@/components/EmotionsPanel";
import { getTradeEntryMinutes } from "@/lib/userSettings";
import { aggregateTagPerformance } from "@/lib/tradeTags";
import { CHART, chartTooltipStyle } from "@/lib/chartTheme";
import QuoteLine from "@/components/QuoteLine";

const decidedWinRate = (wins, losses) => {
  const decided = wins + losses;
  return decided > 0 ? Number(((wins / decided) * 100).toFixed(1)) : 0;
};

const tradeChronoKey = (trade) => {
  const date = String(trade?.date || "").slice(0, 10);
  const raw = String(trade?.entry_time || trade?.open_time || trade?.time || "00:00:00");
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const hh = m ? String(Number(m[1])).padStart(2, "0") : "00";
  const mm = m ? m[2] : "00";
  const ss = m?.[3] || "00";
  return `${date}T${hh}:${mm}:${ss}`;
};

const sortTradesChronoAsc = (list) =>
  [...list].sort((a, b) => tradeChronoKey(a).localeCompare(tradeChronoKey(b)));

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
  const { user } = useAuth();
  const [selectedAccounts, setSelectedAccounts] = useState(["all"]);
  const [filterSymbols, setFilterSymbols] = useState(["all"]);
  const [filterStrategies, setFilterStrategies] = useState(["all"]);
  const [filterDirections, setFilterDirections] = useState(["all"]);
  const [filterOutcomes, setFilterOutcomes] = useState(["all"]);
  const [filterTimeframes, setFilterTimeframes] = useState(["all"]);
  
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [symbolDropdownOpen, setSymbolDropdownOpen] = useState(false);
  const [strategyDropdownOpen, setStrategyDropdownOpen] = useState(false);
  const [directionDropdownOpen, setDirectionDropdownOpen] = useState(false);
  const [outcomeDropdownOpen, setOutcomeDropdownOpen] = useState(false);
  const [timeframeDropdownOpen, setTimeframeDropdownOpen] = useState(false);
  
  const accountDropdownRef = useRef(null);
  const symbolDropdownRef = useRef(null);
  const strategyDropdownRef = useRef(null);
  const directionDropdownRef = useRef(null);
  const outcomeDropdownRef = useRef(null);
  const timeframeDropdownRef = useRef(null);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [timePeriod, setTimePeriod] = useState("weekly");
  const [activeTab, setActiveTab] = useState("overview");

  const { data: trades = [], isLoading } = useQuery({
    queryKey: ['trades'],
    queryFn: () => getTrades(user?.id),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => getTradingAccounts(user?.id),
  });

  const activeAccounts = accounts.filter((account) => account.is_active !== false && account.status !== 'Inactive');
  const inactiveAccountIds = new Set(
    accounts
      .filter((account) => account.is_active === false || account.status === 'Inactive')
      .map((account) => String(account.id))
  );
  // Include trades without account_id; exclude only inactive accounts (same as Journal/Dashboard)
  const tradesFromActiveAccounts = trades.filter((trade) => {
    if (!trade.account_id) return true;
    return !inactiveAccountIds.has(String(trade.account_id));
  });

  const { data: strategies = [] } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => getStrategies(user?.id),
  });

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) setAccountDropdownOpen(false);
      if (symbolDropdownRef.current && !symbolDropdownRef.current.contains(event.target)) setSymbolDropdownOpen(false);
      if (strategyDropdownRef.current && !strategyDropdownRef.current.contains(event.target)) setStrategyDropdownOpen(false);
      if (directionDropdownRef.current && !directionDropdownRef.current.contains(event.target)) setDirectionDropdownOpen(false);
      if (outcomeDropdownRef.current && !outcomeDropdownRef.current.contains(event.target)) setOutcomeDropdownOpen(false);
      if (timeframeDropdownRef.current && !timeframeDropdownRef.current.contains(event.target)) setTimeframeDropdownOpen(false);
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

  // Filter trades by selected filters
  const filteredTrades = tradesFromActiveAccounts.filter(t => (
    isClosedTrade(t) &&
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

  // Equity curve — chronological by date + entry time
  let cumulative = 0;
  const equityCurve = [
    { trade: 0, equity: 0, date: '' },
    ...sortTradesChronoAsc(filteredTrades).map((trade, index) => {
      cumulative += (getTradeRealizedPL(trade) ?? 0);
      return {
        trade: index + 1,
        equity: Math.round(cumulative * 100) / 100,
        date: trade.date
      };
    })
  ];

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full"></div>
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
  const outcomeTotal = outcomeCounts.wins + outcomeCounts.losses + outcomeCounts.breakeven;
  const outcomeWinRate = outcomeDecided > 0 ? (outcomeCounts.wins / outcomeDecided) * 100 : 0;
  const outcomeChartData = [
    {
      name: t('wins'),
      count: outcomeCounts.wins,
      rate: outcomeTotal ? (outcomeCounts.wins / outcomeTotal) * 100 : 0,
      fill: CHART.profit
    },
    {
      name: t('breakeven'),
      count: outcomeCounts.breakeven,
      rate: outcomeTotal ? (outcomeCounts.breakeven / outcomeTotal) * 100 : 0,
      fill: CHART.warning
    },
    {
      name: t('losses'),
      count: outcomeCounts.losses,
      rate: outcomeTotal ? (outcomeCounts.losses / outcomeTotal) * 100 : 0,
      fill: CHART.loss
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
    <div className="analytics-page w-full min-h-0 space-y-6 dashboard-surface">
      <div className="max-w-none mx-0 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="cyber-page-title">{t('advancedAnalytics')}</h1>
            <p className="cyber-page-sub">{t('detailedAnalysisOfAllAspects')}</p>
          </div>
          
          <div className="flex gap-3 items-center">
            <QuoteLine className="hidden lg:flex shrink-0" />
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

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center">{t('account')}</span>
            <div className="relative" ref={accountDropdownRef}>
              <button
                onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                className="relative h-10 w-full px-3 rounded-lg border border-border bg-card text-sm flex items-center justify-center hover:bg-muted/40"
              >
                <span className="truncate text-center w-full pr-5">{selectedAccountsLabel || t('allAccounts')}</span>
                <ChevronDown className="absolute right-3 w-4 h-4 opacity-50" />
              </button>
              {accountDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border bg-popover p-1 shadow-md max-h-64 overflow-y-auto">
                  {(() => {
                    const isSelected = selectedAccounts.includes('all');
                    return (
                  <button
                    onClick={() => toggleMultiFilter(setSelectedAccounts, 'all')}
                    className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? 'bg-accent' : ''}`}
                  >
                    <span className="truncate">{t('allAccounts')}</span>
                    <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
                      {isSelected && (
                        <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                  </button>
                    );
                  })()}
                  {activeAccounts.map(acc => (
                    (() => {
                      const isSelected = selectedAccounts.includes(String(acc.id));
                      return (
                    <button
                      key={acc.id}
                      onClick={() => toggleMultiFilter(setSelectedAccounts, acc.id)}
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
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center">{t('symbol')}</span>
            <div className="relative" ref={symbolDropdownRef}>
              <button
                onClick={() => setSymbolDropdownOpen(!symbolDropdownOpen)}
                className="relative h-10 w-full px-3 rounded-lg border border-border bg-card text-sm flex items-center justify-center hover:bg-muted/40"
              >
                <span className="truncate text-center w-full pr-5">{selectedSymbolsLabel || t('all')}</span>
                <ChevronDown className="absolute right-3 w-4 h-4 opacity-50" />
              </button>
              {symbolDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border bg-popover p-1 shadow-md max-h-64 overflow-y-auto">
                  {(() => {
                    const isSelected = filterSymbols.includes('all');
                    return (
                  <button
                    onClick={() => toggleMultiFilter(setFilterSymbols, 'all')}
                    className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? 'bg-accent' : ''}`}
                  >
                    <span className="truncate">{t('all')}</span>
                    <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
                      {isSelected && (
                        <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                  </button>
                    );
                  })()}
                  {uniqueSymbols.map(sym => (
                    (() => {
                      const isSelected = filterSymbols.includes(String(sym));
                      return (
                    <button
                      key={sym}
                      onClick={() => toggleMultiFilter(setFilterSymbols, sym)}
                      className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? 'bg-accent' : ''}`}
                    >
                      <span className="truncate">{sym}</span>
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
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center">{t('strategy')}</span>
            <div className="relative" ref={strategyDropdownRef}>
              <button
                onClick={() => setStrategyDropdownOpen(!strategyDropdownOpen)}
                className="relative h-10 w-full px-3 rounded-lg border border-border bg-card text-sm flex items-center justify-center hover:bg-muted/40"
              >
                <span className="truncate text-center w-full pr-5">{selectedStrategiesLabel || t('all')}</span>
                <ChevronDown className="absolute right-3 w-4 h-4 opacity-50" />
              </button>
              {strategyDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border bg-popover p-1 shadow-md max-h-64 overflow-y-auto">
                  <button
                    onClick={() => toggleMultiFilter(setFilterStrategies, 'all')}
                    className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${filterStrategies.includes('all') ? 'bg-accent' : ''}`}
                  >
                    <span className="truncate">{t('all')}</span>
                    <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${filterStrategies.includes('all') ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
                      {filterStrategies.includes('all') && (
                        <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                  </button>
                  {strategies.map(strategy => (
                    <button
                      key={strategy.id}
                      onClick={() => toggleMultiFilter(setFilterStrategies, strategy.id)}
                      className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${filterStrategies.includes(String(strategy.id)) ? 'bg-accent' : ''}`}
                    >
                      <span className="truncate">{strategy.name}</span>
                      <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${filterStrategies.includes(String(strategy.id)) ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
                        {filterStrategies.includes(String(strategy.id)) && (
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center">{t('direction')}</span>
            <div className="relative" ref={directionDropdownRef}>
              <button
                onClick={() => setDirectionDropdownOpen(!directionDropdownOpen)}
                className="relative h-10 w-full px-3 rounded-lg border border-border bg-card text-sm flex items-center justify-center hover:bg-muted/40"
              >
                <span className="truncate text-center w-full pr-5">{selectedDirectionsLabel || t('all')}</span>
                <ChevronDown className="absolute right-3 w-4 h-4 opacity-50" />
              </button>
              {directionDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border bg-popover p-1 shadow-md max-h-64 overflow-y-auto">
                  {(() => {
                    const isSelected = filterDirections.includes('all');
                    return (
                  <button
                    onClick={() => toggleMultiFilter(setFilterDirections, 'all')}
                    className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? 'bg-accent' : ''}`}
                  >
                    <span className="truncate">{t('all')}</span>
                    <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
                      {isSelected && (
                        <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                  </button>
                    );
                  })()}
                  {uniqueDirections.map(dir => (
                    (() => {
                      const isSelected = filterDirections.includes(String(dir));
                      return (
                    <button
                      key={dir}
                      onClick={() => toggleMultiFilter(setFilterDirections, dir)}
                      className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? 'bg-accent' : ''}`}
                    >
                      <span className="truncate">{dir}</span>
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
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center">{t('outcome')}</span>
            <div className="relative" ref={outcomeDropdownRef}>
              <button
                onClick={() => setOutcomeDropdownOpen(!outcomeDropdownOpen)}
                className="relative h-10 w-full px-3 rounded-lg border border-border bg-card text-sm flex items-center justify-center hover:bg-muted/40"
              >
                <span className="truncate text-center w-full pr-5">{selectedOutcomesLabel || t('all')}</span>
                <ChevronDown className="absolute right-3 w-4 h-4 opacity-50" />
              </button>
              {outcomeDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border bg-popover p-1 shadow-md max-h-64 overflow-y-auto">
                  {(() => {
                    const isSelected = filterOutcomes.includes('all');
                    return (
                  <button
                    onClick={() => toggleMultiFilter(setFilterOutcomes, 'all')}
                    className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? 'bg-accent' : ''}`}
                  >
                    <span className="truncate">{t('all')}</span>
                    <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
                      {isSelected && (
                        <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                  </button>
                    );
                  })()}
                  {uniqueOutcomes.map(out => (
                    (() => {
                      const isSelected = filterOutcomes.includes(String(out));
                      return (
                    <button
                      key={out}
                      onClick={() => toggleMultiFilter(setFilterOutcomes, out)}
                      className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? 'bg-accent' : ''}`}
                    >
                      <span className="truncate">{tradeOutcomeDisplay(out)}</span>
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
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center">{t('timeframe')}</span>
            <div className="relative" ref={timeframeDropdownRef}>
              <button
                onClick={() => setTimeframeDropdownOpen(!timeframeDropdownOpen)}
                className="relative h-10 w-full px-3 rounded-lg border border-border bg-card text-sm flex items-center justify-center hover:bg-muted/40"
              >
                <span className="truncate text-center w-full pr-5">{selectedTimeframesLabel || t('all')}</span>
                <ChevronDown className="absolute right-3 w-4 h-4 opacity-50" />
              </button>
              {timeframeDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 w-full rounded-md border bg-popover p-1 shadow-md max-h-64 overflow-y-auto">
                  {(() => {
                    const isSelected = filterTimeframes.includes('all');
                    return (
                  <button
                    onClick={() => toggleMultiFilter(setFilterTimeframes, 'all')}
                    className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? 'bg-accent' : ''}`}
                  >
                    <span className="truncate">{t('all')}</span>
                    <span className={`ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[3px] ${isSelected ? 'border-primary bg-primary' : 'border-border bg-background'}`}>
                      {isSelected && (
                        <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                  </button>
                    );
                  })()}
                  {uniqueTimeframes.map(tf => (
                    (() => {
                      const isSelected = filterTimeframes.includes(String(tf));
                      return (
                    <button
                      key={tf}
                      onClick={() => toggleMultiFilter(setFilterTimeframes, tf)}
                      className={`w-full px-3 py-2 text-sm rounded hover:bg-accent flex items-center justify-between ${isSelected ? 'bg-accent' : ''}`}
                    >
                      <span className="truncate">{tf}</span>
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
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center opacity-0">{t('reset')}</span>
            <Button
              variant="outline"
              className="h-10 w-full border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400"
              onClick={() => {
                setFilterSymbols(["all"]);
                setFilterStrategies(["all"]);
                setFilterDirections(["all"]);
                setFilterOutcomes(["all"]);
                setFilterTimeframes(["all"]);
                setSelectedAccounts(["all"]);
                setSelectedSymbol(null);
                setSelectedStrategy(null);
              }}
            >
              {t('reset')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{t('wins')}</p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{outcomeCounts.wins}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {outcomeTotal ? `${((outcomeCounts.wins / outcomeTotal) * 100).toFixed(0)}%` : '0%'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">BE</p>
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">{outcomeCounts.breakeven}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {outcomeTotal ? `${((outcomeCounts.breakeven / outcomeTotal) * 100).toFixed(0)}%` : '0%'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">{t('losses')}</p>
              <p className="text-3xl font-bold text-rose-600 dark:text-rose-400 mt-1">{outcomeCounts.losses}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {outcomeTotal ? `${((outcomeCounts.losses / outcomeTotal) * 100).toFixed(0)}%` : '0%'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex w-full h-auto flex-wrap gap-1 p-1 bg-muted/40 md:flex-nowrap md:overflow-x-auto">
            <TabsTrigger value="overview" className="flex-1 min-w-[5.5rem] text-[11px] sm:text-sm">{t('overview')}</TabsTrigger>
            <TabsTrigger value="symbols" className="flex-1 min-w-[5.5rem] text-[11px] sm:text-sm">{t('symbols')}</TabsTrigger>
            <TabsTrigger value="strategies" className="flex-1 min-w-[5.5rem] text-[11px] sm:text-sm">{t('strategiesAnalytics')}</TabsTrigger>
            <TabsTrigger value="accounts" className="flex-1 min-w-[5.5rem] text-[11px] sm:text-sm">{t('accountsAnalytics')}</TabsTrigger>
            <TabsTrigger value="time" className="flex-1 min-w-[5.5rem] text-[11px] sm:text-sm">{t('timeTab')}</TabsTrigger>
            <TabsTrigger value="psychology" className="flex-1 min-w-[5.5rem] text-[11px] sm:text-sm">{t('psychology')}</TabsTrigger>
            <TabsTrigger value="confluences" className="flex-1 min-w-[5.5rem] text-[11px] sm:text-sm">{t('entryConditionsTab')}</TabsTrigger>
            <TabsTrigger value="mistakes" className="flex-1 min-w-[5.5rem] text-[11px] sm:text-sm">{t('mistakesTab')}</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Outcome + Direction Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('outcomeDistribution')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 overflow-hidden p-4">
                  <div className="grid grid-cols-3 gap-3">
                    {outcomeChartData.map((entry) => (
                      <div
                        key={entry.name}
                        className="rounded-lg border border-border bg-muted/30 p-3"
                      >
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{entry.name}</p>
                        <p className="text-2xl font-semibold text-foreground">{entry.count}</p>
                        <p className="text-xs text-muted-foreground">{entry.rate.toFixed(0)}%</p>
                      </div>
                    ))}
                  </div>

                  <div className="w-full overflow-hidden px-4 py-2">
                    <ResponsiveContainer width="96%" height={320}>
                      <ComposedChart data={outcomeChartData} margin={{ top: 50, right: 50, left: 30, bottom: 70 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                        <XAxis dataKey="name" stroke={CHART.axis} />
                        <YAxis yAxisId="left" stroke={CHART.axis} allowDecimals={false} width={60} domain={[0, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax * 1.1) : 100]} />
                        <YAxis yAxisId="right" orientation="right" stroke={CHART.axis} tickFormatter={(value) => `${value}%`} width={70} domain={[0, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax * 1.1) : 100]} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: '#f1f5f9' }}
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
                        <Line type="monotone" dataKey="rate" yAxisId="right" stroke={CHART.line} strokeWidth={2} dot={{ r: 4, fill: CHART.line }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    {outcomeTop
                      ? `${t('insightOutcomeMost')} ${outcomeTop.name}`
                      : t('insightOutcomeEmpty')}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('directionDistribution')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 overflow-hidden p-4">
                  <div className="grid grid-cols-2 gap-3">
                    {directionEdgeData.map((entry) => (
                      <div
                        key={entry.direction}
                        className="rounded-lg border border-border bg-muted/30 p-3"
                      >
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{entry.direction}</p>
                        <p className="text-2xl font-semibold text-foreground">
                          {entry.netPL >= 0 ? '+' : ''}{entry.netPL.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('winRate')}: {entry.winRate}%
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="w-full overflow-hidden px-4 py-2">
                    <ResponsiveContainer width="96%" height={320}>
                      <BarChart data={directionEdgeData} layout="vertical" margin={{ top: 50, right: 60, left: 90, bottom: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                        <XAxis type="number" stroke={CHART.axis} domain={[(dataMin) => !isNaN(dataMin) && isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.1)) : -10, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.1)) : 10]} />
                        <YAxis type="category" dataKey="direction" stroke={CHART.axis} width={80} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: '#f1f5f9' }}
                          formatter={(value) => [Number(value).toFixed(2), t('netPL')]}
                        />
                        <Bar dataKey="netPL" radius={[0, 10, 10, 0]}>
                          {directionEdgeData.map((entry) => (
                            <Cell key={entry.direction} fill={entry.netPL >= 0 ? '#22c55e' : '#f43f5e'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    {directionTop
                      ? `${t('insightDirectionBest')} ${directionTop.direction} · ${directionTop.winRate}% ${t('winRate')}`
                      : t('insightDirectionEmpty')}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Equity Curve */}
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  {t('equityCurve')}
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden p-4">
                <div className="w-full overflow-hidden px-4 py-2">
                  <ResponsiveContainer width="96%" height={450}>
                    <AreaChart data={equityCurve} margin={{ top: 50, right: 50, left: 30, bottom: 80 }}>
                      <defs>
                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART.line} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={CHART.line} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                      <XAxis dataKey="trade" stroke={CHART.axis} tickMargin={10} height={65} />
                      <YAxis stroke={CHART.axis} width={75} domain={[(dataMin) => Math.floor(dataMin - Math.abs(dataMin * 0.1)), (dataMax) => Math.ceil(dataMax + Math.abs(dataMax * 0.1))]} />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                        labelStyle={{ color: '#f1f5f9' }}
                      />
                      <Area type="monotone" dataKey="equity" stroke={CHART.line} strokeWidth={2} fillOpacity={1} fill="url(#colorEquity)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

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
              <CardContent className="overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('bestPeriod')}</p>
                    <p className="text-sm font-semibold text-foreground">
                      {bestPeriod ? bestPeriod.period : '--'}
                    </p>
                    <p className={`text-xs ${bestPeriod && Number(bestPeriod.pl) >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {bestPeriod ? `${bestPeriod.pl >= 0 ? '+' : ''}${bestPeriod.pl.toFixed(2)}` : '--'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('maxWinRate')}</p>
                    <p className="text-sm font-semibold text-foreground">
                      {bestWinRatePeriod ? `${bestWinRatePeriod.winRate}%` : '--'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {bestWinRatePeriod ? bestWinRatePeriod.period : '--'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('totalPeriods')}</p>
                    <p className="text-sm font-semibold text-foreground">{periodData.length}</p>
                    <p className="text-xs text-muted-foreground">{t('results')}</p>
                  </div>
                </div>
                <div className="w-full overflow-hidden px-6 py-2 pb-4">
                  <ResponsiveContainer width="96%" height={400}>
                    <BarChart data={periodData} margin={{ top: 50, right: 50, left: 30, bottom: timePeriod === "weekly" ? 120 : 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                      <XAxis dataKey="period" stroke={CHART.axis} angle={timePeriod === "weekly" ? -45 : 0} textAnchor={timePeriod === "weekly" ? "end" : "middle"} height={timePeriod === "weekly" ? 105 : 55} tickMargin={10} />
                      <YAxis stroke={CHART.axis} width={75} domain={[(dataMin) => !isNaN(dataMin) && isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.1)) : -10, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.1)) : 10]} />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                        labelStyle={{ color: '#f1f5f9' }}
                      />
                      <Bar dataKey="pl" fill={CHART.line} name="P&L" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Direction & Timeframe */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('longVsShort')}</CardTitle>
                </CardHeader>
                <CardContent className="overflow-hidden p-4">
                  <div className="w-full overflow-hidden px-4 py-2">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={directionData} margin={{ top: 30, right: 35, left: 20, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                        <XAxis dataKey="direction" stroke={CHART.axis} />
                        <YAxis stroke={CHART.axis} width={60} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: '#f1f5f9' }}
                        />
                        <Legend />
                        <Bar dataKey="winRate" name={`${t('winRate')} (%)`} radius={[8, 8, 0, 0]}>
                          {directionData.map((entry) => (
                            <Cell key={entry.direction} fill={directionChartColor(entry.direction)} />
                          ))}
                        </Bar>
                        <Bar dataKey="avgPL" fill={CHART.warning} name={t('avgPLLabel')} radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('timeframeAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent className="overflow-hidden p-4">
                  <div className="w-full overflow-hidden px-4 py-2">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={timeframeData} margin={{ top: 30, right: 35, left: 20, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                        <XAxis dataKey="timeframe" stroke={CHART.axis} />
                        <YAxis stroke={CHART.axis} width={60} domain={[0, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax * 1.1) : 100]} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: '#f1f5f9' }}
                        />
                        <Legend />
                        <Bar dataKey="winRate" fill={CHART.muted} name={`${t('winRate')} (%)`} radius={[8, 8, 0, 0]} />
                        <Bar dataKey="trades" fill={CHART.warning} name={t('noOfTrades')} radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Session Analysis */}
            {sessionData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('sessionsAnalysis')}</CardTitle>
                </CardHeader>
                <CardContent className="overflow-hidden p-4">
                  <div className="w-full overflow-hidden px-4 py-2">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={sessionData} margin={{ top: 30, right: 35, left: 20, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                        <XAxis dataKey="session" stroke={CHART.axis} />
                        <YAxis yAxisId="left" stroke={CHART.axis} width={60} domain={[0, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax * 1.1) : 100]} />
                        <YAxis yAxisId="right" orientation="right" stroke={CHART.axis} width={60} domain={[(dataMin) => !isNaN(dataMin) && isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.2)) : -10, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.2)) : 10]} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: '#f1f5f9' }}
                        />
                        <Legend />
                        <Bar dataKey="winRate" yAxisId="left" fill={CHART.line} name={`${t('winRate')} (%)`} radius={[8, 8, 0, 0]} />
                        <Bar dataKey="avgPL" yAxisId="right" fill={CHART.muted} name={t('avgPLLabel')} radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Symbols Tab */}
          <TabsContent value="symbols" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('top10Symbols')}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden p-4">
                <div className="w-full overflow-hidden px-4 py-2">
                  <ResponsiveContainer width="100%" height={450}>
                    <BarChart data={symbolData} layout="vertical" margin={{ top: 30, right: 35, left: 95, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                        <XAxis xAxisId="bottom" type="number" stroke={CHART.axis} domain={[(dataMin) => !isNaN(dataMin) && isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.2)) : -10, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.2)) : 10]} />
                        <XAxis xAxisId="top" orientation="top" type="number" stroke={CHART.axis} domain={[0, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax * 1.1) : 100]} />
                        <YAxis dataKey="symbol" type="category" stroke={CHART.axis} width={90} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: '#f1f5f9' }}
                        />
                        <Legend />
                        <Bar dataKey="totalPL" xAxisId="bottom" fill={CHART.profit} name={t('totalPLLabel')} radius={[0, 8, 8, 0]} />
                        <Bar dataKey="winRate" xAxisId="top" fill={CHART.line} name={`${t('winRate')} (%)`} radius={[0, 8, 8, 0]} />
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
                    selectedSymbol === symbol.symbol ? 'border-primary ring-1 ring-primary/40' : 'border-border'
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
                      <span className={`font-bold ${symbol.avgPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {symbol.avgPL > 0 ? '+' : ''}{symbol.avgPL.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{t('totalPLLabel')}:</span>
                      <span className={`font-bold ${symbol.totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                      if (trade.outcome === "Loss") accountBreakdown[accountName].losses++;
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
                      if (trade.outcome === "Loss") strategyBreakdown[strategyName].losses++;
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
                      if (trade.outcome === "Loss") directionBreakdown[direction].losses++;
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
                      if (trade.outcome === "Loss") timeframeBreakdown[trade.timeframe].losses++;
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
                                  <div key={item.name} className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                                    <div>
                                      <p className="font-semibold text-sm text-foreground">{item.name}</p>
                                      <p className="text-xs text-slate-600">{item.trades} transakcji</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-sm text-foreground">{item.winRate}%</p>
                                      <p className={`text-xs font-semibold ${item.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                                  <div key={item.name} className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                                    <div>
                                      <p className="font-semibold text-sm text-foreground">{item.name}</p>
                                      <p className="text-xs text-muted-foreground">{item.trades} transakcji</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-sm text-foreground">{item.winRate}%</p>
                                      <p className={`text-xs font-semibold ${item.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                                    <XAxis dataKey="direction" stroke={CHART.axis} />
                                    <YAxis stroke={CHART.axis} width={50} domain={[0, (dataMax) => Math.ceil(dataMax * 1.1)]} />
                                    <Tooltip
                                      contentStyle={chartTooltipStyle}
                                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                                      labelStyle={{ color: '#f1f5f9' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="winRate" name={`${t('winRate')} (%)`} radius={[8, 8, 0, 0]}>
                                      {directionBreakdownData.map((entry) => (
                                        <Cell key={entry.direction} fill={directionChartColor(entry.direction)} />
                                      ))}
                                    </Bar>
                                    <Bar dataKey="trades" fill={CHART.muted} name={t('noOfTrades')} radius={[8, 8, 0, 0]} />
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
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                                    <XAxis dataKey="timeframe" stroke={CHART.axis} />
                                    <YAxis stroke={CHART.axis} width={50} domain={[0, (dataMax) => Math.ceil(dataMax * 1.1)]} />
                                    <Tooltip
                                      contentStyle={chartTooltipStyle}
                                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                                      labelStyle={{ color: '#f1f5f9' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="winRate" fill={CHART.muted} name={`${t('winRate')} (%)`} radius={[8, 8, 0, 0]} />
                                    <Bar dataKey="trades" fill={CHART.warning} name={t('noOfTrades')} radius={[8, 8, 0, 0]} />
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
                                <CardTitle className="text-base text-green-900 flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4" />
                                  {t('bestTradeSingle')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('date')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{bestTrade.date}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('direction')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{normalizeDirection(bestTrade.direction)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('profitLoss')}:</span>
                                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                    {(() => { const pl = getTradeRealizedPL(bestTrade) ?? 0; return `${pl >= 0 ? '+' : ''}${pl.toFixed(2)}`; })()}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('setup')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{bestTrade.setup_quality}</span>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {worstTrade && (getTradeRealizedPL(worstTrade) ?? 0) < 0 && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-base text-red-900 dark:text-red-300 flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  {t('worstTradeSingle')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('date')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{worstTrade.date}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('direction')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{normalizeDirection(worstTrade.direction)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('profitLoss')}:</span>
                                  <span className="text-lg font-bold text-red-600 dark:text-red-400">
                                    {(getTradeRealizedPL(worstTrade) ?? 0).toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('setup')}:</span>
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
            <Card>
              <CardHeader>
                <CardTitle>{t('strategiesComparison')}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden p-4">
                <div className="w-full overflow-hidden px-4 py-2">
                  <ResponsiveContainer width="100%" height={450}>
                    <BarChart data={strategyData} margin={{ top: 30, right: 35, left: 20, bottom: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                      <XAxis dataKey="name" stroke={CHART.axis} angle={-45} textAnchor="end" height={95} />
                      <YAxis yAxisId="left" stroke={CHART.axis} width={60} domain={[0, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax * 1.1) : 100]} />
                      <YAxis yAxisId="right" orientation="right" stroke={CHART.axis} width={60} domain={[(dataMin) => !isNaN(dataMin) && isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.2)) : -10, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.2)) : 10]} />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                        labelStyle={{ color: '#f1f5f9' }}
                      />
                      <Legend />
                      <Bar dataKey="winRate" yAxisId="left" fill={CHART.line} name={`${t('winRate')} (%)`} radius={[8, 8, 0, 0]} />
                      <Bar dataKey="avgPL" yAxisId="right" fill={CHART.profit} name={t('avgPLLabel')} radius={[8, 8, 0, 0]} />
                      <Bar dataKey="trades" yAxisId="left" fill={CHART.muted} name={t('noOfTrades')} radius={[8, 8, 0, 0]} />
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
                    selectedStrategy === strategy.name ? 'border-primary ring-1 ring-primary/40' : 'border-border'
                  }`}
                  onClick={() => setSelectedStrategy(strategy.name)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{strategy.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted/40 rounded-md text-center">
                        <p className="text-2xl font-bold text-foreground">{strategy.winRate}%</p>
                        <p className="text-xs text-muted-foreground">{t('winRate')}</p>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg text-center">
                        <p className={`text-2xl font-bold ${strategy.avgPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {strategy.avgPL > 0 ? '+' : ''}{strategy.avgPL.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">{t('avgPLLabel')}</p>
                        </div>
                        </div>
                        <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm text-muted-foreground">{t('totalPLLabel')}:</span>
                      <span className={`font-bold ${strategy.totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {strategy.totalPL > 0 ? '+' : ''}{strategy.totalPL.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between p-3 bg-muted/30 rounded-lg">
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
                      if (trade.outcome === "Loss") accountBreakdown[accountName].losses++;
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
                      if (trade.outcome === "Loss") symbolBreakdown[trade.symbol].losses++;
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
                      if (trade.outcome === "Loss") directionBreakdown[direction].losses++;
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
                      if (trade.outcome === "Loss") timeframeBreakdown[trade.timeframe].losses++;
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
                                  <div key={item.name} className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                                    <div>
                                      <p className="font-semibold text-sm text-foreground">{item.name}</p>
                                      <p className="text-xs text-slate-600">{item.trades} transakcji</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-sm text-foreground">{item.winRate}%</p>
                                      <p className={`text-xs font-semibold ${item.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                               <div key={item.symbol} className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                                 <div>
                                   <p className="font-semibold text-sm text-foreground">{item.symbol}</p>
                                   <p className="text-xs text-muted-foreground">{item.trades} {t('trades')}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-sm text-foreground">{item.winRate}%</p>
                                      <p className={`text-xs font-semibold ${item.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                                    <XAxis dataKey="direction" stroke={CHART.axis} />
                                    <YAxis stroke={CHART.axis} width={50} domain={[0, (dataMax) => Math.ceil(dataMax * 1.1)]} />
                                    <Tooltip
                                      contentStyle={chartTooltipStyle}
                                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                                      labelStyle={{ color: '#f1f5f9' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="winRate" name={`${t('winRate')} (%)`} radius={[8, 8, 0, 0]}>
                                      {directionBreakdownData.map((entry) => (
                                        <Cell key={entry.direction} fill={directionChartColor(entry.direction)} />
                                      ))}
                                    </Bar>
                                    <Bar dataKey="trades" fill={CHART.muted} name={t('noOfTrades')} radius={[8, 8, 0, 0]} />
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
                                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                                    <XAxis dataKey="timeframe" stroke={CHART.axis} />
                                    <YAxis stroke={CHART.axis} width={50} domain={[0, (dataMax) => Math.ceil(dataMax * 1.1)]} />
                                    <Tooltip
                                      contentStyle={chartTooltipStyle}
                                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                                      labelStyle={{ color: '#f1f5f9' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="winRate" fill={CHART.muted} name={`${t('winRate')} (%)`} radius={[8, 8, 0, 0]} />
                                    <Bar dataKey="trades" fill={CHART.warning} name={t('noOfTrades')} radius={[8, 8, 0, 0]} />
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
                                <CardTitle className="text-base text-green-900 dark:text-green-300 flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4" />
                                  {t('bestTradeSingle')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('date')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{bestTrade.date}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('symbol')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{bestTrade.symbol}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('direction')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{bestTrade.direction}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('profitLoss')}:</span>
                                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                    {(() => { const pl = getTradeRealizedPL(bestTrade) ?? 0; return `${pl >= 0 ? '+' : ''}${pl.toFixed(2)}`; })()}
                                  </span>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {worstTrade && (getTradeRealizedPL(worstTrade) ?? 0) < 0 && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-base text-red-900 dark:text-red-300 flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  {t('worstTradeSingle')}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('date')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{worstTrade.date}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('symbol')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{worstTrade.symbol}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('direction')}:</span>
                                  <span className="text-sm font-semibold dark:text-slate-200">{worstTrade.direction}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-sm text-muted-foreground">{t('profitLoss')}:</span>
                                  <span className="text-lg font-bold text-red-600 dark:text-red-400">
                                    {(getTradeRealizedPL(worstTrade) ?? 0).toFixed(2)}
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
              <Card>
                <CardHeader>
                  <CardTitle>Rozkład typów kont</CardTitle>
                </CardHeader>
                <CardContent className="overflow-hidden p-4">
                  <div className="w-full overflow-hidden">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                        <Pie
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
                          labelStyle={{ color: '#f1f5f9' }}
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
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                        <XAxis dataKey="status" stroke={CHART.axis} />
                        <YAxis stroke={CHART.axis} width={60} domain={[0, (dataMax) => Math.ceil(dataMax * 1.2)]} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: '#f1f5f9' }}
                        />
                        <Bar dataKey="count" fill={CHART.line} radius={[8, 8, 0, 0]} />
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
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                      <XAxis dataKey="name" stroke={CHART.axis} />
                      <YAxis yAxisId="left" stroke={CHART.axis} width={60} domain={[0, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax * 1.1) : 100]} />
                      <YAxis yAxisId="right" orientation="right" stroke={CHART.axis} width={60} domain={[(dataMin) => !isNaN(dataMin) && isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.2)) : -10, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.2)) : 10]} />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                        labelStyle={{ color: '#f1f5f9' }}
                      />
                      <Legend />
                      <Bar dataKey="winRate" yAxisId="left" fill={CHART.line} name="Win Rate (%)" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="roi" yAxisId="right" fill={CHART.profit} name={t('roi')} radius={[8, 8, 0, 0]} />
                      <Bar dataKey="trades" yAxisId="left" fill={CHART.muted} name={t('noOfTrades')} radius={[8, 8, 0, 0]} />
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
                      <div className="p-3 bg-muted/40 rounded-md text-center">
                        <p className="text-xl font-bold text-foreground">{account.winRate}%</p>
                        <p className="text-xs text-muted-foreground">{t('winRate')}</p>
                      </div>
                      <div className="p-3 bg-green-100 dark:bg-green-950 rounded-lg text-center">
                        <p className={`text-xl font-bold ${account.roi >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                          {account.roi > 0 ? '+' : ''}{account.roi.toFixed(2)}%
                        </p>
                        <p className="text-xs text-muted-foreground">{t('roi')}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-100 dark:bg-card rounded-lg">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-muted-foreground">{t('totalPLLabel')}:</span>
                        <span className={`font-bold ${account.totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
          <TabsContent value="time" className="space-y-6">
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
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{t('bestSlot')}</span>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      </div>
                      <p className="mt-2 text-lg font-bold text-emerald-900 dark:text-emerald-200">{bestSlot ? bestSlot.slot : '—'}</p>
                      <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
                        {bestSlot ? `${bestSlot.avgPL >= 0 ? '+' : ''}${bestSlot.avgPL} ${t('avg')} · ${bestSlot.winRate}%` : t('noData')}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-rose-700 dark:text-rose-300">{t('worstSlot')}</span>
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                      </div>
                      <p className="mt-2 text-lg font-bold text-rose-900 dark:text-rose-200">{worstSlot ? worstSlot.slot : '—'}</p>
                      <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
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
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                          <XAxis dataKey="hour" stroke={CHART.axis} />
                          <YAxis yAxisId="left" stroke={CHART.line} width={50} domain={[0, 100]} />
                          <YAxis yAxisId="right" orientation="right" stroke={CHART.profit} width={55} domain={[(dataMin) => !isNaN(dataMin) && isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.2)) : -10, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.2)) : 10]} />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                            labelStyle={{ color: '#f1f5f9' }}
                          />
                          <Legend />
                          <Area yAxisId="right" type="monotone" dataKey="avgPL" name={t('avgPLLabel')} stroke={CHART.profit} strokeWidth={2.5} fill="url(#hourPLGradient)" dot={{ r: 3, fill: CHART.profit }} activeDot={{ r: 5 }} />
                          <Line yAxisId="left" type="monotone" dataKey="winRate" name={`${t('winRate')} (%)`} stroke={CHART.line} strokeWidth={2.5} dot={{ r: 2, fill: CHART.line }} activeDot={{ r: 4 }} />
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
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                          <XAxis type="number" stroke={CHART.axis} />
                          <YAxis type="category" dataKey="slot" stroke={CHART.axis} width={110} tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                            labelStyle={{ color: '#f1f5f9' }}
                          />
                          <Legend />
                          <Bar dataKey="avgPL" name={t('avgPLLabel')} radius={[0, 6, 6, 0]}>
                            {timeSlotData.map((d, i) => (
                              <Cell key={i} fill={d.avgPL >= 0 ? '#22c55e' : '#ef4444'} />
                            ))}
                          </Bar>
                          <Bar dataKey="winRate" name={`${t('winRate')} (%)`} fill={CHART.line} radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground">
                            <th className="text-left py-2 px-2">{t('timeSlot')}</th>
                            <th className="text-right py-2 px-2">{t('trades')}</th>
                            <th className="text-right py-2 px-2">{t('winRate')}</th>
                            <th className="text-right py-2 px-2">{t('avg')}</th>
                            <th className="text-right py-2 px-2">{t('total')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timeSlotData.map((s) => (
                            <tr key={s.slotStart} className="border-b border-slate-100 dark:border-slate-800">
                              <td className="py-1.5 px-2 font-medium text-slate-800 dark:text-slate-200">{s.slot}</td>
                              <td className="py-1.5 px-2 text-right text-muted-foreground">{s.trades}</td>
                              <td className={`py-1.5 px-2 text-right font-semibold ${s.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>{s.winRate}%</td>
                              <td className={`py-1.5 px-2 text-right ${s.avgPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.avgPL >= 0 ? '+' : ''}{s.avgPL}</td>
                              <td className={`py-1.5 px-2 text-right font-semibold ${s.totalPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.totalPL >= 0 ? '+' : ''}{s.totalPL}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="psychology" className="space-y-6">
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
                    <span className="text-xs font-medium text-rose-700 dark:text-rose-300">{t('costliestEmotion')}</span>
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-rose-900 dark:text-rose-200 truncate" title={worstEmotion?.tag}>
                    {worstEmotion && worstEmotion.avgPL < 0 ? worstEmotion.tag : '—'}
                  </p>
                  <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                    {worstEmotion && worstEmotion.avgPL < 0 ? `${worstEmotion.avgPL} ${t('perTrade')}` : t('noData')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{t('bestEmotionLabel')}</span>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-emerald-900 dark:text-emerald-200 truncate" title={bestEmotion?.tag}>
                    {bestEmotion && bestEmotion.avgPL > 0 ? bestEmotion.tag : '—'}
                  </p>
                  <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
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
                            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                            <XAxis type="number" stroke={CHART.axis} />
                            <YAxis type="category" dataKey="tag" stroke={CHART.axis} width={150} tick={{ fontSize: 11 }} />
                            <Tooltip
                              contentStyle={chartTooltipStyle}
                              itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                              labelStyle={{ color: '#f1f5f9' }}
                            />
                            <Legend />
                            <Bar dataKey="avgPL" name={t('avgPLLabel')} radius={[0, 6, 6, 0]}>
                              {emotionPerf.map((e, i) => (
                                <Cell key={i} fill={e.avgPL >= 0 ? '#22c55e' : '#ef4444'} />
                              ))}
                            </Bar>
                            <Bar dataKey="winRate" name={`${t('winRate')} (%)`} fill={CHART.muted} radius={[0, 6, 6, 0]} />
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
                            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                            <XAxis dataKey="stage" stroke={CHART.axis} />
                            <YAxis stroke={CHART.axis} domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} width={40} />
                            <Tooltip
                              contentStyle={chartTooltipStyle}
                              itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                              labelStyle={{ color: '#f1f5f9' }}
                            />
                            <Legend />
                            <Bar dataKey="win" name={t('ratingWin')} fill={CHART.profit} radius={[6, 6, 0, 0]} />
                            <Bar dataKey="breakeven" name={t('ratingBreakeven')} fill={CHART.warning} radius={[6, 6, 0, 0]} />
                            <Bar dataKey="loss" name={t('ratingLoss')} fill={CHART.loss} radius={[6, 6, 0, 0]} />
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
                            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                            <XAxis dataKey="idx" stroke={CHART.axis} />
                            <YAxis stroke={CHART.axis} domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} width={40} />
                            <Tooltip
                              contentStyle={chartTooltipStyle}
                              itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                              labelStyle={{ color: '#f1f5f9' }}
                            />
                            <Area type="monotone" dataKey="rating" name={t('emotionRatingShort')} stroke={CHART.muted} strokeWidth={2} fill="url(#tiltGradient)" />
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
                                <div key={it.tag} className="flex justify-between items-center px-3 py-1.5 bg-muted/30 rounded-lg">
                                  <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{it.tag}</span>
                                  <span className="flex items-center gap-3 shrink-0">
                                    <span className="text-xs text-muted-foreground">×{it.total}</span>
                                    <span className={`text-xs font-semibold ${it.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>{it.winRate}%</span>
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
                    <div className="h-[320px] flex items-center justify-center text-center rounded-lg border border-dashed border-border text-muted-foreground px-6">
                      {t('noConfidenceData')}
                    </div>
                  ) : (
                    <div className="w-full overflow-hidden px-2 py-2">
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={confidenceData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                          <XAxis dataKey="level" stroke={CHART.axis} />
                          <YAxis yAxisId="left" stroke={CHART.axis} width={50} domain={[0, 100]} />
                          <YAxis yAxisId="right" orientation="right" stroke={CHART.axis} width={55} domain={[(dataMin) => !isNaN(dataMin) && isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.2)) : -10, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.2)) : 10]} />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                            labelStyle={{ color: '#f1f5f9' }}
                          />
                          <Legend />
                          <Bar dataKey="winRate" yAxisId="left" fill={CHART.warning} name={`${t('winRate')} (%)`} radius={[8, 8, 0, 0]} />
                          <Bar dataKey="avgPL" yAxisId="right" name={t('avgPLLabel')} radius={[8, 8, 0, 0]}>
                            {confidenceData.map((d, i) => (
                              <Cell key={i} fill={d.avgPL >= 0 ? '#22c55e' : '#ef4444'} />
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
                  <CardTitle className="text-amber-900 dark:text-amber-300 flex items-center justify-between">
                    <span>{t('avgConfidence')}</span>
                    <span className="text-2xl">{hasConfidenceData ? `${avgConfidence}⭐` : '—'}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!hasConfidenceData ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">{t('noConfidenceData')}</p>
                  ) : (
                    confidenceData.filter((d) => d.trades > 0).map((d) => (
                      <div key={d.level} className="flex justify-between items-center px-3 py-2 bg-muted/30 rounded-lg">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{d.level}</span>
                        <span className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground">×{d.trades}</span>
                          <span className={`text-xs font-semibold ${d.winRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>{d.winRate}%</span>
                          <span className={`text-xs font-semibold ${d.avgPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>{d.avgPL >= 0 ? '+' : ''}{d.avgPL}</span>
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
                  <div className="h-[300px] flex items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
                    {t('noData')}
                  </div>
                ) : (
                  <div className="w-full overflow-hidden px-4 py-2">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={setupData} margin={{ top: 30, right: 35, left: 20, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                        <XAxis dataKey="quality" stroke={CHART.axis} />
                        <YAxis yAxisId="left" stroke={CHART.axis} width={60} domain={[0, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax * 1.1) : 100]} />
                        <YAxis yAxisId="right" orientation="right" stroke={CHART.axis} width={60} domain={[(dataMin) => !isNaN(dataMin) && isFinite(dataMin) ? Math.floor(dataMin - Math.abs(dataMin * 0.2)) : -10, (dataMax) => !isNaN(dataMax) && isFinite(dataMax) ? Math.ceil(dataMax + Math.abs(dataMax * 0.2)) : 10]} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: '#f1f5f9' }}
                        />
                        <Legend />
                        <Bar dataKey="winRate" yAxisId="left" fill={CHART.warning} name={`${t('winRate')} (%)`} radius={[8, 8, 0, 0]} />
                        <Bar dataKey="avgPL" yAxisId="right" fill={CHART.profit} name={t('avgPLLabel')} radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="confluences" className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{t('tagCoverage')}</span>
                    <ListChecks className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-200">
                    {confluenceAgg.taggedTrades}<span className="text-base text-emerald-500">/{filteredTrades.length}</span>
                  </p>
                  <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">{confluenceCoverage}% {t('entryConditionsCoverageDesc')}</p>
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
                    <span className="text-xs font-medium text-rose-700 dark:text-rose-300">{t('weakestCondition')}</span>
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-rose-900 dark:text-rose-200 truncate" title={worstConfluence?.tag}>
                    {worstConfluence && worstConfluence.avgPL < 0 ? worstConfluence.tag : "—"}
                  </p>
                  <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                    {worstConfluence && worstConfluence.avgPL < 0 ? `${worstConfluence.avgPL} ${t('perTrade')}` : t('noData')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{t('strongestCondition')}</span>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-emerald-900 dark:text-emerald-200 truncate" title={bestConfluence?.tag}>
                    {bestConfluence && bestConfluence.avgPL > 0 ? bestConfluence.tag : "—"}
                  </p>
                  <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
                    {bestConfluence && bestConfluence.avgPL > 0 ? `+${bestConfluence.avgPL} ${t('perTrade')}` : t('noData')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {confluencePerf.length === 0 ? (
              <Card>
                <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-3">
                  <ListChecks className="w-10 h-10 text-emerald-400" />
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
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                        <XAxis type="number" stroke={CHART.axis} />
                        <YAxis type="category" dataKey="tag" stroke={CHART.axis} width={140} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: "#f1f5f9" }}
                        />
                        <Legend />
                        <Bar dataKey="avgPL" name={t("avgPLLabel")} radius={[0, 6, 6, 0]}>
                          {confluencePerf.map((e, i) => (
                            <Cell key={i} fill={e.avgPL >= 0 ? CHART.profit : CHART.loss} />
                          ))}
                        </Bar>
                        <Bar dataKey="winRate" name={`${t("winRate")} (%)`} fill={CHART.profit} radius={[0, 6, 6, 0]} />
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
                        <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                          <th className="text-left py-2 px-3 font-medium">{t('entryConditionsTab')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('trades')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('winRate')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('avg')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('total')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {confluenceByFreq.map((row) => (
                          <tr key={row.tag} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-2 px-3 font-medium truncate max-w-[160px]" title={row.tag}>{row.tag}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{row.trades}</td>
                            <td className={`py-2 px-3 text-right font-semibold tabular-nums ${row.winRate >= 50 ? "text-green-600" : "text-red-600"}`}>{row.winRate}%</td>
                            <td className={`py-2 px-3 text-right tabular-nums ${row.avgPL >= 0 ? "text-green-600" : "text-red-600"}`}>{row.avgPL >= 0 ? "+" : ""}{row.avgPL}</td>
                            <td className={`py-2 px-3 text-right font-semibold tabular-nums ${row.totalPL >= 0 ? "text-green-600" : "text-red-600"}`}>{row.totalPL >= 0 ? "+" : ""}{row.totalPL}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="mistakes" className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-rose-700 dark:text-rose-300">{t('tagCoverage')}</span>
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-rose-900 dark:text-rose-200">
                    {mistakeAgg.taggedTrades}<span className="text-base text-rose-500">/{filteredTrades.length}</span>
                  </p>
                  <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">{mistakeCoverage}% {t('mistakesCoverageDesc')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{t('mostFrequentMistake')}</span>
                    <Activity className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-amber-900 dark:text-amber-200 truncate" title={mistakeByFreq[0]?.tag}>
                    {mistakeByFreq[0]?.tag || "—"}
                  </p>
                  <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80">
                    {mistakeByFreq[0] ? `${mistakeByFreq[0].trades}×` : t('noData')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-rose-700 dark:text-rose-300">{t('costliestMistake')}</span>
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-rose-900 dark:text-rose-200 truncate" title={costliestMistake?.tag}>
                    {costliestMistake && costliestMistake.avgPL < 0 ? costliestMistake.tag : "—"}
                  </p>
                  <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                    {costliestMistake && costliestMistake.avgPL < 0
                      ? `${costliestMistake.avgPL} ${t('perTrade')} · Σ ${costliestMistake.totalPL}`
                      : t('noData')}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t('leastHarmfulMistake')}</span>
                    <TrendingUp className="w-4 h-4 text-slate-500" />
                  </div>
                  <p className="mt-2 text-lg font-bold text-foreground truncate" title={bestMistakeAvoid?.tag}>
                    {bestMistakeAvoid?.tag || "—"}
                  </p>
                  <p className="text-[11px] text-slate-600/80 dark:text-slate-400/80">
                    {bestMistakeAvoid ? `${bestMistakeAvoid.avgPL >= 0 ? "+" : ""}${bestMistakeAvoid.avgPL} ${t('perTrade')}` : t('noData')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {mistakePerf.length === 0 ? (
              <Card>
                <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-3">
                  <AlertTriangle className="w-10 h-10 text-rose-400" />
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
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                        <XAxis type="number" stroke={CHART.axis} />
                        <YAxis type="category" dataKey="tag" stroke={CHART.axis} width={140} tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                          labelStyle={{ color: "#f1f5f9" }}
                        />
                        <Legend />
                        <Bar dataKey="avgPL" name={t("avgPLLabel")} radius={[0, 6, 6, 0]}>
                          {mistakePerf.map((e, i) => (
                            <Cell key={i} fill={e.avgPL >= 0 ? CHART.profit : CHART.loss} />
                          ))}
                        </Bar>
                        <Bar dataKey="winRate" name={`${t("winRate")} (%)`} fill={CHART.loss} radius={[0, 6, 6, 0]} />
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
                        <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                          <th className="text-left py-2 px-3 font-medium">{t('mistakesTab')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('trades')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('winRate')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('avg')}</th>
                          <th className="text-right py-2 px-3 font-medium">{t('total')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mistakeByFreq.map((row) => (
                          <tr key={row.tag} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-2 px-3 font-medium truncate max-w-[160px]" title={row.tag}>{row.tag}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{row.trades}</td>
                            <td className={`py-2 px-3 text-right font-semibold tabular-nums ${row.winRate >= 50 ? "text-green-600" : "text-red-600"}`}>{row.winRate}%</td>
                            <td className={`py-2 px-3 text-right tabular-nums ${row.avgPL >= 0 ? "text-green-600" : "text-red-600"}`}>{row.avgPL >= 0 ? "+" : ""}{row.avgPL}</td>
                            <td className={`py-2 px-3 text-right font-semibold tabular-nums ${row.totalPL >= 0 ? "text-green-600" : "text-red-600"}`}>{row.totalPL >= 0 ? "+" : ""}{row.totalPL}</td>
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