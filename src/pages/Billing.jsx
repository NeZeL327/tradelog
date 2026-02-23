import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/components/LanguageProvider";
import { createCheckoutSession, createPortalSession } from "@/lib/billing";
import { useSubscription } from "@/hooks/use-subscription";
import { toast } from "sonner";
import { CreditCard, ShieldCheck } from "lucide-react";

const priceId = import.meta.env.VITE_STRIPE_PRICE_ID;

export default function Billing() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { subscription, isPremium, isLoading } = useSubscription(user?.id);
  const trialEligible = !subscription.customerId;
  const trialEndsAt = subscription.trialEnd ? new Date(subscription.trialEnd * 1000) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
    : null;
  const showTrialEndedNotice = ["past_due", "incomplete", "unpaid"].includes(subscription.status);

  const handleSubscribe = async (trialDays) => {
    if (!priceId) {
      toast.error(t("billingMissingPrice"));
      return;
    }
    try {
      const { url } = await createCheckoutSession({
        priceId,
        successUrl: window.location.origin + "/Billing",
        cancelUrl: window.location.origin + "/Billing",
        customerEmail: user?.email || undefined,
        userId: user?.id || undefined,
        trialDays: trialDays || 0
      });
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      toast.error(t("billingCheckoutError"));
    }
  };

  const handleManage = async () => {
    try {
      const { url } = await createPortalSession({
        returnUrl: window.location.origin + "/Billing",
        userId: user?.id || undefined
      });
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      toast.error(t("billingPortalError"));
    }
  };

  return (
    <div className="min-h-screen p-2 sm:p-3">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t("billingTitle")}</h1>
          <p className="text-slate-600 dark:text-slate-400">{t("billingSubtitle")}</p>
        </div>

        <div className="max-w-2xl mx-auto w-full">
          <Card className="border-2 border-blue-500/50 dark:border-blue-400/50 shadow-lg">
            <CardHeader className="text-center">
              <div className="inline-block mx-auto mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
                  <CreditCard className="h-8 w-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl">Trade Log Pro</CardTitle>
              <p className="text-slate-600 dark:text-slate-400">{t("billingPlanDesc")}</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex items-baseline justify-center gap-2 mb-2">
                  <span className="text-4xl font-bold text-slate-900 dark:text-white">$9.9</span>
                  <span className="text-slate-600 dark:text-slate-400">/ {t("billingPerMonth")}</span>
                </div>
                {trialEligible && (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
                    {t("billing14DayTrial")}
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">{t("billingIncluded")}</h3>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {t("billingProFeature1")}
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {t("billingProFeature2")}
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {t("billingProFeature3")}
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {t("billingProFeature4")}
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {t("billingProFeature5")}
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {t("billingProFeature6")}
                  </li>
                </ul>
              </div>

              <div className="space-y-3 pt-4">
                {isPremium ? (
                  <>
                    <Badge variant="default" className="w-full justify-center py-2">
                      {t("billingActive")}
                    </Badge>
                    <Button variant="outline" onClick={handleManage} disabled={!user || isLoading} className="w-full">
                      {t("billingManage")}
                    </Button>
                  </>
                ) : (
                  <>
                    {trialEligible ? (
                      <>
                        <Button onClick={() => handleSubscribe(14)} disabled={isLoading} className="w-full h-12 bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700">
                          {t("billingStartTrial")}
                        </Button>
                        <Button variant="outline" onClick={() => handleSubscribe(0)} disabled={isLoading} className="w-full h-12">
                          {t("billingSubscribeNow")}
                        </Button>
                        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                          {t("billingTrialOnlyNew")}
                        </p>
                      </>
                    ) : (
                      <Button onClick={() => handleSubscribe(0)} disabled={isLoading} className="w-full h-12 bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700">
                        {t("billingSubscribeNow")}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle>{t("billingStatusTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-400">
            {subscription.status === "trialing" && trialEndsAt && (
              <div className="mb-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-200">
                {trialDaysLeft !== null
                  ? `${t("billingTrialEndsOn")} ${trialEndsAt.toLocaleDateString()} (${trialDaysLeft} dni)`
                  : `${t("billingTrialEndsOn")} ${trialEndsAt.toLocaleDateString()}`}
              </div>
            )}
            {showTrialEndedNotice && (
              <div className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
                {t("billingTrialEnded")}
              </div>
            )}
            {isLoading ? t("billingLoading") : t("billingStatus", { status: subscription.status })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
