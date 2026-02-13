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

  const handleSubscribe = async () => {
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
    <div className="min-h-screen px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t("billingTitle")}</h1>
          <p className="text-slate-600 dark:text-slate-400">{t("billingSubtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                {t("billingPlanFree")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant="secondary">{t("billingCurrent")}</Badge>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                <li>{t("billingFreeFeature1")}</li>
                <li>{t("billingFreeFeature2")}</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t("billingPlanPro")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant={isPremium ? "default" : "outline"}>
                {isPremium ? t("billingActive") : t("billingUpgrade")}
              </Badge>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                <li>{t("billingProFeature1")}</li>
                <li>{t("billingProFeature2")}</li>
                <li>{t("billingProFeature3")}</li>
              </ul>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleSubscribe} disabled={isPremium || isLoading}>
                  {t("billingSubscribe")}
                </Button>
                <Button variant="outline" onClick={handleManage} disabled={!user || isLoading}>
                  {t("billingManage")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle>{t("billingStatusTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 dark:text-slate-400">
            {isLoading ? t("billingLoading") : t("billingStatus", { status: subscription.status })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
