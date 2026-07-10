import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  getBacktestEntries,
  createBacktestEntry,
  updateBacktestEntry,
  deleteBacktestEntry,
  getBacktestStrategies,
  createBacktestStrategy,
  updateBacktestStrategy,
  deleteBacktestStrategy,
  getBacktestStrategyPage,
  saveBacktestStrategyPage,
  uploadUserFile,
} from "@/lib/localStorage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  FlaskConical,
  Plus,
  Pencil,
  Trash2,
  ImageIcon,
  TrendingUp,
  TrendingDown,
  BarChart3,
  CheckCircle2,
  Circle,
  FileText,
  Layers,
  ChevronDown,
  Target,
  Trophy,
  Brain,
  Star,
  ListChecks,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { useLanguage } from "@/components/LanguageProvider";
import { formatTradeDate, getDateFormat } from "@/lib/userSettings";
import { toast } from "sonner";
import ImageViewer from "@/components/common/ImageViewer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { EmotionsInlinePanel, createEmptyEmotions, normalizeEmotions, countFilledEmotionStages } from "@/components/EmotionsPanel";

const OUTCOMES = ["Win", "Loss", "Breakeven"];
const DIRECTIONS = ["Long", "Short"];
const SESSIONS = ["Asia", "London", "New York", "Other"];
const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1"];
const COMMON_PAIRS = [
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "USDCAD", "AUDUSD", "NZDUSD",
  "EURJPY", "GBPJPY", "EURGBP", "XAUUSD", "XAGUSD",
  "US30", "NAS100", "SPX500", "GER40", "UK100",
  "BTCUSD", "ETHUSD", "WTI",
];

const WEEKDAYS = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"];

// Confluencje (setup) — SMC/ICT + klasyka. Wielokrotny wybor.
const CONFLUENCES = [
  "Sweep płynności", "FVG", "Order Block", "Breaker", "BOS", "CHoCH",
  "Premium/Discount", "Imbalance", "Trendline", "Wsparcie/Opór",
  "Fibo", "Sesja killzone", "News uniknięty", "HTF zgodny",
];

// Kategorie bledow — analiza procesu. Wielokrotny wybor.
const MISTAKES = [
  "FOMO", "Overtrading", "Przesunięty SL", "Za wczesne wyjście",
  "Brak potwierdzenia", "Revenge trade", "Za duża pozycja",
  "Wejście pod news", "Złamany plan", "Brak SL", "Late entry",
];

const pieColors = {
  Win: "hsl(var(--chart-2))",
  Loss: "hsl(var(--chart-5))",
  Breakeven: "hsl(var(--muted-foreground))",
};

