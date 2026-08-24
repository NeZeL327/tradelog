import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Edit, Trash2, FileEdit } from "lucide-react";
import ReportScreenshots from "./ReportScreenshots";
import { reportPeriodLabel, reportTypeLabel } from "@/lib/reports";

function Block({ title, children }) {
  if (!children && children !== 0) return null;
  const text = typeof children === "string" ? children.trim() : children;
  if (!text) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="text-base leading-relaxed text-foreground whitespace-pre-wrap">{text}</div>
    </section>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-center">
      <p className={`text-2xl font-bold tabular-nums ${accent || "text-foreground"}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

export default function ReportArticle({
  report,
  language,
  t,
  onBack,
  onEdit,
  onDelete,
  onToggleStatus,
}) {
  if (!report) return null;

  const resultR = report.result_r;
  const resultLabel =
    resultR == null || resultR === ""
      ? "—"
      : `${Number(resultR) >= 0 ? "+" : ""}${Number(resultR).toFixed(1)}R`;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t("back") || "Wróć"}
        </Button>
        <div className="flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          <Edit className="w-4 h-4 mr-1" />
          {t("edit") || "Edytuj"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onToggleStatus}>
          <FileEdit className="w-4 h-4 mr-1" />
          {report.status === "draft"
            ? (t("reportPublish") || "Opublikuj")
            : (t("reportToDraft") || "Ustaw jako szkic")}
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="w-4 h-4 mr-1" />
          {t("delete") || "Usuń"}
        </Button>
      </div>

      <header className="space-y-3 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            {reportTypeLabel(report.report_type, t)}
          </Badge>
          {report.status === "draft" && (
            <Badge variant="outline">{t("reportDraft") || "Szkic"}</Badge>
          )}
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {reportPeriodLabel(report, language)}
        </h1>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat
          label={t("reportResultR") || "Wynik"}
          value={resultLabel}
          accent={Number(resultR) > 0 ? "text-emerald-600" : Number(resultR) < 0 ? "text-rose-600" : undefined}
        />
        <Stat label={t("reportTradesCount") || "Trejdy"} value={report.trades_count ?? "—"} />
        <Stat label="Win Rate" value={report.win_rate != null && report.win_rate !== "" ? `${report.win_rate}%` : "—"} />
        <Stat label={t("reportRating") || "Ocena"} value={report.rating ? `${report.rating}/10` : "—"} />
      </div>

      {(report.best_week || report.worst_week || report.best_month || report.worst_month || report.best_quarter || report.worst_quarter) && (
        <Card>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {report.best_week && <p><span className="text-muted-foreground">{t("reportBestWeek")}: </span>{report.best_week}</p>}
            {report.worst_week && <p><span className="text-muted-foreground">{t("reportWorstWeek")}: </span>{report.worst_week}</p>}
            {report.best_month && <p><span className="text-muted-foreground">{t("reportBestMonth")}: </span>{report.best_month}</p>}
            {report.worst_month && <p><span className="text-muted-foreground">{t("reportWorstMonth")}: </span>{report.worst_month}</p>}
            {report.best_quarter && <p><span className="text-muted-foreground">{t("reportBestQuarter")}: </span>{report.best_quarter}</p>}
            {report.worst_quarter && <p><span className="text-muted-foreground">{t("reportWorstQuarter")}: </span>{report.worst_quarter}</p>}
          </CardContent>
        </Card>
      )}

      <div className="space-y-8">
        <Block title={t("reportReflection") || "Jak oceniam swój trading?"}>{report.reflection}</Block>
        <Block title={t("reportWhatWentWell") || "Co zrobiłem dobrze?"}>{report.what_went_well}</Block>
        <Block title={t("reportMistakes") || "Błędy"}>{report.mistakes}</Block>
        <Block title={t("reportMental") || "Mental"}>{report.mental}</Block>
        <Block title={t("reportProgress") || "Progres"}>{report.progress}</Block>
        <Block title={t("reportTradingChanges") || "Zmiany w tradingu"}>{report.trading_changes}</Block>
        {report.key_lesson && (
          <section className="rounded-xl border border-primary/25 bg-primary/5 p-5 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
              🎯 {t("reportKeyLesson") || "Najważniejsza lekcja"}
            </h2>
            <p className="text-lg leading-relaxed font-medium whitespace-pre-wrap">{report.key_lesson}</p>
          </section>
        )}
        <Block title={t("reportImproveNext") || "Plan na następny okres"}>{report.improve_next}</Block>
      </div>

      {Array.isArray(report.screenshots) && report.screenshots.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            📷 {t("reportScreenshots") || "Screeny"}
          </h2>
          <ReportScreenshots images={report.screenshots} readOnly t={t} />
        </section>
      )}
    </div>
  );
}
