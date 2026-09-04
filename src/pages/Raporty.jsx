import { useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import {
  getReports,
  createReport,
  updateReport,
  deleteReport,
  getTrades,
} from "@/lib/localStorage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  FileText,
  Calendar,
  Sparkles,
  Download,
  GitCompare,
  Eye,
  MoreHorizontal,
  ChevronDown,
  ArrowRight,
  Trophy,
  BarChart3,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/LanguageProvider";
import QuoteLine from "@/components/QuoteLine";
import ReportForm from "@/components/reports/ReportForm";
import ReportArticle from "@/components/reports/ReportArticle";
import Sparkline from "@/components/Sparkline";
import { FilterChip } from "@/components/ui/filter-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonBlock } from "@/components/ui/skeleton-block";
import { computeBasicStats, reportPeriodLabel, reportTypeLabel, tradesInPeriod } from "@/lib/reports";
import { getTradeRealizedPL } from "@/lib/utils";

const TYPE_TABS = [
  { key: "all", labelKey: "reportFilterAll" },
  { key: "weekly", labelKey: "reportWeekly" },
  { key: "monthly", labelKey: "reportMonthly" },
  { key: "quarterly", labelKey: "reportQuarterly" },
  { key: "yearly", labelKey: "reportYearly" },
];

function toNum(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatR(value) {
  const n = toNum(value);
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

function formatPct(value) {
  const n = toNum(value);
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

function profitFactorFromTrades(list) {
  let gain = 0;
  let loss = 0;
  (list || []).forEach((trade) => {
    const pl = getTradeRealizedPL(trade) ?? 0;
    if (pl > 0) gain += pl;
    else if (pl < 0) loss += Math.abs(pl);
  });
  if (!loss) return gain > 0 ? gain : null;
  return gain / loss;
}

function sparkValuesFromReports(reports) {
  const values = [...reports]
    .reverse()
    .map((r) => toNum(r.result_r))
    .filter((n) => n != null);
  return values.length ? values : [0];
}

function sparkFromTrades(list) {
  const byDay = {};
  (list || []).forEach((trade) => {
    const day = String(trade.date || "").slice(0, 10);
    if (!day) return;
    byDay[day] = (byDay[day] || 0) + (getTradeRealizedPL(trade) ?? 0);
  });
  const keys = Object.keys(byDay).sort();
  if (!keys.length) return [0];
  let acc = 0;
  return keys.map((key) => {
    acc += byDay[key];
    return acc;
  });
}

function reportTitle(type, t) {
  const map = {
    weekly: t("reportWeeklyTitle") || "Raport tygodniowy",
    monthly: t("reportMonthlyTitle") || "Raport miesięczny",
    quarterly: t("reportQuarterlyTitle") || "Raport kwartalny",
    yearly: t("reportYearlyTitle") || "Raport roczny",
  };
  return map[type] || reportTypeLabel(type, t);
}

function reportTypeCol(type, t) {
  const map = {
    weekly: t("reportTypeWeekly") || "Tygodniowy",
    monthly: t("reportTypeMonthly") || "Miesięczny",
    quarterly: t("reportTypeQuarterly") || "Kwartalny",
    yearly: t("reportTypeYearly") || "Roczny",
  };
  return map[type] || reportTypeLabel(type, t);
}

function Ring({ value }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className="relative h-11 w-11 shrink-0 rounded-full"
      style={{
        background: `conic-gradient(hsl(var(--profit)) ${pct * 3.6}deg, hsl(220 8% 16%) 0deg)`,
        boxShadow: "0 0 14px hsl(var(--profit) / 0.35)",
      }}
      aria-hidden
    >
      <div className="absolute inset-[4px] rounded-full bg-card" />
    </div>
  );
}

function exportReportsCsv(rows, language, t) {
  const headers = [
    t("reportPeriod") || "Okres",
    t("reportTypeCol") || "Typ",
    t("reportTradesCount") || "Transakcje",
    t("reportResultR") || "Wynik",
    "Win Rate",
    t("reportStatusCol") || "Status",
  ];
  const lines = rows.map((r) => [
    reportPeriodLabel(r, language),
    reportTypeLabel(r.report_type, t),
    r.trades_count ?? "",
    r.result_r ?? "",
    r.win_rate ?? "",
    r.status === "draft" ? (t("reportDraft") || "Szkic") : (t("reportStatusDone") || "Zakończony"),
  ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","));
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "aikeeptrade-raporty.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function Raporty() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [view, setView] = useState("list");
  const [formType, setFormType] = useState("weekly");
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports", user?.id],
    queryFn: () => getReports(user?.id),
    enabled: !!user?.id,
  });

  const { data: trades = [] } = useQuery({
    queryKey: ["trades", user?.id],
    queryFn: () => getTrades(user?.id),
    enabled: !!user?.id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateReport(user?.id, id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["reports", user?.id] });
      if (updated?.id) {
        setSelected(updated);
        setEditing(null);
        setView("article");
      } else {
        setView("list");
        setEditing(null);
      }
      toast.success(t("reportSaved") || "Raport zapisany");
    },
    onError: (err) => toast.error(err?.message || "Błąd zapisu"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => createReport(user?.id, data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["reports", user?.id] });
      if (created?.id) {
        setSelected(created);
        setEditing(null);
        setView("article");
      } else {
        setView("list");
        setEditing(null);
      }
      toast.success(t("reportSaved") || "Raport zapisany");
    },
    onError: (err) => toast.error(err?.message || "Błąd zapisu"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteReport(user?.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports", user?.id] });
      setDeleteId(null);
      setSelected(null);
      setView("list");
      toast.success(t("reportDeleted") || "Raport usunięty");
    },
    onError: (err) => toast.error(err?.message || "Błąd usuwania"),
  });

  const years = useMemo(() => {
    const set = new Set();
    reports.forEach((r) => {
      if (r.year) set.add(Number(r.year));
    });
    return [...set].sort((a, b) => b - a);
  }, [reports]);

  const filtered = useMemo(() => {
    return [...reports]
      .filter((r) => (typeFilter === "all" ? true : r.report_type === typeFilter))
      .filter((r) => (yearFilter === "all" ? true : Number(r.year) === Number(yearFilter)))
      .sort((a, b) => {
        const da = String(a.sort_date || a.period_end || a.period_start || "");
        const db = String(b.sort_date || b.period_end || b.period_start || "");
        return db.localeCompare(da);
      });
  }, [reports, typeFilter, yearFilter]);

  const kpis = useMemo(() => {
    const withR = filtered.map((r) => ({ r, n: toNum(r.result_r) })).filter((x) => x.n != null);
    const best = withR.reduce((acc, cur) => (!acc || cur.n > acc.n ? cur : acc), null);
    const avg = withR.length
      ? withR.reduce((sum, x) => sum + x.n, 0) / withR.length
      : null;
    const wrVals = filtered.map((r) => toNum(r.win_rate)).filter((n) => n != null);
    const wr = wrVals.length ? wrVals.reduce((a, b) => a + b, 0) / wrVals.length : null;
    return {
      total: filtered.length,
      bestValue: best?.n ?? null,
      bestLabel: best ? reportPeriodLabel(best.r, language) : "",
      avg,
      wr,
      spark: sparkValuesFromReports(filtered),
    };
  }, [filtered, language]);

  const latest = filtered[0] || null;
  const latestTrades = latest
    ? tradesInPeriod(trades, latest.period_start, latest.period_end)
    : [];
  const latestStats = computeBasicStats(latestTrades);
  const latestPf = profitFactorFromTrades(latestTrades);
  const latestSpark = sparkFromTrades(latestTrades);
  const comparePair = filtered.slice(0, 2);

  const openReport = (report) => {
    setSelected(report);
    setView("article");
  };

  const openNew = (type) => {
    setFormType(type);
    setEditing(null);
    setTypeDialogOpen(false);
    setView("form");
  };

  const handleSubmit = (payload) => {
    if (editing?.id) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleExport = () => {
    if (!filtered.length) {
      toast.error(t("reportEmpty") || "Brak raportów do eksportu.");
      return;
    }
    try {
      exportReportsCsv(filtered, language, t);
      toast.success(t("reportExported") || "Wyeksportowano raporty.");
    } catch (err) {
      toast.error(err?.message || "Błąd eksportu");
    }
  };

  const handleCompare = () => {
    if (comparePair.length < 2) {
      toast.error(t("reportCompareNeedTwo") || "Potrzebujesz co najmniej dwóch raportów.");
      return;
    }
    setCompareOpen(true);
  };

  if (isLoading) {
    return (
      <div className="w-full min-h-0 space-y-4 dashboard-surface">
        <SkeletonBlock rows={6} className="rounded-lg border border-border" />
      </div>
    );
  }

  if (view === "form") {
    return (
      <div className="w-full min-h-0 space-y-4 dashboard-surface">
        <div>
          <h1 className="cyber-page-title">
            {editing
              ? (t("reportEdit") || "Edytuj raport")
              : (t("reportNew") || "Nowy raport")}
          </h1>
          <p className="cyber-page-sub">
            {reportTypeLabel(editing?.report_type || formType, t)}
          </p>
        </div>
        <ReportForm
          key={editing?.id || formType}
          reportType={formType}
          report={editing}
          trades={trades}
          userId={user?.id}
          onSubmit={handleSubmit}
          onCancel={() => {
            setView(editing ? "article" : "list");
            if (!editing) setEditing(null);
          }}
          saving={createMutation.isPending || updateMutation.isPending}
          t={t}
        />
      </div>
    );
  }

  if (view === "article" && selected) {
    return (
      <div className="w-full min-h-0 dashboard-surface py-2">
        <ReportArticle
          report={selected}
          language={language}
          t={t}
          onBack={() => {
            setSelected(null);
            setView("list");
          }}
          onEdit={() => {
            setEditing(selected);
            setFormType(selected.report_type);
            setView("form");
          }}
          onDelete={() => setDeleteId(selected.id)}
          onToggleStatus={() => {
            const next = selected.status === "draft" ? "published" : "draft";
            updateMutation.mutate({
              id: selected.id,
              data: { status: next },
            });
            setSelected({ ...selected, status: next });
          }}
        />
        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("reportDeleteConfirm") || "Usunąć raport?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("reportDeleteHint") || "Tej operacji nie można cofnąć."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel") || "Anuluj"}</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)}>
                {t("delete") || "Usuń"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="w-full min-h-0 space-y-6 dashboard-surface">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="cyber-page-title">{t("reportsTitle") || "Raporty tradingowe"}</h1>
          <p className="cyber-page-sub">
            {t("reportsSubtitle") || "Podsumowanie mojego tradingu, procesu, błędów i rozwoju."}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <QuoteLine className="hidden lg:flex shrink-0" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="cyber-primary-btn w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-1.5" />
                {t("reportAdd") || "Dodaj raport"}
                <ChevronDown className="w-4 h-4 ml-1 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {[
                { type: "weekly", label: t("reportWeekly") || "Tygodniowe" },
                { type: "monthly", label: t("reportMonthly") || "Miesięczne" },
                { type: "quarterly", label: t("reportQuarterly") || "Kwartalne" },
                { type: "yearly", label: t("reportYearly") || "Roczne" },
              ].map((item) => (
                <DropdownMenuItem key={item.type} onClick={() => openNew(item.type)}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {TYPE_TABS.map((tab) => (
            <FilterChip
              key={tab.key}
              active={typeFilter === tab.key}
              className="rounded-full px-4"
              onClick={() => setTypeFilter(tab.key)}
            >
              {t(tab.labelKey) || tab.key}
            </FilterChip>
          ))}
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-full sm:w-[170px] h-9 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground mr-1" />
            <SelectValue placeholder={t("year") || "Rok"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("reportAllYears") || "Wszystkie lata"}</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="report-card p-4 min-h-[118px]">
          <div className="flex items-center gap-2 mb-2">
            <span className="report-icon"><TrendingUp className="w-3.5 h-3.5" /></span>
            <p className="type-section">{t("reportKpiTotal") || "Łączna liczba raportów"}</p>
          </div>
          <p className="type-metric tabular-nums">{kpis.total}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{t("reportKpiTotalHint") || "Wszystkie okresy"}</p>
        </div>
        <div className="report-card p-4 min-h-[118px] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="report-icon"><Trophy className="w-3.5 h-3.5" /></span>
              <p className="type-section">{t("reportKpiBest") || "Najlepszy okres"}</p>
            </div>
            <p className={`type-metric tabular-nums ${toNum(kpis.bestValue) >= 0 ? "text-profit" : "text-loss"}`}>
              {formatR(kpis.bestValue)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{kpis.bestLabel || "—"}</p>
          </div>
          <Sparkline values={kpis.spark} width={96} height={44} className="shrink-0 mt-1" />
        </div>
        <div className="report-card p-4 min-h-[118px] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="report-icon"><BarChart3 className="w-3.5 h-3.5" /></span>
              <p className="type-section">{t("reportKpiAvg") || "Średni wynik okresu"}</p>
            </div>
            <p className={`type-metric tabular-nums ${toNum(kpis.avg) >= 0 ? "text-profit" : "text-loss"}`}>
              {formatR(kpis.avg)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{t("reportKpiAvgHint") || "Na raport"}</p>
          </div>
          <Sparkline values={kpis.spark} width={96} height={44} className="shrink-0 mt-1" />
        </div>
        <div className="report-card p-4 min-h-[118px] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="report-icon"><Target className="w-3.5 h-3.5" /></span>
              <p className="type-section">{t("reportKpiWinRate") || "Skuteczność"}</p>
            </div>
            <p className="type-metric tabular-nums">{kpis.wr == null ? "—" : `${kpis.wr.toFixed(1)}%`}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{t("reportKpiWinRateHint") || "Średni Win Rate"}</p>
          </div>
          <Ring value={kpis.wr} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-4">
        <div className="report-card p-4 sm:p-5 min-h-[220px]">
          {latest ? (
            <>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="report-icon shrink-0">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-foreground truncate">
                      {reportTitle(latest.report_type, t)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reportPeriodLabel(latest, language)}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-8 shrink-0 rounded-xl" onClick={() => openReport(latest)}>
                  {t("reportOpen") || "Otwórz raport"}
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-5 items-end">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">P&L</p>
                    <p className={`text-2xl font-semibold tabular-nums mt-1 ${toNum(latest.result_r) >= 0 ? "text-profit" : "text-loss"}`}>
                      {formatR(latest.result_r)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Win Rate</p>
                    <p className="text-2xl font-semibold tabular-nums mt-1">{formatPct(latest.win_rate)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("reportTradesCount") || "Transakcje"}</p>
                    <p className="text-2xl font-semibold tabular-nums mt-1">
                      {latest.trades_count ?? latestStats.trades_count ?? 0}
                    </p>
                    <p className="text-xs mt-0.5">
                      <span className="text-profit">{latestStats.wins_count}W</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="text-loss">{latestStats.losses_count}L</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("reportPf") || "Profit Factor"}</p>
                    <p className="text-2xl font-semibold tabular-nums mt-1">
                      {latestPf == null ? "—" : latestPf.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <Sparkline
                    values={latestSpark}
                    width={640}
                    height={112}
                    fill
                    endLabel={formatR(latest.result_r)}
                    className="w-full"
                  />
                  <p className="absolute bottom-0 right-0 text-[10px] text-muted-foreground">
                    {t("reportPeriodResult") || "Wynik okresu"}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={FileText}
              description={t("reportEmpty") || "Nie masz jeszcze raportów. Dodaj pierwszy."}
              actionLabel={t("reportAdd") || "Dodaj raport"}
              onAction={() => setTypeDialogOpen(true)}
            />
          )}
        </div>

        <div className="report-card p-4 h-fit">
          <p className="type-section mb-3">{t("reportQuickActions") || "Szybkie akcje"}</p>
          <div className="grid gap-2">
            <Button variant="outline" className="justify-start h-11 rounded-xl border-border hover:border-primary/40 hover:bg-primary/10 hover:text-foreground" onClick={() => setTypeDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t("reportNew") || "Nowy raport"}
            </Button>
            <Button variant="outline" className="justify-start h-11 rounded-xl border-border hover:border-primary/40 hover:bg-primary/10 hover:text-foreground" onClick={() => openNew("weekly")}>
              <Sparkles className="w-4 h-4 mr-2" />
              {t("reportGenerateAi") || "Generuj raport z AI"}
            </Button>
            <Button variant="outline" className="justify-start h-11 rounded-xl border-border hover:border-primary/40 hover:bg-primary/10 hover:text-foreground" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              {t("reportExport") || "Eksportuj dane"}
            </Button>
            <Button variant="outline" className="justify-start h-11 rounded-xl border-border hover:border-primary/40 hover:bg-primary/10 hover:text-foreground" onClick={handleCompare}>
              <GitCompare className="w-4 h-4 mr-2" />
              {t("reportCompare") || "Porównaj okresy"}
            </Button>
          </div>
        </div>
      </div>

      <div className="report-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{t("reportHistory") || "Historia raportów"}</h2>
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-10">
            <EmptyState
              icon={FileText}
              description={t("reportEmpty") || "Nie masz jeszcze raportów. Dodaj pierwszy."}
              actionLabel={t("reportAdd") || "Dodaj raport"}
              onAction={() => setTypeDialogOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left font-semibold px-4 py-2.5">{t("reportPeriod") || "Okres"}</th>
                  <th className="text-left font-semibold px-4 py-2.5">{t("reportTypeCol") || "Typ"}</th>
                  <th className="text-right font-semibold px-4 py-2.5">{t("reportTradesCount") || "Transakcje"}</th>
                  <th className="text-right font-semibold px-4 py-2.5">P&L</th>
                  <th className="text-right font-semibold px-4 py-2.5">Win Rate</th>
                  <th className="text-right font-semibold px-4 py-2.5">{t("reportPf") || "Profit Factor"}</th>
                  <th className="text-left font-semibold px-4 py-2.5">{t("reportStatusCol") || "Status"}</th>
                  <th className="text-right font-semibold px-4 py-2.5">{t("actions") || "Akcje"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((report) => {
                  const pf = profitFactorFromTrades(
                    tradesInPeriod(trades, report.period_start, report.period_end)
                  );
                  const done = report.status !== "draft";
                  return (
                    <tr key={report.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-2.5 font-medium">{reportPeriodLabel(report, language)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{reportTypeCol(report.report_type, t)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{report.trades_count ?? "—"}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${toNum(report.result_r) >= 0 ? "text-profit" : "text-loss"}`}>
                        {formatR(report.result_r)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatPct(report.win_rate)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{pf == null ? "—" : pf.toFixed(2)}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-profit" : "bg-warning"}`} />
                          {done ? (t("reportStatusDone") || "Zakończony") : (t("reportDraft") || "Szkic")}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openReport(report)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openReport(report)}>
                                {t("reportView") || "Zobacz raport"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(report);
                                  setFormType(report.report_type);
                                  setView("form");
                                }}
                              >
                                {t("reportEdit") || "Edytuj raport"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("reportChooseType") || "Wybierz typ raportu"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {[
              { type: "weekly", label: t("reportWeekly") || "Raport tygodniowy" },
              { type: "monthly", label: t("reportMonthly") || "Raport miesięczny" },
              { type: "quarterly", label: t("reportQuarterly") || "Raport kwartalny" },
              { type: "yearly", label: t("reportYearly") || "Raport roczny" },
            ].map((item) => (
              <Button
                key={item.type}
                variant="outline"
                className="justify-start h-12"
                onClick={() => openNew(item.type)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("reportCompare") || "Porównaj okresy"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {comparePair.map((report) => (
              <button
                key={report.id}
                type="button"
                className="rounded-lg border border-border bg-muted/20 p-3 text-left hover:bg-muted/40"
                onClick={() => {
                  setCompareOpen(false);
                  openReport(report);
                }}
              >
                <p className="text-xs text-muted-foreground">{reportTypeLabel(report.report_type, t)}</p>
                <p className="text-sm font-medium mt-1">{reportPeriodLabel(report, language)}</p>
                <p className={`text-lg font-medium tabular-nums mt-2 ${toNum(report.result_r) >= 0 ? "text-profit" : "text-loss"}`}>
                  {formatR(report.result_r)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">WR {formatPct(report.win_rate)}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
