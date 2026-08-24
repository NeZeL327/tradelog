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
import { Plus, FileText, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/components/LanguageProvider";
import ReportForm from "@/components/reports/ReportForm";
import ReportArticle from "@/components/reports/ReportArticle";
import { reportPeriodLabel, reportTypeLabel } from "@/lib/reports";

const TYPE_TABS = [
  { key: "all", labelKey: "reportFilterAll" },
  { key: "weekly", labelKey: "reportWeekly" },
  { key: "monthly", labelKey: "reportMonthly" },
  { key: "quarterly", labelKey: "reportQuarterly" },
  { key: "yearly", labelKey: "reportYearly" },
];

function ReportRow({ report, language, t, onOpen }) {
  const resultR = report.result_r;
  const resultLabel =
    resultR == null || resultR === ""
      ? "—"
      : `${Number(resultR) >= 0 ? "+" : ""}${Number(resultR).toFixed(1)}R`;
  const lesson = String(report.key_lesson || "").trim();
  const snippet = lesson.length > 80 ? `${lesson.slice(0, 80)}…` : lesson;

  return (
    <button
      type="button"
      onClick={() => onOpen(report)}
      className="w-full text-left px-3.5 py-2.5 flex items-center gap-3 hover:bg-muted/40 transition-colors border-b border-border/50 last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {reportTypeLabel(report.report_type, t)}
          </span>
          {report.status === "draft" && (
            <Badge variant="outline" className="h-5 text-[10px] px-1.5">{t("reportDraft") || "Szkic"}</Badge>
          )}
          <span className="text-sm font-medium text-foreground truncate">
            {reportPeriodLabel(report, language)}
          </span>
        </div>
        {snippet ? (
          <p className="text-xs text-muted-foreground truncate mt-0.5">„{snippet}”</p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">
            {report.trades_count != null ? `${report.trades_count} trejdów` : "—"}
            {report.win_rate != null && report.win_rate !== "" ? ` · ${report.win_rate}% WR` : ""}
            {report.rating ? ` · ${report.rating}/10` : ""}
          </p>
        )}
      </div>
      <span
        className={`text-sm font-bold tabular-nums shrink-0 ${
          Number(resultR) > 0
            ? "text-emerald-600"
            : Number(resultR) < 0
              ? "text-rose-600"
              : "text-muted-foreground"
        }`}
      >
        {resultLabel}
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

export default function Raporty() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [typeFilter, setTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [view, setView] = useState("list"); // list | form | article
  const [formType, setFormType] = useState("weekly");
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

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

  const tabReports = (key) => {
    if (key === "all") return filtered;
    return filtered.filter((r) => r.report_type === key);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
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
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="cyber-page-title">{t("reportsTitle") || "Raporty tradingowe"}</h1>
          <p className="cyber-page-sub">
            {t("reportsSubtitle") || "Podsumowanie mojego tradingu, procesu, błędów i rozwoju."}
          </p>
        </div>
        <Button className="cyber-primary-btn w-full sm:w-auto" onClick={() => setTypeDialogOpen(true)}>
          <Plus className="w-5 h-5 mr-2" />
          {t("reportAdd") || "Dodaj raport"}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setTypeFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                typeFilter === tab.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(tab.labelKey) || tab.key}
            </button>
          ))}
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
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

      {/* Type sections when "all" */}
      {typeFilter === "all" ? (
        <div className="space-y-5">
          {["weekly", "monthly", "quarterly", "yearly"].map((type) => {
            const items = tabReports(type);
            return (
              <section key={type} className="space-y-1.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
                  {reportTypeLabel(type, t)}
                  <span className="text-muted-foreground/60 font-normal ml-1.5">{items.length}</span>
                </h2>
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 py-2">
                    {t("reportEmptyType") || "Brak raportów w tej kategorii."}
                  </p>
                ) : (
                  <div className="rounded-xl border border-border/70 bg-card/70 overflow-hidden">
                    {items.map((r) => (
                      <ReportRow
                        key={r.id}
                        report={r}
                        language={language}
                        t={t}
                        onOpen={(rep) => {
                          setSelected(rep);
                          setView("article");
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center space-y-3">
          <FileText className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t("reportEmpty") || "Nie masz jeszcze raportów. Dodaj pierwszy."}
          </p>
          <Button variant="outline" size="sm" onClick={() => setTypeDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t("reportAdd") || "Dodaj raport"}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border/70 bg-card/70 overflow-hidden">
          {filtered.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              language={language}
              t={t}
              onOpen={(rep) => {
                setSelected(rep);
                setView("article");
              }}
            />
          ))}
        </div>
      )}

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
    </div>
  );
}
