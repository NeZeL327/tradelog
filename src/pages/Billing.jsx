import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/components/LanguageProvider";
import { createCheckoutSession, createPortalSession } from "@/lib/billing";
import { useSubscription } from "@/hooks/use-subscription";
import { toast } from "sonner";
import {
  CreditCard, CheckCircle2, XCircle,
  Zap, BarChart2, BookOpen, Target, Download, Upload,
  Clock, AlertTriangle, Sparkles, ExternalLink, RefreshCw, FileJson,
  FileText, ChevronRight, Info, X, Eye, History, FileUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataExport } from "@/hooks/use-data-export";

const priceId = import.meta.env.VITE_STRIPE_PRICE_ID;

const STATUS_CONFIG = {
  active:     { label: "Aktywna",      color: "bg-profit/10 text-profit dark:bg-profit/10 dark:text-profit border-profit/30 dark:border-profit/30", dot: "bg-profit", icon: CheckCircle2 },
  trialing:   { label: "Trial",        color: "bg-profit/10 text-profit dark:bg-profit/10 dark:text-profit border-profit/30 dark:border-profit/30", dot: "bg-profit", icon: CheckCircle2 },
  past_due:   { label: "Zaległa",      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-700",             dot: "bg-amber-500",   icon: AlertTriangle },
  canceled:   { label: "Anulowana",    color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700",                         dot: "bg-loss",     icon: XCircle },
  incomplete: { label: "Niekompletna", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700",                         dot: "bg-loss",     icon: XCircle },
  unpaid:     { label: "Nieopłacona",  color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700",                         dot: "bg-loss",     icon: XCircle },
  free:       { label: "Nieaktywna",   color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700",                         dot: "bg-loss",     icon: XCircle },
};

const FEATURES = [
  { icon: BarChart2, label: "Nieograniczony dziennik transakcji i analiza" },
  { icon: Zap,       label: "Zaawansowane wykresy i raporty wydajności" },
  { icon: Target,    label: "Własne setupy, tagi i cele tradingowe" },
  { icon: BookOpen,  label: "Notatki z szablonami tradingowymi i checklisty" },
  { icon: FileJson,  label: "Eksport danych (CSV, JSON) i backup w chmurze" },
  { icon: RefreshCw, label: "Synchronizacja w czasie rzeczywistym na wszystkich urządzeniach" },
];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.free;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border", cfg.color)}>
      <span className={cn("w-2 h-2 rounded-full animate-pulse", cfg.dot)} />
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}

// ─── Import Preview Modal ─────────────────────────────────────────────────────
function ImportPreviewModal({ preview, onConfirm, onCancel, isImporting, FORMAT_LABELS }) {
  if (!preview) return null;
  const cols = ["date", "symbol", "direction", "quantity", "entry_price", "exit_price", "profit_loss"];
  const visibleRows = preview.rows.slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl shadow-lg border border-border w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-slate-900 dark:text-white">Podgląd importu</span>
            <Badge variant="secondary" className="text-xs">{FORMAT_LABELS[preview.format] || preview.format}</Badge>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-3 overflow-auto flex-1">
          <div className="flex items-center gap-2 p-3 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Znaleziono <strong>{preview.rows.length}</strong> transakcji w pliku &nbsp;
            <span className="font-mono">{preview.file?.name}</span>.
            Poniżej pierwsze 5 wierszy.
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr>
                  {cols.map((c) => (
                    <th key={c} className="px-2 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      {c.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {cols.map((c) => (
                      <td key={c} className="px-2 py-1.5 text-slate-700 dark:text-slate-300">
                        {row[c] || <span className="text-slate-400">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 5 && (
            <p className="text-xs text-slate-400 text-center">…i {preview.rows.length - 5} więcej wierszy</p>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onCancel} className="flex-1" disabled={isImporting}>Anuluj</Button>
          <Button
            onClick={onConfirm}
            disabled={isImporting || preview.rows.length === 0}
            className="flex-1 gap-2"
          >
            <Upload className="h-4 w-4" />
            {isImporting ? "Importowanie…" : `Importuj ${preview.rows.length} transakcji`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Billing() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { subscription, isPremium, isLoading } = useSubscription(user?.id);

  const {
    exportAllData, isExporting,
    exportTradesCSV, isExportingCSV,
    parseFileForPreview, clearPreview, commitImport,
    importPreview, isImporting,
    loadImportHistory, importHistory, isLoadingHistory,
    FORMAT_LABELS,
  } = useDataExport();

  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState("auto");
  const [showHistory, setShowHistory] = useState(false);

  const trialEligible = !subscription.customerId;
  const trialEndsAt = subscription.trialEnd ? new Date(subscription.trialEnd * 1000) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
    : null;
  const currentPeriodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd * 1000)
    : null;
  const statusKey = subscription.status || "free";

  // Load history on mount
  useEffect(() => { if (user?.id) loadImportHistory(user.id); }, [user?.id, loadImportHistory]);

  const handleSubscribe = async (trialDays) => {
    if (!priceId) { toast.error(t("billingMissingPrice")); return; }
    try {
      const { url } = await createCheckoutSession({
        priceId,
        successUrl: window.location.origin + "/Billing",
        cancelUrl: window.location.origin + "/Billing",
        customerEmail: user?.email || undefined,
        userId: user?.id || undefined,
        trialDays: trialDays || 0,
      });
      if (url) window.location.href = url;
    } catch { toast.error(t("billingCheckoutError")); }
  };

  const handleManage = async () => {
    try {
      const { url } = await createPortalSession({
        returnUrl: window.location.origin + "/Billing",
        userId: user?.id || undefined,
      });
      if (url) window.location.href = url;
    } catch { toast.error(t("billingPortalError")); }
  };

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.endsWith(".csv")) { toast.error("Wybierz plik CSV"); return; }
    try {
      await parseFileForPreview(file);
    } catch { toast.error("Nie udało się odczytać pliku"); }
  }, [parseFileForPreview]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleConfirmImport = async () => {
    const result = await commitImport(user?.id, importPreview);
    if (result?.success > 0) loadImportHistory(user?.id);
  };

  const formatHistoryDate = (dt) => {
    if (!dt) return "—";
    try { return new Date(dt).toLocaleString("pl-PL"); }
    catch { return dt; }
  };

  return (
    <div className="w-full min-h-0 dashboard-surface">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center pt-2 pb-2">
          <h1 className="cyber-page-title text-2xl">{t("billingTitle")}</h1>
          <p className="cyber-page-sub text-sm">{t("billingSubtitle")}</p>
        </div>

        {/* Status banner */}
        <div className={cn(
          "flex items-center justify-between px-5 py-4 rounded-xl border",
          isPremium
            ? "bg-profit/10 dark:bg-profit/10 border-profit/20 dark:border-profit/30"
            : "bg-loss/10 dark:bg-red-950/20 border-loss/20 dark:border-red-900"
        )}>
          <div className="flex items-center gap-3">
            {isPremium
              ? <CheckCircle2 className="h-6 w-6 text-profit shrink-0" />
              : <XCircle className="h-6 w-6 text-loss shrink-0" />
            }
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {isPremium ? "Subskrypcja aktywna" : "Brak aktywnej subskrypcji"}
              </p>
              {isPremium && currentPeriodEnd && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Odnawia się: {currentPeriodEnd.toLocaleDateString("pl-PL")}
                </p>
              )}
              {subscription.status === "trialing" && trialEndsAt && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Trial kończy się za {trialDaysLeft} dni ({trialEndsAt.toLocaleDateString("pl-PL")})
                </p>
              )}
              {!isPremium && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aktywuj subskrypcję aby odblokować wszystkie funkcje
                </p>
              )}
            </div>
          </div>
          <StatusBadge status={statusKey} />
        </div>

        {/* Plan card */}
        <Card className={cn("border shadow-none", isPremium ? "border-primary/50" : "border-border")}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-md bg-primary flex items-center justify-center shrink-0">
                  <CreditCard className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">AiKeepTrade Pro</CardTitle>
                  <p className="text-sm text-muted-foreground">{t("billingPlanDesc")}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">$9.9</span>
                  <span className="text-sm text-muted-foreground">/ {t("billingPerMonth")}</span>
                </div>
                {trialEligible && !isPremium && (
                  <Badge className="mt-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs">14 dni gratis</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30">
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-xs text-slate-600 dark:text-slate-400 leading-tight">{label}</span>
                </div>
              ))}
            </div>
            <div className="pt-2 space-y-2.5">
              {isPremium ? (
                <>
                  <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-profit/10 dark:bg-profit/10 border border-profit/20 dark:border-profit/30">
                    <CheckCircle2 className="h-4 w-4 text-profit" />
                    <span className="text-sm font-medium text-profit dark:text-profit">{t("billingActive")}</span>
                  </div>
                  <Button variant="outline" onClick={handleManage} disabled={!user || isLoading} className="w-full gap-2">
                    <ExternalLink className="h-4 w-4" />
                    {t("billingManage")}
                  </Button>
                </>
              ) : (
                <>
                  {trialEligible ? (
                    <>
                      <Button onClick={() => handleSubscribe(14)} disabled={isLoading} className="w-full h-12 text-base font-semibold fx-cta gap-2">
                        <Sparkles className="h-4 w-4" />
                        {t("billingStartTrial")}
                      </Button>
                      <Button variant="outline" onClick={() => handleSubscribe(0)} disabled={isLoading} className="w-full h-11 gap-2">
                        <CreditCard className="h-4 w-4" />
                        {t("billingSubscribeNow")}
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">{t("billingTrialOnlyNew")}</p>
                    </>
                  ) : (
                    <Button onClick={() => handleSubscribe(0)} disabled={isLoading} className="w-full h-12 text-base font-semibold fx-cta gap-2">
                      <CreditCard className="h-4 w-4" />
                      {t("billingSubscribeNow")}
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status details */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              {t("billingStatusTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {subscription.status === "trialing" && trialEndsAt && (
              <div className="flex items-center gap-2 rounded-lg border border-profit/30 bg-profit/10 dark:bg-profit/10 px-3 py-2.5 text-xs text-profit dark:text-profit">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {t("billingTrialEndsOn")} {trialEndsAt.toLocaleDateString("pl-PL")}
                {trialDaysLeft !== null && ` (${trialDaysLeft} dni)`}
              </div>
            )}
            {["past_due", "incomplete", "unpaid"].includes(subscription.status) && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {t("billingTrialEnded")}
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{isLoading ? t("billingLoading") : `Status: ${statusKey}`}</span>
              {subscription.customerId && (
                <span className="font-mono text-[10px] opacity-60">{subscription.customerId.slice(0, 14)}…</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Export Card ─────────────────────────────────────────────────── */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Download className="h-4 w-4 text-slate-400" />
              Eksport danych
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 animate-pulse">⚠ W budowie</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Pobierz swoje transakcje lub pełną kopię zapasową wszystkich danych
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* CSV export */}
              <button
                disabled={!user || isExportingCSV}
                onClick={() => exportTradesCSV(user?.id)}
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {isExportingCSV ? "Eksportowanie…" : "Eksport CSV"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Transakcje — gotowe do re-importu lub Excela</p>
                </div>
              </button>

              {/* JSON backup */}
              <button
                disabled={!user || isExporting}
                onClick={() => exportAllData(user?.id)}
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-muted/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-profit/10 dark:bg-profit/10 flex items-center justify-center shrink-0">
                  <FileJson className="h-4 w-4 text-profit" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {isExporting ? "Pobieranie…" : "Kopia zapasowa (JSON)"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Wszystkie dane: transakcje, notatki, konta…</p>
                </div>
              </button>
            </div>

            {/* Auto-backup info */}
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-profit/10 dark:bg-profit/10 border border-profit/20 dark:border-profit/30 text-xs text-profit dark:text-profit">
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              Backup automatyczny — Firestore synchronizuje dane w czasie rzeczywistym
            </div>
          </CardContent>
        </Card>

        {/* ─── Import Card ─────────────────────────────────────────────────── */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-slate-400" />
              Import transakcji
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 animate-pulse">⚠ W budowie</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Wczytaj transakcje z CSV — obsługujemy własny format, MT4/MT5 i TradingView
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Supported formats badges */}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(FORMAT_LABELS).map(([key, label]) => (
                <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-muted text-xs text-slate-600 dark:text-slate-400 border border-border">
                  <FileUp className="h-3 w-3" />
                  {label}
                </span>
              ))}
            </div>

            {/* Drag & drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
                dragOver
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/40 hover:bg-muted/50"
              )}
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <FileUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {dragOver ? "Upuść plik tutaj" : "Kliknij lub przeciągnij plik CSV"}
                </p>
                <p className="text-xs text-slate-400 mt-1">Format wykrywany automatycznie</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />

            {/* Format info */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Wymagane kolumny (własny format):</p>
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <code className="text-[11px] text-slate-600 dark:text-slate-400 break-all">
                  date, symbol, direction, quantity, entry_price, exit_price, profit_loss
                </code>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Pobierz szablon przez "Eksport CSV" — możesz go edytować i re-importować.
                </p>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* ─── Import History Card ─────────────────────────────────────────── */}
        <Card className="border-border">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowHistory((p) => !p)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-slate-400" />
                Historia importów
                {importHistory.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{importHistory.length}</Badge>
                )}
              </CardTitle>
              <ChevronRight className={cn("h-4 w-4 text-slate-400 transition-transform", showHistory && "rotate-90")} />
            </div>
          </CardHeader>

          {showHistory && (
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-6">
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              ) : importHistory.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Brak historii importów</p>
              ) : (
                <div className="space-y-2">
                  {importHistory.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 text-xs">
                      <div className="space-y-0.5">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {FORMAT_LABELS[item.format] || item.format}
                          <span className="ml-2 font-mono text-slate-400">{item.fileName}</span>
                        </p>
                        <p className="text-muted-foreground">{formatHistoryDate(item.importedAt)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="px-2 py-0.5 rounded-full bg-profit/10 dark:bg-profit/10 text-profit dark:text-profit">
                          ✓ {item.successRows}
                        </span>
                        {item.errorRows > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                            ✗ {item.errorRows}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

      </div>

      {/* ─── Import Preview Modal ───────────────────────────────────────────── */}
      <ImportPreviewModal
        preview={importPreview}
        onConfirm={handleConfirmImport}
        onCancel={clearPreview}
        isImporting={isImporting}
        FORMAT_LABELS={FORMAT_LABELS}
      />
    </div>
  );
}
