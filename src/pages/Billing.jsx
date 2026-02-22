import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/components/LanguageProvider";
import { cancelSubscription, createCheckoutSession, createPortalSession, syncCheckoutSession } from "@/lib/billing";
import { useSubscription } from "@/hooks/use-subscription";
import { toast } from "sonner";
import { CreditCard, ShieldCheck } from "lucide-react";

const priceId = import.meta.env.VITE_STRIPE_PRICE_ID;

export default function Billing() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isCancelling, setIsCancelling] = useState(false);
  const { subscription, isPremium, isLoading } = useSubscription(user?.id, user?.createdAt);
  const hasStripeCustomer = Boolean(subscription.customerId);
  const isCancellationScheduled = Boolean(subscription.cancelAtPeriodEnd);
  const trialEndsAt = subscription.trialEnd ? new Date(subscription.trialEnd * 1000) : null;
  const nextPaymentAt = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd * 1000) : null;
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
    : null;
  const showActiveSchedule = hasStripeCustomer && Boolean(subscription.subscriptionId) && ["trialing", "active"].includes(subscription.status);
  const showTrialEndedNotice = ["past_due", "incomplete", "unpaid", "trial_expired"].includes(subscription.status);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutState = params.get("checkout");
    const sessionId = params.get("session_id");

    if (checkoutState !== "success" || !sessionId || !user?.id) {
      return;
    }

    let isCancelled = false;

    const syncStatus = async () => {
      try {
        await syncCheckoutSession({ sessionId, userId: user.id });
      } catch (error) {
        if (!isCancelled) {
          toast.error(t("billingSyncError"));
        }
      } finally {
        if (!isCancelled) {
          const cleanedUrl = `${window.location.origin}${window.location.pathname}`;
          window.history.replaceState({}, "", cleanedUrl);
        }
      }
    };

    void syncStatus();

    return () => {
      isCancelled = true;
    };
  }, [user?.id, t]);

  const handleSubscribe = async () => {
    if (!priceId) {
      toast.error(t("billingMissingPrice"));
      return;
    }
    try {
      const { url } = await createCheckoutSession({
        priceId,
        successUrl: `${window.location.origin}/Billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/Billing?checkout=cancel`,
        customerEmail: user?.email || undefined,
        userId: user?.id || undefined
      });
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      toast.error(t("billingCheckoutError"));
    }
  };

  const handleManage = async () => {
    if (!user?.id) {
      toast.error(t("billingPortalError"));
      return;
    }
    try {
      const response = await createPortalSession({
        returnUrl: window.location.origin + "/Billing",
        userId: user.id
      });
      if (response?.url) {
        window.location.href = response.url;
      } else {
        toast.error(t("billingPortalError"));
      }
    } catch (error) {
      toast.error(t("billingPortalError"));
    }
  };

  const handleCancelSubscription = async () => {
    if (!user?.id) return;
    const shouldCancel = window.confirm(t("billingCancelConfirm"));
    if (!shouldCancel) return;

    setIsCancelling(true);
    try {
      await cancelSubscription({ userId: user.id });
      toast.success(t("billingCancelSuccess"));
    } catch (error) {
      toast.error(t("billingCancelError"));
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="min-h-screen p-2 sm:p-3">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t("billingTitle")}</h1>
          <p className="text-slate-600 dark:text-slate-400">{t("billingSubtitle")}</p>
        </div>

        <div className="max-w-xl mx-auto w-full">
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
                {subscription.status === "trialing" && (
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
                    {hasStripeCustomer ? (
                      <>
                        <Button variant="outline" onClick={handleManage} disabled={!user || isLoading} className="w-full">
                          {t("billingManage")}
                        </Button>
                        {!isCancellationScheduled && (
                          <Button
                            variant="destructive"
                            onClick={handleCancelSubscription}
                            disabled={!user || isLoading || isCancelling}
                            className="w-full"
                          >
                            {isCancelling ? t("billingCancelling") : t("billingCancel")}
                          </Button>
                        )}
                        {isCancellationScheduled && (
                          <p className="text-center text-xs text-amber-600 dark:text-amber-300">
                            {t("billingCancellationScheduled")}
                          </p>
                        )}
                      </>
                    ) : (
                      <Button onClick={handleSubscribe} disabled={isLoading} className="w-full h-12 bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700">
                        {t("billingSubscribeNow")}
                      </Button>
                    )}
                  </>
                ) : (
                  <Button onClick={handleSubscribe} disabled={isLoading} className="w-full h-12 bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700">
                    {t("billingSubscribeNow")}
                  </Button>
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
            {showActiveSchedule && nextPaymentAt && (
              <div className="mb-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-200">
                {`${t("billingActiveNextPayment")} ${nextPaymentAt.toLocaleDateString()}`}
              </div>
            )}
            {!showActiveSchedule && subscription.status === "trialing" && trialEndsAt && (
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
