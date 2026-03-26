import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/components/LanguageProvider";
import { createCheckoutSession, createPortalSession } from "@/lib/billing";
import { useSubscription } from "@/hooks/use-subscription";
import { toast } from "sonner";
import {
  CreditCard, ShieldCheck, CheckCircle2, XCircle,
  Zap, BarChart2, BookOpen, Target, Download,
  Clock, AlertTriangle, Sparkles, ExternalLink, RefreshCw, FileJson
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataExport } from "@/hooks/use-data-export";

const priceId = import.meta.env.VITE_STRIPE_PRICE_ID;

const STATUS_CONFIG = {
  active:    { label: "Aktywna",     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700", dot: "bg-emerald-500", icon: CheckCircle2 },
  trialing:  { label: "Trial",       color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700", dot: "bg-emerald-400", icon: CheckCircle2 },
  past_due:  { label: "Zaległa",     color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300 dark:border-amber-700",             dot: "bg-amber-500",   icon: AlertTriangle },
  canceled:  { label: "Anulowana",   color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700",                         dot: "bg-red-500",     icon: XCircle },
  incomplete:{ label: "Niekompletna",color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700",                         dot: "bg-red-500",     icon: XCircle },
  unpaid:    { label: "Nieopłacona", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700",                         dot: "bg-red-500",     icon: XCircle },
  free:      { label: "Nieaktywna",  color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700",                         dot: "bg-red-500",     icon: XCircle },
};

const FEATURES = [
  { icon: BarChart2,   label: "Nieograniczony dziennik transakcji i analiza" },
  { icon: Zap,         label: "Zaawansowane wykresy i raporty wydajności" },
  { icon: Target,      label: "Własne setupy, tagi i cele tradingowe" },
  { icon: BookOpen,    label: "Notatki z szablonami tradingowymi i checklisty" },
  { icon: FileJson,    label: "Eksport danych (CSV, PDF, JSON) i backup w chmurze" },
  { icon: RefreshCw,   label: "Synchronizacja w czasie rzeczywistym na wszystkich urządzeniach" },
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

export default function Billing() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { subscription, isPremium, isLoading } = useSubscription(user?.id);
  const { exportAllData, isExporting } = useDataExport();
  const trialEligible = !subscription.customerId;
  const trialEndsAt = subscription.trialEnd ? new Date(subscription.trialEnd * 1000) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
    : null;
  const currentPeriodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd * 1000)
    : null;

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
    } catch {
      toast.error(t("billingCheckoutError"));
    }
  };

  const handleManage = async () => {
    try {
      const { url } = await createPortalSession({
        returnUrl: window.location.origin + "/Billing",
        userId: user?.id || undefined,
      });
      if (url) window.location.href = url;
    } catch {
      toast.error(t("billingPortalError"));
    }
  };

  const statusKey = subscription.status || "free";

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-slate-50 dark:bg-[#0f0f16]">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center pt-2 pb-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{t("billingTitle")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("billingSubtitle")}</p>
        </div>

        {/* Status banner */}
        <div className={cn(
          "flex items-center justify-between px-5 py-4 rounded-xl border",
          isPremium
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
            : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
        )}>
          <div className="flex items-center gap-3">
            {isPremium
              ? <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
              : <XCircle className="h-6 w-6 text-red-500 shrink-0" />
            }
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {isPremium ? "Subskrypcja aktywna" : "Brak aktywnej subskrypcji"}
              </p>
              {isPremium && currentPeriodEnd && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Odnawia się: {currentPeriodEnd.toLocaleDateString("pl-PL")}
                </p>
              )}
              {subscription.status === "trialing" && trialEndsAt && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Trial kończy się za {trialDaysLeft} dni ({trialEndsAt.toLocaleDateString("pl-PL")})
                </p>
              )}
              {!isPremium && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Aktywuj subskrypcję aby odblokować wszystkie funkcje
                </p>
              )}
            </div>
          </div>
          <StatusBadge status={statusKey} />
        </div>

        {/* Plan card */}
        <Card className={cn(
          "border-2 shadow-md",
          isPremium
            ? "border-emerald-400/60 dark:border-emerald-600/50"
            : "border-slate-200 dark:border-slate-700"
        )}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shrink-0">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">AiKeepTrade Pro</CardTitle>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t("billingPlanDesc")}</p>
                </div>
              </div>
              {/* Price */}
              <div className="text-right">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">$9.9</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">/ {t("billingPerMonth")}</span>
                </div>
                {trialEligible && !isPremium && (
                  <Badge className="mt-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs">
                    14 dni gratis
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <Icon className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-xs text-slate-600 dark:text-slate-400 leading-tight">{label}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="pt-2 space-y-2.5">
              {isPremium ? (
                <>
                  <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      {t("billingActive")}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleManage}
                    disabled={!user || isLoading}
                    className="w-full gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("billingManage")}
                  </Button>
                </>
              ) : (
                <>
                  {trialEligible ? (
                    <>
                      <Button
                        onClick={() => handleSubscribe(14)}
                        disabled={isLoading}
                        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        {t("billingStartTrial")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleSubscribe(0)}
                        disabled={isLoading}
                        className="w-full h-11 gap-2"
                      >
                        <CreditCard className="h-4 w-4" />
                        {t("billingSubscribeNow")}
                      </Button>
                      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
                        {t("billingTrialOnlyNew")}
                      </p>
                    </>
                  ) : (
                    <Button
                      onClick={() => handleSubscribe(0)}
                      disabled={isLoading}
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 gap-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      {t("billingSubscribeNow")}
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status details card */}
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              {t("billingStatusTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {subscription.status === "trialing" && trialEndsAt && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
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
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <span>{isLoading ? t("billingLoading") : `Status: ${statusKey}`}</span>
              {subscription.customerId && (
                <span className="font-mono text-[10px] opacity-60">{subscription.customerId.slice(0, 14)}…</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Backup & Export card */}
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileJson className="h-4 w-4 text-slate-400" />
              Eksport danych i kopia zapasowa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Twoje dane są automatycznie synchronizowane z chmurą Firestore w czasie rzeczywistym.
              Możesz też pobrać lokalną kopię zapasową wszystkich danych (transakcje, notatki, checklisty, konta, strategie, cele).
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 flex-1"
                disabled={!user || isExporting}
                onClick={() => exportAllData(user?.id)}
              >
                <Download className={cn("h-4 w-4", isExporting && "animate-bounce")} />
                {isExporting ? "Pobieranie..." : "Pobierz kopię zapasową (JSON)"}
              </Button>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-400">
                <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                Firestore — backup automatyczny
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
