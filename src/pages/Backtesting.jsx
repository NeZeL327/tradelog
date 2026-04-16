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
  Percent,
  BarChart3,
  Wallet,
  CheckCircle2,
  Circle,
  FileText,
  Layers,
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

const OUTCOMES = ["Win", "Loss", "Breakeven"];

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

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    strategy_id: "",
    outcome: "Win",
    r_multiple: "",
    amount: "",
    notes: "",
    screenshot_url: "",
    entry_confirmation: false,
  });
  const [filePending, setFilePending] = useState(null);

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
    };
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
      const body = {
        date: payload.date,
        strategy_id,
        strategy_name: sn,
        strategy_description: typeof sd === "string" ? sd : "",
        outcome: payload.outcome,
        r_multiple: toNumberSafe(payload.r_multiple),
        amount: toNumberSafe(payload.amount),
        notes: payload.notes?.trim() || "",
        screenshot_url: screenshot_url || "",
        entry_confirmation: !!payload.entry_confirmation,
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
    setForm({
      date: new Date().toISOString().slice(0, 10),
      strategy_id: "",
      outcome: "Win",
      r_multiple: "",
      amount: "",
      notes: "",
      screenshot_url: "",
      entry_confirmation: false,
    });
  }

  function openAdd() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    setFilePending(null);
    setForm({
      date: row.date || new Date().toISOString().slice(0, 10),
      strategy_id: row.strategy_id ? String(row.strategy_id) : "",
      outcome: OUTCOMES.includes(row.outcome) ? row.outcome : "Win",
      r_multiple:
        row.r_multiple !== null && row.r_multiple !== undefined
          ? String(row.r_multiple)
          : "",
      amount:
        row.amount !== null && row.amount !== undefined
          ? String(row.amount)
          : "",
      notes: row.notes || "",
      screenshot_url: row.screenshot_url || "",
      entry_confirmation: !!row.entry_confirmation,
    });
    setDialogOpen(true);
  }

  return (
    <div className="w-full min-h-0 space-y-6 dashboard-surface">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="cyber-page-title flex items-center gap-2">
            <FlaskConical className="w-8 h-8 text-cyan-600 dark:text-cyan-400 shrink-0" />
            {t("backtestingTitle")}
          </h1>
          <p className="cyber-page-sub mt-1 max-w-2xl">
            {t("backtestingSubtitle")}
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="gap-2 cyber-primary-btn shrink-0"
        >
          <Plus className="w-5 h-5" />
          {t("backtestAddEntry")}
        </Button>
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

      {/* Wyniki backtestingu — KPI + wykresy */}
      <section className="space-y-4" aria-labelledby="backtest-results-heading">
        <h2
          id="backtest-results-heading"
          className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
        >
          {t("backtestResultsTitle")}
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <Card className="border-slate-200 dark:border-border bg-card shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardDescription className="text-xs">{t("backtestKpiTests")}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200 dark:border-border bg-card shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardDescription className="text-xs flex items-center gap-1">
              <Percent className="w-3.5 h-3.5" /> {t("backtestKpiWinRate")}
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {stats.total ? `${stats.winRate.toFixed(1)}%` : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200 dark:border-border bg-card shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardDescription className="text-xs flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> {t("backtestKpiAvgR")}
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {stats.total ? stats.avgR.toFixed(2) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200 dark:border-border bg-card shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardDescription className="text-xs flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" /> {t("backtestKpiSumR")}
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {stats.total ? stats.sumR.toFixed(2) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200 dark:border-border bg-card shadow-sm">
          <CardHeader className="pb-2 pt-4">
            <CardDescription className="text-xs flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" /> {t("backtestKpiSumAmount")}
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {stats.amountCount
                ? stats.sumAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })
                : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

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

      <Dialog open={!!detailRow} onOpenChange={(o) => { if (!o) setDetailRow(null); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-background dark:bg-card border-border gap-0 p-0">
          {detailRow && (
            <>
              <DialogHeader className="px-6 py-4 border-b border-border bg-muted/30">
                <DialogTitle className="text-lg flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-primary" />
                  {t("backtestDetailTitle")}
                </DialogTitle>
                <p className="text-sm text-muted-foreground pt-1">
                  {formatTradeDate(detailRow.date, dateFmt)} · {detailRow.strategy_name || strategyName(detailRow.strategy_id)}
                </p>
              </DialogHeader>
              <div className="p-6 space-y-4">
                {(detailRow.strategy_description ||
                  strategyDescriptionLookup(detailRow.strategy_id)) ? (
                  <div className="rounded-xl border border-border bg-muted/15 p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">{t("description")}</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                      {detailRow.strategy_description || strategyDescriptionLookup(detailRow.strategy_id)}
                    </p>
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
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { resetForm(); setDialogOpen(false); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-background dark:bg-card border-border">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle>
              {editingId ? t("backtestEditEntry") : t("backtestAddEntry")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>{t("date")}</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="border-slate-200 dark:border-slate-600 dark:bg-slate-800"
              />
            </div>
            <div>
              <Label>{t("backtestBtStrategySelect")}</Label>
              <select
                value={form.strategy_id}
                onChange={(e) => setForm((f) => ({ ...f, strategy_id: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">{t("backtestSelectBtStrategyPlaceholder")}</option>
                {btStrategies.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1.5">{t("backtestBtStrategySelectHint")}</p>
            </div>
            <div>
              <Label>{t("backtestColOutcome")}</Label>
              <select
                value={form.outcome}
                onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800"
              >
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {o === "Win"
                      ? t("backtestOutcomeWin")
                      : o === "Loss"
                        ? t("backtestOutcomeLoss")
                        : t("backtestOutcomeBe")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t("backtestColR")}</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.5"
                value={form.r_multiple}
                onChange={(e) => setForm((f) => ({ ...f, r_multiple: e.target.value }))}
                className="border-slate-200 dark:border-slate-600 dark:bg-slate-800"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("backtestRHint")}</p>
            </div>
            <div>
              <Label>{t("backtestColAmount")}</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="100 / -50"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="border-slate-200 dark:border-slate-600 dark:bg-slate-800"
              />
              <p className="text-xs text-muted-foreground mt-1">{t("backtestAmountHint")}</p>
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
              <Label>{t("notes")}</Label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-sm resize-none"
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