function toNumberSafe(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default function Backtesting() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dateFmt = getDateFormat();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [viewerUrl, setViewerUrl] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [strategyTab, setStrategyTab] = useState("all");
  const [strategyPageDraft, setStrategyPageDraft] = useState("");
  const [detailRow, setDetailRow] = useState(null);
  const [strategyDialogOpen, setStrategyDialogOpen] = useState(false);
  const [editingStrategyId, setEditingStrategyId] = useState(null);
  const [deleteStrategyId, setDeleteStrategyId] = useState(null);
  const [strategyForm, setStrategyForm] = useState({ name: "", description: "" });
  const [analizaOpen, setAnalizaOpen] = useState(false);

  const emptyForm = () => ({
    date: new Date().toISOString().slice(0, 10),
    symbol: "",
    direction: "Long",
    session: "",
    timeframe: "",
    strategy_id: "",
    outcome: "Win",
    entry_price: "",
    stop_loss: "",
    take_profit: "",
    exit_price: "",
    risk_reward: "",
    r_multiple: "",
    amount: "",
    tags: "",
    notes: "",
    screenshot_url: "",
    entry_confirmation: false,
    confluences: [],
    mistakes: [],
    grade: 0,
    emotions: createEmptyEmotions(),
  });

  const [form, setForm] = useState(emptyForm);
  const [filePending, setFilePending] = useState(null);
  const [emotionsOpen, setEmotionsOpen] = useState(false);
  const [detailEmotionsOpen, setDetailEmotionsOpen] = useState(false);

  useEffect(() => {
    if (detailRow) {
      setDetailEmotionsOpen(countFilledEmotionStages(detailRow.emotions) > 0);
    }
  }, [detailRow]);

  const toggleInArray = (field, value) =>
    setForm((f) => {
      const arr = Array.isArray(f[field]) ? f[field] : [];
      return {
        ...f,
        [field]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value],
      };
    });

  // Planowany RR liczony na zywo z entry/SL/TP (informacyjnie w formularzu)
  const plannedRR = useMemo(() => {
    const entry = toNumberSafe(form.entry_price);
    const sl = toNumberSafe(form.stop_loss);
    const tp = toNumberSafe(form.take_profit);
    if (entry === null || sl === null || tp === null) return null;
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    if (risk === 0) return null;
    return reward / risk;
  }, [form.entry_price, form.stop_loss, form.take_profit]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["backtest-entries", user?.id],
    queryFn: () => getBacktestEntries(user?.id),
    enabled: !!user?.id,
  });

  const { data: btStrategies = [] } = useQuery({
    queryKey: ["backtest-strategies", user?.id],
    queryFn: () => getBacktestStrategies(user?.id),
    enabled: !!user?.id,
  });

  const strategyName = (id) => {
    const s = btStrategies.find((x) => String(x.id) === String(id));
    return s?.name || "—";
  };

  const strategyDescriptionLookup = (id) => {
    const s = btStrategies.find((x) => String(x.id) === String(id));
    return s?.description || "";
  };

  const filteredEntries = useMemo(() => {
    if (strategyTab === "all") return entries;
    return entries.filter((e) => String(e.strategy_id) === String(strategyTab));
  }, [entries, strategyTab]);

  const { data: strategyPageDoc } = useQuery({
    queryKey: ["backtest-strategy-page", user?.id, strategyTab],
    queryFn: () => getBacktestStrategyPage(user?.id, strategyTab),
    enabled: !!user?.id && strategyTab !== "all",
  });

  useEffect(() => {
    if (strategyTab === "all") {
      setStrategyPageDraft("");
      return;
    }
    setStrategyPageDraft(
      typeof strategyPageDoc?.content === "string" ? strategyPageDoc.content : ""
    );
  }, [strategyTab, strategyPageDoc]);

  const saveStrategyPageMutation = useMutation({
    mutationFn: () => saveBacktestStrategyPage(user.id, strategyTab, { content: strategyPageDraft }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backtest-strategy-page", user?.id, strategyTab] });
      toast.success(t("backtestStrategyPageSaved"));
    },
    onError: (err) => toast.error(err?.message || t("backtestStrategyPageError")),
  });

  const stats = useMemo(() => {
    const list = [...filteredEntries];
    let wins = 0;
    let losses = 0;
    let be = 0;
    let sumR = 0;
    let rCount = 0;
    let sumAmount = 0;
    let amountCount = 0;
    list.forEach((e) => {
      if (e.outcome === "Win") wins += 1;
      else if (e.outcome === "Loss") losses += 1;
      else be += 1;
      const r = toNumberSafe(e.r_multiple);
      if (r !== null) {
        sumR += r;
        rCount += 1;
      }
      const a = toNumberSafe(e.amount);
      if (a !== null) {
        sumAmount += a;
        amountCount += 1;
      }
    });
    const decided = wins + losses;
    const winRate = decided > 0 ? (wins / decided) * 100 : 0;
    const avgR = rCount > 0 ? sumR / rCount : 0;

    // Profit factor liczony z R-multiple (zysk R / strata R)
    let grossWinR = 0;
    let grossLossR = 0;
    list.forEach((e) => {
      const r = toNumberSafe(e.r_multiple);
      if (r === null) return;
      if (r > 0) grossWinR += r;
      else if (r < 0) grossLossR += Math.abs(r);
    });
    const pfNumeric = grossLossR > 0 ? grossWinR / grossLossR : grossWinR > 0 ? Infinity : 0;
    const profitFactor = pfNumeric === Infinity ? "∞" : pfNumeric.toFixed(2);

    return {
      wins,
      losses,
      be,
      total: list.length,
      winRate,
      avgR,
      sumR,
      sumAmount,
      amountCount,
      pfNumeric,
      profitFactor,
    };
  }, [filteredEntries]);

  // Wskazniki kolowe (gauge) jak na Dashboardzie
  const winRateGauge = Math.max(0, Math.min(100, Math.round(stats.winRate)));
  const pfGauge = stats.pfNumeric === Infinity
    ? 100
    : Math.max(0, Math.min(100, Math.round((stats.pfNumeric / 3) * 100)));

  // Porownanie strategii (na wszystkich wpisach) — do sekcji Analiza
  const strategyComparison = useMemo(() => {
    const map = new Map();
    const ensure = (id, name) => {
      const key = id ? String(id) : "none";
      if (!map.has(key)) {
        map.set(key, { id: key, name, tests: 0, wins: 0, losses: 0, sumR: 0, sumAmount: 0 });
      }
      return map.get(key);
    };
    entries.forEach((e) => {
      const name = e.strategy_name || strategyName(e.strategy_id) || "—";
      const row = ensure(e.strategy_id, name);
      row.tests += 1;
      if (e.outcome === "Win") row.wins += 1;
      else if (e.outcome === "Loss") row.losses += 1;
      const r = toNumberSafe(e.r_multiple);
      if (r !== null) row.sumR += r;
      const a = toNumberSafe(e.amount);
      if (a !== null) row.sumAmount += a;
    });
    return Array.from(map.values())
      .map((row) => {
        const decided = row.wins + row.losses;
        return {
          ...row,
          winRate: decided > 0 ? (row.wins / decided) * 100 : 0,
          avgR: row.tests > 0 ? row.sumR / row.tests : 0,
        };
      })
      .sort((a, b) => b.sumR - a.sumR);
  }, [entries, btStrategies]);

  // Rozklad R-multiple (histogram) — do sekcji Analiza
  const rDistribution = useMemo(() => {
    const buckets = [
      { label: "≤ -2R", min: -Infinity, max: -2, count: 0 },
      { label: "-2…-1R", min: -2, max: -1, count: 0 },
      { label: "-1…0R", min: -1, max: 0, count: 0 },
      { label: "0…1R", min: 0, max: 1, count: 0 },
      { label: "1…2R", min: 1, max: 2, count: 0 },
      { label: "> 2R", min: 2, max: Infinity, count: 0 },
    ];
    filteredEntries.forEach((e) => {
      const r = toNumberSafe(e.r_multiple);
      if (r === null) return;
      const bucket = buckets.find((b) => r > b.min && r <= b.max) || (r <= -2 ? buckets[0] : null);
      if (bucket) bucket.count += 1;
    });
    return buckets;
  }, [filteredEntries]);

  // Najlepszy / najgorszy test wg R — do sekcji Analiza
  const bestWorstByR = useMemo(() => {
    let best = null;
    let worst = null;
    filteredEntries.forEach((e) => {
      const r = toNumberSafe(e.r_multiple);
      if (r === null) return;
      if (best === null || r > toNumberSafe(best.r_multiple)) best = e;
      if (worst === null || r < toNumberSafe(worst.r_multiple)) worst = e;
    });
    return { best, worst };
  }, [filteredEntries]);

  // Expectancy = sredni R na test (oczekiwana wartosc)
  const expectancy = stats.total ? stats.sumR / stats.total : 0;

  // Breakdowny do sekcji Analiza (kierunek / sesja / para / dzien tygodnia)
  const breakdowns = useMemo(() => {
    const make = (keyFn, fallback, limit) => {
      const map = new Map();
      filteredEntries.forEach((e) => {
        const key = keyFn(e) || fallback;
        if (!map.has(key)) map.set(key, { key, tests: 0, wins: 0, losses: 0, sumR: 0 });
        const row = map.get(key);
        row.tests += 1;
        if (e.outcome === "Win") row.wins += 1;
        else if (e.outcome === "Loss") row.losses += 1;
        const r = toNumberSafe(e.r_multiple);
        if (r !== null) row.sumR += r;
      });
      const arr = Array.from(map.values())
        .map((r) => ({ ...r, winRate: r.wins + r.losses > 0 ? (r.wins / (r.wins + r.losses)) * 100 : 0 }))
        .sort((a, b) => b.sumR - a.sumR);
      return limit ? arr.slice(0, limit) : arr;
    };
    return {
      direction: make((e) => e.direction, "—"),
      session: make((e) => e.session, "Brak"),
      pair: make((e) => e.symbol, "—", 8),
      weekday: make((e) => (e.date ? WEEKDAYS[(new Date(e.date).getDay() + 6) % 7] : "—"), "—"),
    };
  }, [filteredEntries]);

  // Skutecznosc wg confluencji oraz czestotliwosc bledow (analiza procesu)
  const tagStats = useMemo(() => {
    const aggregate = (field) => {
      const map = new Map();
      filteredEntries.forEach((e) => {
        const list = Array.isArray(e[field]) ? e[field] : [];
        const r = toNumberSafe(e.r_multiple);
        list.forEach((tag) => {
          if (!map.has(tag)) map.set(tag, { key: tag, tests: 0, wins: 0, losses: 0, sumR: 0 });
          const row = map.get(tag);
          row.tests += 1;
          if (e.outcome === "Win") row.wins += 1;
          else if (e.outcome === "Loss") row.losses += 1;
          if (r !== null) row.sumR += r;
        });
      });
      return Array.from(map.values())
        .map((r) => ({ ...r, winRate: r.wins + r.losses > 0 ? (r.wins / (r.wins + r.losses)) * 100 : 0 }))
        .sort((a, b) => b.tests - a.tests);
    };
    return { confluences: aggregate("confluences"), mistakes: aggregate("mistakes") };
  }, [filteredEntries]);

  const pieData = useMemo(() => {
    const rows = [
      { name: t("backtestOutcomeWin"), value: stats.wins, key: "Win" },
      { name: t("backtestOutcomeLoss"), value: stats.losses, key: "Loss" },
      { name: t("backtestOutcomeBe"), value: stats.be, key: "Breakeven" },
    ].filter((r) => r.value > 0);
    return rows.length ? rows : [{ name: t("backtestNoData"), value: 1, key: "empty" }];
  }, [stats, t]);

  const cumulativeRData = useMemo(() => {
    const sorted = [...filteredEntries].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
    let acc = 0;
    return sorted.map((e) => {
      const r = toNumberSafe(e.r_multiple);
      if (r !== null) acc += r;
      return {
        date: formatTradeDate(e.date, dateFmt),
        r: r ?? 0,
        cumulative: acc,
      };
    });
  }, [filteredEntries, dateFmt]);

  const monthlyData = useMemo(() => {
    const map = {};
    filteredEntries.forEach((e) => {
      const m = e.date ? e.date.slice(0, 7) : "";
      if (!m) return;
      if (!map[m]) map[m] = { month: m, tests: 0 };
      map[m].tests += 1;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredEntries]);

  const cumulativeAmountData = useMemo(() => {
    const sorted = [...filteredEntries].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
    let acc = 0;
    return sorted.map((e) => {
      const a = toNumberSafe(e.amount);
      if (a !== null) acc += a;
      return {
        date: formatTradeDate(e.date, dateFmt),
        amt: a ?? 0,
        cumulative: acc,
      };
    });
  }, [filteredEntries, dateFmt]);

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      let screenshot_url = payload.screenshot_url;
      if (filePending) {
        screenshot_url = await uploadUserFile(user.id, filePending, "backtest");
      }
      const strategy_id = payload.strategy_id || null;
      const bt = btStrategies.find((s) => String(s.id) === String(strategy_id));
      const sn = bt?.name || payload.strategy_name || "";
      const sd = bt?.description ?? payload.strategy_description ?? "";

      // Auto-RR z entry/SL/TP jesli pole RR puste
      const entry = toNumberSafe(payload.entry_price);
      const sl = toNumberSafe(payload.stop_loss);
      const tp = toNumberSafe(payload.take_profit);
      let risk_reward = toNumberSafe(payload.risk_reward);
      if (risk_reward === null && entry !== null && sl !== null && tp !== null) {
        const risk = Math.abs(entry - sl);
        if (risk > 0) risk_reward = Number((Math.abs(tp - entry) / risk).toFixed(2));
      }

      const body = {
        date: payload.date,
        symbol: payload.symbol?.trim().toUpperCase() || "",
        direction: DIRECTIONS.includes(payload.direction) ? payload.direction : "Long",
        session: payload.session || "",
        timeframe: payload.timeframe || "",
        strategy_id,
        strategy_name: sn,
        strategy_description: typeof sd === "string" ? sd : "",
        outcome: payload.outcome,
        entry_price: entry,
        stop_loss: sl,
        take_profit: tp,
        exit_price: toNumberSafe(payload.exit_price),
        risk_reward,
        r_multiple: toNumberSafe(payload.r_multiple),
        amount: toNumberSafe(payload.amount),
        tags: payload.tags?.trim() || "",
        notes: payload.notes?.trim() || "",
        screenshot_url: screenshot_url || "",
        entry_confirmation: !!payload.entry_confirmation,
        confluences: Array.isArray(payload.confluences) ? payload.confluences : [],
        mistakes: Array.isArray(payload.mistakes) ? payload.mistakes : [],
        grade: Number(payload.grade) || 0,
        emotions: normalizeEmotions(payload.emotions),
      };
      if (id) return updateBacktestEntry(user.id, id, body);
      return createBacktestEntry(user.id, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backtest-entries", user?.id] });
      toast.success(t("backtestSaved"));
      setDialogOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error(err?.message || t("backtestSaveError"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteBacktestEntry(user.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backtest-entries", user?.id] });
      toast.success(t("backtestDeleted"));
      setDeleteId(null);
    },
    onError: (err) => toast.error(err?.message || t("backtestDeleteError")),
  });

  const saveBtStrategyMutation = useMutation({
    mutationFn: async () => {
      if (editingStrategyId) {
        return updateBacktestStrategy(user.id, editingStrategyId, strategyForm);
      }
      return createBacktestStrategy(user.id, strategyForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backtest-strategies", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["backtest-entries", user?.id] });
      toast.success(t("backtestBtStrategySaved"));
      setStrategyDialogOpen(false);
      setEditingStrategyId(null);
      setStrategyForm({ name: "", description: "" });
    },
    onError: (err) => toast.error(err?.message || t("backtestBtStrategyError")),
  });

  const deleteBtStrategyMutation = useMutation({
    mutationFn: (id) => deleteBacktestStrategy(user.id, id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["backtest-strategies", user?.id] });
      if (String(strategyTab) === String(id)) setStrategyTab("all");
      toast.success(t("backtestBtStrategyDeleted"));
      setDeleteStrategyId(null);
    },
    onError: (err) => toast.error(err?.message || t("backtestBtStrategyDeleteError")),
  });

  function resetForm() {
    setEditingId(null);
    setFilePending(null);
    setForm(emptyForm());
  }

  function openAdd() {
    resetForm();
    setDialogOpen(true);
  }

  const numToStr = (v) => (v !== null && v !== undefined && v !== "" ? String(v) : "");

  function openEdit(row) {
    setEditingId(row.id);
    setFilePending(null);
    setForm({
      date: row.date || new Date().toISOString().slice(0, 10),
      symbol: row.symbol || "",
      direction: DIRECTIONS.includes(row.direction) ? row.direction : "Long",
      session: row.session || "",
      timeframe: row.timeframe || "",
      strategy_id: row.strategy_id ? String(row.strategy_id) : "",
      outcome: OUTCOMES.includes(row.outcome) ? row.outcome : "Win",
      entry_price: numToStr(row.entry_price),
      stop_loss: numToStr(row.stop_loss),
      take_profit: numToStr(row.take_profit),
      exit_price: numToStr(row.exit_price),
      risk_reward: numToStr(row.risk_reward),
      r_multiple: numToStr(row.r_multiple),
      amount: numToStr(row.amount),
      tags: row.tags || "",
      notes: row.notes || "",
      screenshot_url: row.screenshot_url || "",
      entry_confirmation: !!row.entry_confirmation,
      confluences: Array.isArray(row.confluences) ? row.confluences : [],
      mistakes: Array.isArray(row.mistakes) ? row.mistakes : [],
      grade: Number(row.grade) || 0,
      emotions: normalizeEmotions(row.emotions),
    });
    setDialogOpen(true);
  }

  return (
    <div className="w-full min-h-0 space-y-6 dashboard-surface">
      {/* Header — styl jak Dashboard */}
      <div className="mb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white bordo:text-[#f9d5e5] mb-2 flex items-center gap-2">
              <FlaskConical className="w-8 h-8 text-cyan-600 dark:text-cyan-400 shrink-0" />
              {t("backtestingTitle")}
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 bordo:text-[#d4a5b8]">
              {t("backtestingSubtitle")}
            </p>
          </div>
          <Button
            onClick={openAdd}
            className="h-9 md:h-10 px-3 md:px-4 gap-2 text-sm shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
          >
            <Plus className="w-4 h-4 shrink-0" />
            {t("backtestAddEntry")}
          </Button>
        </div>
      </div>

      {/* Summary Cards — styl Dashboard (ocean-stat-card + ocean-ring) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <Card className="ocean-stat-card hover:shadow-lg transition-all">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between gap-2 md:gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-500 truncate">{t("backtestKpiTests")}</p>
                <div className="mt-1.5 text-xl md:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{stats.total}</div>
                <p className="text-xs text-slate-500 mt-1 truncate">{stats.wins}W / {stats.losses}L / {stats.be}BE</p>
              </div>
              <div className="ocean-ring flex-shrink-0" style={{ background: `conic-gradient(#06b6d4 ${stats.total > 0 ? 100 : 0}%, #e5e7eb 0)` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="ocean-stat-card hover:shadow-lg transition-all">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between gap-2 md:gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-500 truncate">{t("backtestKpiWinRate")}</p>
                <div className="mt-1.5 text-xl md:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {stats.total ? `${stats.winRate.toFixed(1)}%` : "—"}
                </div>
                <p className="text-xs text-slate-500 mt-1 truncate">{stats.wins} {t("wins")} / {stats.total}</p>
              </div>
              <div className="ocean-ring flex-shrink-0" style={{ background: `conic-gradient(#6d4dff ${winRateGauge}%, #e5e7eb 0)` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="ocean-stat-card hover:shadow-lg transition-all">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between gap-2 md:gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-500 truncate">{t("backtestKpiAvgR")}</p>
                <div className={`mt-1.5 text-xl md:text-2xl font-bold tabular-nums ${stats.avgR >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {stats.total ? stats.avgR.toFixed(2) : "—"}
                </div>
                <p className="text-xs text-slate-500 mt-1 truncate">{t("backtestColR")}</p>
              </div>
              <div className="ocean-ring flex-shrink-0" style={{ background: `conic-gradient(#34d399 ${Math.max(0, Math.min(100, Math.round((stats.avgR / 2) * 100)))}%, #e5e7eb 0)` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="ocean-stat-card hover:shadow-lg transition-all">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between gap-2 md:gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-500 truncate">{t("backtestKpiSumR")}</p>
                <div className={`mt-1.5 text-xl md:text-2xl font-bold tabular-nums ${stats.sumR >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {stats.total ? `${stats.sumR >= 0 ? "+" : ""}${stats.sumR.toFixed(2)}` : "—"}
                </div>
                <p className="text-xs text-slate-500 mt-1 truncate">{t("profitFactor")}: {stats.profitFactor}</p>
              </div>
              <div className="ocean-ring flex-shrink-0" style={{ background: `conic-gradient(${stats.sumR >= 0 ? "#22c55e" : "#f43f5e"} ${Math.min(100, Math.abs(stats.sumR) * 5)}%, #e5e7eb 0)` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="ocean-stat-card hover:shadow-lg transition-all">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between gap-2 md:gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-500 truncate">{t("backtestKpiSumAmount")}</p>
                <div className={`mt-1.5 text-xl md:text-2xl font-bold tabular-nums ${stats.sumAmount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {stats.amountCount
                    ? stats.sumAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                    : "—"}
                </div>
                <p className="text-xs text-slate-500 mt-1 truncate">{stats.amountCount} {t("backtestKpiTests")}</p>
              </div>
              <div className="ocean-ring flex-shrink-0" style={{ background: `conic-gradient(${stats.sumAmount >= 0 ? "#22c55e" : "#f43f5e"} ${Math.min(100, Math.abs(stats.sumAmount) / 10)}%, #e5e7eb 0)` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wskazniki kolowe — jak prawa kolumna Dashboardu */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl">
        <div className="cyber-gauge">
          <div className="cyber-gauge-ring" style={{ background: `conic-gradient(var(--cyber-accent) ${winRateGauge}%, hsl(var(--border)) 0)` }} />
          <div className="cyber-gauge-label">
            <span className="cyber-gauge-value">{stats.total ? `${stats.winRate.toFixed(0)}%` : "—"}</span>
            <span className="cyber-gauge-cap">{t("winRate")}</span>
          </div>
        </div>
        <div className="cyber-gauge">
          <div className="cyber-gauge-ring" style={{ background: `conic-gradient(#a78bfa ${pfGauge}%, hsl(var(--border)) 0)` }} />
          <div className="cyber-gauge-label">
            <span className="cyber-gauge-value">{stats.profitFactor}</span>
            <span className="cyber-gauge-cap">{t("profitFactor")}</span>
          </div>
        </div>
        <div className="cyber-gauge">
          <div className="cyber-gauge-ring" style={{ background: `conic-gradient(${expectancy >= 0 ? "#34d399" : "#f43f5e"} ${Math.max(0, Math.min(100, Math.round((Math.abs(expectancy) / 1) * 100)))}%, hsl(var(--border)) 0)` }} />
          <div className="cyber-gauge-label">
            <span className={`cyber-gauge-value ${expectancy >= 0 ? "" : "text-rose-500"}`}>{stats.total ? `${expectancy >= 0 ? "+" : ""}${expectancy.toFixed(2)}R` : "—"}</span>
            <span className="cyber-gauge-cap">Expectancy</span>
          </div>
        </div>
      </div>

      {/* Strategie tylko na tej stronie (osobne od menu Strategie) */}
      <Card className="border-slate-200 dark:border-border overflow-hidden shadow-sm">
        <CardHeader className="py-3 px-4 border-b border-border bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex gap-3 min-w-0">
              <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">{t("backtestBtStrategiesTitle")}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t("backtestBtStrategiesHint")}</CardDescription>
              </div>
            </div>
            <Button size="sm" className="shrink-0 gap-1.5" onClick={() => {
              setEditingStrategyId(null);
              setStrategyForm({ name: "", description: "" });
              setStrategyDialogOpen(true);
            }}>
              <Plus className="w-4 h-4" />
              {t("backtestBtStrategyAdd")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4">
          {btStrategies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("backtestBtStrategiesEmpty")}</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {btStrategies.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2 shadow-sm hover:border-primary/30 transition-colors"
                >
                  <div className="font-semibold text-sm text-foreground truncate" title={s.name}>
                    {s.name}
                  </div>
                  {s.description ? (
                    <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{s.description}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">{t("backtestBtNoDescription")}</p>
                  )}
                  <div className="flex gap-1 mt-auto pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setEditingStrategyId(s.id);
                        setStrategyForm({ name: s.name || "", description: s.description || "" });
                        setStrategyDialogOpen(true);
                      }}
                    >
                      {t("edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive"
                      onClick={() => setDeleteStrategyId(s.id)}
                    >
                      {t("delete")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Zakładki jak w przeglądarce — filtr + osobna „strona” notatek na strategię */}
      <div className="space-y-3">
        <Tabs value={strategyTab} onValueChange={setStrategyTab} className="w-full">
          <div className="overflow-x-auto pb-0.5 rounded-t-xl border border-b-0 border-border bg-muted/30 dark:bg-muted/20">
            <TabsList className="inline-flex h-auto min-h-10 w-max max-w-full flex-nowrap justify-start gap-0 rounded-none border-0 bg-transparent p-1">
              <TabsTrigger
                value="all"
                className="shrink-0 rounded-lg border border-transparent px-3 py-2 text-xs sm:text-sm data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                {t("backtestTabAll")}
              </TabsTrigger>
              {btStrategies.map((s) => (
                <TabsTrigger
                  key={s.id}
                  value={String(s.id)}
                  className="shrink-0 max-w-[200px] truncate rounded-lg border border-transparent px-3 py-2 text-xs sm:text-sm data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  title={s.name}
                >
                  {s.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        {strategyTab !== "all" && (
          <Card className="border border-border rounded-b-xl rounded-t-none border-t-0 shadow-sm overflow-hidden">
            <CardHeader className="py-3 px-4 bg-gradient-to-r from-primary/5 to-transparent border-b border-border">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-semibold">
                    {t("backtestStrategyWorkspaceTitle")}: {strategyName(strategyTab)}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {t("backtestStrategyWorkspaceHint")}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="shrink-0"
                  disabled={saveStrategyPageMutation.isPending}
                  onClick={() => saveStrategyPageMutation.mutate()}
                >
                  {saveStrategyPageMutation.isPending ? t("loading") : t("save")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <textarea
                value={strategyPageDraft}
                onChange={(e) => setStrategyPageDraft(e.target.value)}
                rows={8}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/50 px-3 py-2.5 text-sm leading-relaxed resize-y min-h-[140px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={t("backtestStrategyWorkspacePlaceholder")}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabela — na górze (jak w journalach / testerach) */}
      <Card className="border-slate-200 dark:border-border overflow-hidden">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-base">{t("backtestTableTitle")}</CardTitle>
          <CardDescription>{t("backtestTableHint")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t("loading")}</div>
          ) : entries.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">{t("backtestEmpty")}</div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">{t("backtestEmptyFiltered")}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-center p-3 font-semibold w-12" title={t("backtestColEntryShort")}>
                    {t("backtestColEntryShort")}
                  </th>
                  <th className="text-left p-3 font-semibold">{t("date")}</th>
                  <th className="text-left p-3 font-semibold">Para</th>
                  <th className="text-left p-3 font-semibold">Kier.</th>
                  <th className="text-left p-3 font-semibold">{t("strategy")}</th>
                  <th className="text-left p-3 font-semibold">{t("backtestColOutcome")}</th>
                  <th className="text-left p-3 font-semibold">{t("backtestColR")}</th>
                  <th className="text-right p-3 font-semibold">{t("backtestColAmount")}</th>
                  <th className="text-left p-3 font-semibold">{t("backtestColShot")}</th>
                  <th className="text-right p-3 font-semibold w-[100px]">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((row) => (
                  <tr
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailRow(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetailRow(row);
                      }
                    }}
                    className="border-b border-border/80 hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <td className="p-3 text-center">
                      {row.entry_confirmation ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" aria-label={t("backtestEntryYes")} />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground/50 mx-auto" aria-label={t("backtestEntryNo")} />
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap text-slate-900 dark:text-slate-100">
                      {formatTradeDate(row.date, dateFmt)}
                    </td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100 uppercase">
                      {row.symbol || "—"}
                    </td>
                    <td className="p-3">
                      {row.direction === "Short" ? (
                        <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 text-xs font-medium">
                          <TrendingDown className="w-3.5 h-3.5" /> Short
                        </span>
                      ) : row.direction === "Long" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                          <TrendingUp className="w-3.5 h-3.5" /> Long
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 max-w-[160px] truncate" title={row.strategy_name || strategyName(row.strategy_id)}>
                      {row.strategy_name || strategyName(row.strategy_id)}
                    </td>
                    <td className="p-3">
                      <span
                        className={
                          row.outcome === "Win"
                            ? "text-emerald-600 dark:text-emerald-400 font-medium"
                            : row.outcome === "Loss"
                              ? "text-rose-600 dark:text-rose-400 font-medium"
                              : "text-amber-600 dark:text-amber-400 font-medium"
                        }
                      >
                        {row.outcome === "Win"
                          ? t("backtestOutcomeWin")
                          : row.outcome === "Loss"
                            ? t("backtestOutcomeLoss")
                            : t("backtestOutcomeBe")}
                      </span>
                    </td>
                    <td className="p-3 tabular-nums">
                      {row.r_multiple !== null && row.r_multiple !== undefined
                        ? Number(row.r_multiple).toFixed(2)
                        : "—"}
                    </td>
                    <td
                      className={`p-3 text-right tabular-nums font-medium ${
                        toNumberSafe(row.amount) !== null && toNumberSafe(row.amount) < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : toNumberSafe(row.amount) !== null && toNumberSafe(row.amount) > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {toNumberSafe(row.amount) !== null
                        ? Number(row.amount).toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                    <td className="p-3">
                      {row.screenshot_url ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewerUrl(row.screenshot_url);
                            setViewerOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <ImageIcon className="w-4 h-4" />
                          {t("view")}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(row);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(row.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Wyniki backtestingu — wykresy (KPI przeniesione na gore w stylu Dashboard) */}
      <section className="space-y-4" aria-labelledby="backtest-results-heading">
        <h2
          id="backtest-results-heading"
          className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
        >
          {t("backtestResultsTitle")}
        </h2>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="border-slate-200 dark:border-border xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{t("backtestChartOutcome")}</CardTitle>
            <CardDescription>{t("backtestChartOutcomeHint")}</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {pieData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.key === "empty"
                          ? "hsl(var(--muted))"
                          : pieColors[entry.key] || "hsl(var(--chart-3))"
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-border xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("backtestChartCumulativeR")}</CardTitle>
            <CardDescription>{t("backtestChartCumulativeRHint")}</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeRData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={t("backtestCumulativeR")}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 dark:border-border">
        <CardHeader>
          <CardTitle className="text-base">{t("backtestChartMonthly")}</CardTitle>
          <CardDescription>{t("backtestChartMonthlyHint")}</CardDescription>
        </CardHeader>
        <CardContent className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Legend />
              <Bar dataKey="tests" fill="hsl(var(--primary) / 0.7)" name={t("backtestBarTests")} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-slate-200 dark:border-border">
        <CardHeader>
          <CardTitle className="text-base">{t("backtestChartCumulativeAmount")}</CardTitle>
          <CardDescription>{t("backtestChartCumulativeAmountHint")}</CardDescription>
        </CardHeader>
        <CardContent className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulativeAmountData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={{ r: 3 }}
                name={t("backtestCumulativeAmount")}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      </section>

      {/* Analiza — wysuwana sekcja pod spodem (jak Analiza przy Dashboardzie, ale tylko dla backtestingu) */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setAnalizaOpen((v) => !v)}
          aria-expanded={analizaOpen}
          className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-cyan-200 dark:border-cyan-900/50 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/20 hover:border-cyan-400 transition text-left"
        >
          <span className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-600 text-white">
              <BarChart3 className="w-5 h-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{t("advancedAnalytics")}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{t("backtestResultsTitle")}</span>
            </span>
          </span>
          <ChevronDown className={`w-5 h-5 text-cyan-600 dark:text-cyan-400 transition-transform duration-300 ${analizaOpen ? "rotate-180" : ""}`} />
        </button>

        <div
          className={`grid transition-all duration-300 ease-in-out ${
            analizaOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-4 pt-1">
              {/* Porownanie strategii */}
              <Card className="border-slate-200 dark:border-border">
                <CardHeader className="border-b border-border">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    {t("strategiesComparison")}
                  </CardTitle>
                  <CardDescription>{t("backtestBtStrategiesHint")}</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  {strategyComparison.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">{t("backtestEmpty")}</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left p-3 font-semibold">{t("strategy")}</th>
                          <th className="text-right p-3 font-semibold">{t("backtestKpiTests")}</th>
                          <th className="text-right p-3 font-semibold">{t("winRate")}</th>
                          <th className="text-right p-3 font-semibold">{t("backtestKpiAvgR")}</th>
                          <th className="text-right p-3 font-semibold">{t("backtestKpiSumR")}</th>
                          <th className="text-right p-3 font-semibold">{t("backtestColAmount")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {strategyComparison.map((row) => (
                          <tr key={row.id} className="border-b border-border/80 hover:bg-muted/20 transition-colors">
                            <td className="p-3 max-w-[200px] truncate font-medium text-slate-900 dark:text-slate-100" title={row.name}>{row.name}</td>
                            <td className="p-3 text-right tabular-nums">{row.tests}</td>
                            <td className="p-3 text-right tabular-nums">{row.winRate.toFixed(1)}%</td>
                            <td className={`p-3 text-right tabular-nums ${row.avgR >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{row.avgR.toFixed(2)}</td>
                            <td className={`p-3 text-right tabular-nums font-medium ${row.sumR >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{row.sumR >= 0 ? "+" : ""}{row.sumR.toFixed(2)}</td>
                            <td className={`p-3 text-right tabular-nums ${row.sumAmount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {row.sumAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              {/* Breakdowny: kierunek / sesja / para / dzien tygodnia */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[
                  { title: "Wg kierunku", icon: TrendingUp, rows: breakdowns.direction },
                  { title: "Wg sesji", icon: BarChart3, rows: breakdowns.session },
                  { title: "Wg pary (top 8)", icon: Target, rows: breakdowns.pair },
                  { title: "Wg dnia tygodnia", icon: Layers, rows: breakdowns.weekday },
                ].map((grp) => (
                  <Card key={grp.title} className="border-slate-200 dark:border-border overflow-hidden">
                    <CardHeader className="py-3 px-4 border-b border-border bg-muted/20">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <grp.icon className="w-4 h-4 text-primary" />
                        {grp.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                      {grp.rows.length === 0 ? (
                        <div className="p-6 text-center text-muted-foreground text-sm">{t("backtestNoData")}</div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/10 text-xs text-muted-foreground">
                              <th className="text-left p-2.5 font-medium">—</th>
                              <th className="text-right p-2.5 font-medium">Testy</th>
                              <th className="text-right p-2.5 font-medium">Win%</th>
                              <th className="text-right p-2.5 font-medium">Σ R</th>
                            </tr>
                          </thead>
                          <tbody>
                            {grp.rows.map((r) => (
                              <tr key={r.key} className="border-b border-border/70 hover:bg-muted/20">
                                <td className="p-2.5 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[140px]" title={r.key}>{r.key}</td>
                                <td className="p-2.5 text-right tabular-nums">{r.tests}</td>
                                <td className="p-2.5 text-right tabular-nums">{r.winRate.toFixed(0)}%</td>
                                <td className={`p-2.5 text-right tabular-nums font-medium ${r.sumR >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                  {r.sumR >= 0 ? "+" : ""}{r.sumR.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Skutecznosc wg confluencji + czestotliwosc bledow */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-slate-200 dark:border-border overflow-hidden">
                  <CardHeader className="py-3 px-4 border-b border-border bg-emerald-50/50 dark:bg-emerald-950/20">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-emerald-600" />
                      Skuteczność wg confluencji
                    </CardTitle>
                    <CardDescription className="text-xs">Które warunki wejścia działają najlepiej</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    {tagStats.confluences.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground text-sm">Brak oznaczonych confluencji</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/10 text-xs text-muted-foreground">
                            <th className="text-left p-2.5 font-medium">Confluencja</th>
                            <th className="text-right p-2.5 font-medium">Testy</th>
                            <th className="text-right p-2.5 font-medium">Win%</th>
                            <th className="text-right p-2.5 font-medium">Σ R</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tagStats.confluences.map((r) => (
                            <tr key={r.key} className="border-b border-border/70 hover:bg-muted/20">
                              <td className="p-2.5 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[160px]" title={r.key}>{r.key}</td>
                              <td className="p-2.5 text-right tabular-nums">{r.tests}</td>
                              <td className="p-2.5 text-right tabular-nums">{r.winRate.toFixed(0)}%</td>
                              <td className={`p-2.5 text-right tabular-nums font-medium ${r.sumR >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {r.sumR >= 0 ? "+" : ""}{r.sumR.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-border overflow-hidden">
                  <CardHeader className="py-3 px-4 border-b border-border bg-rose-50/50 dark:bg-rose-950/20">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      Najczęstsze błędy
                    </CardTitle>
                    <CardDescription className="text-xs">Co najbardziej kosztuje Cię w R</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 overflow-x-auto">
                    {tagStats.mistakes.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground text-sm">Brak oznaczonych błędów 🎯</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/10 text-xs text-muted-foreground">
                            <th className="text-left p-2.5 font-medium">Błąd</th>
                            <th className="text-right p-2.5 font-medium">Ile razy</th>
                            <th className="text-right p-2.5 font-medium">Win%</th>
                            <th className="text-right p-2.5 font-medium">Σ R</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tagStats.mistakes.map((r) => (
                            <tr key={r.key} className="border-b border-border/70 hover:bg-muted/20">
                              <td className="p-2.5 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[160px]" title={r.key}>{r.key}</td>
                              <td className="p-2.5 text-right tabular-nums">{r.tests}</td>
                              <td className="p-2.5 text-right tabular-nums">{r.winRate.toFixed(0)}%</td>
                              <td className={`p-2.5 text-right tabular-nums font-medium ${r.sumR >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {r.sumR >= 0 ? "+" : ""}{r.sumR.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Rozklad R-multiple */}
              <Card className="border-slate-200 dark:border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    {t("backtestKpiAvgR")} — {t("outcomeDistribution")}
                  </CardTitle>
                  <CardDescription>{t("backtestColR")}</CardDescription>
                </CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rDistribution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      />
                      <Bar dataKey="count" name={t("backtestKpiTests")} radius={[4, 4, 0, 0]}>
                        {rDistribution.map((b, i) => (
                          <Cell key={i} fill={b.max <= 0 ? "hsl(var(--chart-5))" : "hsl(var(--chart-2))"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Najlepszy / najgorszy test wg R */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="border-slate-200 dark:border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="cyber-panel-title text-xs flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-emerald-500" />
                      {t("bestTrade") || "Najlepszy test"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {bestWorstByR.best ? (
                      <div className="space-y-1">
                        <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {Number(bestWorstByR.best.r_multiple).toFixed(2)}R
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                          {bestWorstByR.best.strategy_name || strategyName(bestWorstByR.best.strategy_id)}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatTradeDate(bestWorstByR.best.date, dateFmt)}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("backtestNoData")}</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="cyber-panel-title text-xs flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-rose-500" />
                      {t("worstTrade") || "Najgorszy test"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {bestWorstByR.worst ? (
                      <div className="space-y-1">
                        <p className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                          {Number(bestWorstByR.worst.r_multiple).toFixed(2)}R
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                          {bestWorstByR.worst.strategy_name || strategyName(bestWorstByR.worst.strategy_id)}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatTradeDate(bestWorstByR.worst.date, dateFmt)}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("backtestNoData")}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!detailRow} onOpenChange={(o) => { if (!o) setDetailRow(null); }}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto bg-background dark:bg-card border-border gap-0 p-0">
          {detailRow && (
            <div className="flex flex-col lg:flex-row gap-0 items-stretch">
              {detailEmotionsOpen && countFilledEmotionStages(detailRow.emotions) > 0 && (
                <EmotionsInlinePanel
                  readOnly
                  value={detailRow.emotions}
                  showSetupConfidence={false}
                  onClose={() => setDetailEmotionsOpen(false)}
                  className="lg:rounded-l-xl lg:rounded-r-none"
                />
              )}
              <div className="flex-1 min-w-0">
              <DialogHeader className="px-6 py-4 border-b border-border bg-muted/30">
                <DialogTitle className="text-lg flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-primary" />
                  {t("backtestDetailTitle")}
                </DialogTitle>
                <p className="text-sm text-muted-foreground pt-1">
                  {formatTradeDate(detailRow.date, dateFmt)} · {detailRow.strategy_name || strategyName(detailRow.strategy_id)}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {detailRow.symbol ? (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-semibold uppercase">{detailRow.symbol}</span>
                  ) : null}
                  {detailRow.direction ? (
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${detailRow.direction === "Short" ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400" : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"}`}>{detailRow.direction}</span>
                  ) : null}
                  {detailRow.session ? (
                    <span className="px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 text-xs font-medium">{detailRow.session}</span>
                  ) : null}
                  {detailRow.timeframe ? (
                    <span className="px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-xs font-medium">{detailRow.timeframe}</span>
                  ) : null}
                </div>
              </DialogHeader>
              <div className="p-6 space-y-4">
                {!detailEmotionsOpen && countFilledEmotionStages(detailRow.emotions) > 0 && (
                  <button
                    type="button"
                    onClick={() => setDetailEmotionsOpen(true)}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-purple-50 dark:bg-purple-950/30 hover:border-purple-400 transition text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-600 text-white">
                        <Brain className="w-4 h-4" />
                      </span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Pokaż dziennik emocji
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-white dark:bg-slate-900 rounded-full px-2 py-0.5">
                      {countFilledEmotionStages(detailRow.emotions)}/3
                    </span>
                  </button>
                )}
                {(detailRow.strategy_description ||
                  strategyDescriptionLookup(detailRow.strategy_id)) ? (
                  <div className="rounded-xl border border-border bg-muted/15 p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">{t("description")}</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                      {detailRow.strategy_description || strategyDescriptionLookup(detailRow.strategy_id)}
                    </p>
                  </div>
                ) : null}
                {(detailRow.entry_price != null || detailRow.stop_loss != null || detailRow.take_profit != null || detailRow.exit_price != null || detailRow.risk_reward != null) ? (
                  <div className="rounded-xl border border-border bg-muted/15 p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Poziomy cen</p>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
                      {[
                        { l: "Entry", v: detailRow.entry_price },
                        { l: "SL", v: detailRow.stop_loss },
                        { l: "TP", v: detailRow.take_profit },
                        { l: "Exit", v: detailRow.exit_price },
                        { l: "RR", v: detailRow.risk_reward != null ? `1:${Number(detailRow.risk_reward).toFixed(2)}` : null },
                      ].map((x) => (
                        <div key={x.l} className="rounded-lg bg-card border border-border py-2">
                          <p className="text-[10px] uppercase text-muted-foreground">{x.l}</p>
                          <p className="text-sm font-mono tabular-nums mt-0.5">{x.v != null && x.v !== "" ? x.v : "—"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {detailRow.tags ? (
                  <div className="flex flex-wrap gap-1.5">
                    {String(detailRow.tags).split(",").map((tg) => tg.trim()).filter(Boolean).map((tg, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200">#{tg}</span>
                    ))}
                  </div>
                ) : null}
                {Number(detailRow.grade) > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ocena</span>
                    <span className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`w-4 h-4 ${n <= Number(detailRow.grade) ? "fill-amber-400 text-amber-400" : "fill-transparent text-slate-300 dark:text-slate-600"}`} />
                      ))}
                    </span>
                  </div>
                ) : null}
                {Array.isArray(detailRow.confluences) && detailRow.confluences.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5 text-emerald-600" /> Confluencje</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detailRow.confluences.map((c, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs">{c}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {Array.isArray(detailRow.mistakes) && detailRow.mistakes.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Błędy</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detailRow.mistakes.map((m, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">{m}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("backtestColOutcome")}</p>
                    <p className={`text-lg font-semibold mt-1 ${
                      detailRow.outcome === "Win"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : detailRow.outcome === "Loss"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-amber-600 dark:text-amber-400"
                    }`}>
                      {detailRow.outcome === "Win"
                        ? t("backtestOutcomeWin")
                        : detailRow.outcome === "Loss"
                          ? t("backtestOutcomeLoss")
                          : t("backtestOutcomeBe")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("backtestColEntryShort")}</p>
                    <p className="text-lg font-semibold mt-1 flex items-center gap-2">
                      {detailRow.entry_confirmation ? (
                        <>
                          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                          {t("backtestEntryYes")}
                        </>
                      ) : (
                        <>
                          <Circle className="w-5 h-5 text-muted-foreground" />
                          {t("backtestEntryNo")}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("backtestColR")}</p>
                    <p className="text-xl font-mono tabular-nums mt-1">
                      {detailRow.r_multiple != null ? Number(detailRow.r_multiple).toFixed(2) : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("backtestColAmount")}</p>
                    <p className="text-xl font-mono tabular-nums mt-1">
                      {toNumberSafe(detailRow.amount) != null
                        ? Number(detailRow.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                        : "—"}
                    </p>
                  </div>
                </div>
                {detailRow.notes ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{t("notes")}</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{detailRow.notes}</p>
                  </div>
                ) : null}
                {detailRow.screenshot_url ? (
                  <div className="rounded-xl border border-border overflow-hidden bg-muted/10">
                    <button
                      type="button"
                      className="w-full block focus:outline-none focus:ring-2 focus:ring-primary/40"
                      onClick={() => {
                        setViewerUrl(detailRow.screenshot_url);
                        setViewerOpen(true);
                      }}
                    >
                      <img
                        src={detailRow.screenshot_url}
                        alt=""
                        className="w-full max-h-[320px] object-contain bg-slate-950/5 dark:bg-slate-950/40"
                      />
                    </button>
                    <p className="text-xs text-center text-muted-foreground py-2">{t("backtestDetailTapZoom")}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => setDetailRow(null)}>{t("close")}</Button>
                  <Button
                    onClick={() => {
                      const r = detailRow;
                      setDetailRow(null);
                      openEdit(r);
                    }}
                  >
                    {t("edit")}
                  </Button>
                </div>
              </div>
            </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { resetForm(); setDialogOpen(false); } }}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto bg-background dark:bg-card border-border gap-0 p-0">
          <div className="flex flex-col lg:flex-row gap-0 items-stretch">
            {emotionsOpen && (
              <EmotionsInlinePanel
                value={form.emotions}
                onChange={(next) => setForm((f) => ({ ...f, emotions: next }))}
                showSetupConfidence={false}
                onClose={() => setEmotionsOpen(false)}
                className="lg:rounded-l-xl lg:rounded-r-none"
              />
            )}
          <div className="flex-1 min-w-0 p-6 overflow-y-auto max-h-[92vh]">
          <DialogHeader className="border-b border-border pb-3 -mt-2">
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              {editingId ? t("backtestEditEntry") : t("backtestAddEntry")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Sekcja: setup */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">{t("date")}</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="border-slate-200 dark:border-slate-600 dark:bg-slate-800"
                />
              </div>
              <div>
                <Label className="text-xs">Para / instrument</Label>
                <Input
                  list="bt-pairs"
                  placeholder="EURUSD"
                  value={form.symbol}
                  onChange={(e) => setForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                  className="border-slate-200 dark:border-slate-600 dark:bg-slate-800 uppercase"
                />
                <datalist id="bt-pairs">
                  {COMMON_PAIRS.map((p) => <option key={p} value={p} />)}
                </datalist>
              </div>
              <div>
                <Label className="text-xs">Kierunek</Label>
                <select
                  value={form.direction}
                  onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm"
                >
                  {DIRECTIONS.map((d) => (
                    <option key={d} value={d}>{d === "Long" ? "Long (kupno)" : "Short (sprzedaż)"}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Sesja</Label>
                <select
                  value={form.session}
                  onChange={(e) => setForm((f) => ({ ...f, session: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="">—</option>
                  {SESSIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Timeframe</Label>
                <select
                  value={form.timeframe}
                  onChange={(e) => setForm((f) => ({ ...f, timeframe: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="">—</option>
                  {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">{t("strategy")}</Label>
                <select
                  value={form.strategy_id}
                  onChange={(e) => setForm((f) => ({ ...f, strategy_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                >
                  <option value="">{t("backtestSelectBtStrategyPlaceholder")}</option>
                  {btStrategies.map((s) => (
                    <option key={s.id} value={String(s.id)}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sekcja: ceny */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/60 dark:bg-slate-900/30">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Poziomy cen (opcjonalne)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Entry</Label>
                  <Input type="text" inputMode="decimal" placeholder="1.0850" value={form.entry_price}
                    onChange={(e) => setForm((f) => ({ ...f, entry_price: e.target.value }))}
                    className="border-slate-200 dark:border-slate-600 dark:bg-slate-800" />
                </div>
                <div>
                  <Label className="text-xs">Stop Loss</Label>
                  <Input type="text" inputMode="decimal" placeholder="1.0820" value={form.stop_loss}
                    onChange={(e) => setForm((f) => ({ ...f, stop_loss: e.target.value }))}
                    className="border-slate-200 dark:border-slate-600 dark:bg-slate-800" />
                </div>
                <div>
                  <Label className="text-xs">Take Profit</Label>
                  <Input type="text" inputMode="decimal" placeholder="1.0910" value={form.take_profit}
                    onChange={(e) => setForm((f) => ({ ...f, take_profit: e.target.value }))}
                    className="border-slate-200 dark:border-slate-600 dark:bg-slate-800" />
                </div>
                <div>
                  <Label className="text-xs">Exit</Label>
                  <Input type="text" inputMode="decimal" placeholder="1.0905" value={form.exit_price}
                    onChange={(e) => setForm((f) => ({ ...f, exit_price: e.target.value }))}
                    className="border-slate-200 dark:border-slate-600 dark:bg-slate-800" />
                </div>
              </div>
              {plannedRR !== null && (
                <p className="text-xs mt-2 text-cyan-700 dark:text-cyan-300">
                  Planowany RR: <span className="font-semibold tabular-nums">1 : {plannedRR.toFixed(2)}</span>
                </p>
              )}
            </div>

            {/* Sekcja: wynik */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">{t("backtestColOutcome")}</Label>
                <select
                  value={form.outcome}
                  onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm"
                >
                  {OUTCOMES.map((o) => (
                    <option key={o} value={o}>
                      {o === "Win" ? t("backtestOutcomeWin") : o === "Loss" ? t("backtestOutcomeLoss") : t("backtestOutcomeBe")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">{t("backtestColR")} (zrealizowane)</Label>
                <Input type="text" inputMode="decimal" placeholder="0.5 / -1" value={form.r_multiple}
                  onChange={(e) => setForm((f) => ({ ...f, r_multiple: e.target.value }))}
                  className="border-slate-200 dark:border-slate-600 dark:bg-slate-800" />
              </div>
              <div>
                <Label className="text-xs">RR planowany</Label>
                <Input type="text" inputMode="decimal" placeholder={plannedRR !== null ? plannedRR.toFixed(2) : "2"} value={form.risk_reward}
                  onChange={(e) => setForm((f) => ({ ...f, risk_reward: e.target.value }))}
                  className="border-slate-200 dark:border-slate-600 dark:bg-slate-800" />
              </div>
              <div>
                <Label className="text-xs">{t("backtestColAmount")}</Label>
                <Input type="text" inputMode="decimal" placeholder="100 / -50" value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="border-slate-200 dark:border-slate-600 dark:bg-slate-800" />
              </div>
            </div>

            {/* Confluencje (setup) */}
            <div>
              <Label className="text-xs flex items-center gap-1.5">
                <ListChecks className="w-3.5 h-3.5 text-emerald-600" /> Confluencje / warunki wejścia
              </Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {CONFLUENCES.map((c) => {
                  const active = form.confluences.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleInArray("confluences", c)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition ${
                        active
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-emerald-400"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bledy / czego unikac */}
            <div>
              <Label className="text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Błędy w zagraniu
              </Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {MISTAKES.map((m) => {
                  const active = form.mistakes.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleInArray("mistakes", m)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition ${
                        active
                          ? "bg-rose-600 border-rose-600 text-white shadow-sm"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-rose-400"
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ocena jakosci zagrania + emocje */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-3 bg-slate-50 dark:bg-slate-900/40">
                <Label className="text-xs">Ocena jakości zagrania</Label>
                <div className="flex items-center gap-1 mt-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, grade: f.grade === n ? 0 : n }))}
                      className="p-0.5 transition-transform hover:scale-110"
                      aria-label={`Ocena ${n}`}
                    >
                      <Star className={`w-6 h-6 ${n <= form.grade ? "fill-amber-400 text-amber-400" : "fill-transparent text-slate-300 dark:text-slate-600"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmotionsOpen((open) => !open)}
                className={`rounded-lg border p-3 transition flex items-center justify-between gap-2 text-left ${
                  emotionsOpen
                    ? "border-violet-400 dark:border-violet-600 bg-violet-100 dark:bg-violet-950/50"
                    : "border-violet-200 dark:border-violet-900/50 bg-violet-50 dark:bg-violet-950/20 hover:border-violet-400"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-600 text-white">
                    <Brain className="w-4 h-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Dziennik emocji</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">przed · w trakcie · po</span>
                  </span>
                </span>
                <span className="text-xs font-semibold text-violet-700 dark:text-violet-300 bg-white dark:bg-slate-900 rounded-full px-2 py-0.5">
                  {countFilledEmotionStages(form.emotions)}/3
                </span>
              </button>
            </div>

            <div>
              <Label className="text-xs">Tagi dodatkowe</Label>
              <Input
                placeholder="dowolne notki, oddzielaj przecinkami"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                className="border-slate-200 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-600 p-3 bg-slate-50 dark:bg-slate-900/40">
              <Checkbox
                id="entry_confirmation"
                checked={form.entry_confirmation}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, entry_confirmation: v === true }))
                }
              />
              <div className="space-y-0.5">
                <Label htmlFor="entry_confirmation" className="cursor-pointer font-medium">
                  {t("backtestEntryConfirmLabel")}
                </Label>
                <p className="text-xs text-muted-foreground">{t("backtestEntryConfirmHint")}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("notes")}</Label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm resize-y"
                placeholder={t("backtestNotesPlaceholder")}
              />
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
              <Label className="text-xs font-semibold">{t("backtestScreenshot")}</Label>
              <Input
                type="file"
                accept="image/*"
                className="mt-2 cursor-pointer text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setFilePending(f || null);
                }}
              />
              {form.screenshot_url && !filePending && (
                <button
                  type="button"
                  className="text-xs text-primary mt-2 underline"
                  onClick={() => {
                    setViewerUrl(form.screenshot_url);
                    setViewerOpen(true);
                  }}
                >
                  {t("backtestViewCurrent")}
                </button>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setDialogOpen(false);
                }}
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={() =>
                  saveMutation.mutate({ id: editingId, payload: { ...form } })
                }
                disabled={saveMutation.isPending || !form.date}
              >
                {saveMutation.isPending ? t("loading") : t("save")}
              </Button>
            </div>
          </div>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={strategyDialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setStrategyDialogOpen(false);
            setEditingStrategyId(null);
            setStrategyForm({ name: "", description: "" });
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-background dark:bg-card border-border">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle>
              {editingStrategyId ? t("backtestBtStrategyEdit") : t("backtestBtStrategyAdd")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>{t("backtestBtStrategyName")}</Label>
              <Input
                value={strategyForm.name}
                onChange={(e) => setStrategyForm((f) => ({ ...f, name: e.target.value }))}
                className="border-slate-200 dark:border-slate-600 dark:bg-slate-800"
                placeholder={t("backtestBtStrategyNamePh")}
              />
            </div>
            <div>
              <Label>{t("description")}</Label>
              <textarea
                rows={5}
                value={strategyForm.description}
                onChange={(e) => setStrategyForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm resize-y min-h-[100px]"
                placeholder={t("backtestBtStrategyDescPh")}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStrategyDialogOpen(false);
                  setEditingStrategyId(null);
                  setStrategyForm({ name: "", description: "" });
                }}
              >
                {t("cancel")}
              </Button>
              <Button
                disabled={saveBtStrategyMutation.isPending || !strategyForm.name.trim()}
                onClick={() => saveBtStrategyMutation.mutate()}
              >
                {saveBtStrategyMutation.isPending ? t("loading") : t("save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteStrategyId} onOpenChange={() => setDeleteStrategyId(null)}>
        <AlertDialogContent className="dark:bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("backtestBtStrategyDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("backtestBtStrategyDeleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteStrategyId && deleteBtStrategyMutation.mutate(deleteStrategyId)}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="dark:bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("backtestDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("backtestDeleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImageViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        imageUrl={viewerUrl}
      />
    </div>
  );
}
