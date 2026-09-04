import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Check, Zap, TrendingUp, Shield, BarChart3, Brain, Target,
  Sparkles, Clock, CreditCard, ArrowRight, Lock, X,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/components/LanguageProvider';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import { createCheckoutSession } from '@/lib/billing';
import { toast } from 'sonner';

const PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID;

export default function Pricing() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);

  const features = [
    { icon: BarChart3, title: t('pricingFeature1Title'), desc: t('pricingFeature1Desc') },
    { icon: Brain,     title: t('pricingFeature2Title'), desc: t('pricingFeature2Desc') },
    { icon: Target,    title: t('pricingFeature3Title'), desc: t('pricingFeature3Desc') },
    { icon: TrendingUp,title: t('pricingFeature4Title'), desc: t('pricingFeature4Desc') },
    { icon: Shield,    title: t('pricingFeature5Title'), desc: t('pricingFeature5Desc') },
    { icon: Zap,       title: t('pricingFeature6Title'), desc: t('pricingFeature6Desc') },
  ];

  const handleStartTrial = async () => {
    if (!isAuthenticated) {
      navigate('/register?redirect=pricing');
      return;
    }
    if (!PRICE_ID) {
      toast.error('Brak konfiguracji Stripe (VITE_STRIPE_PRICE_ID)');
      return;
    }
    setLoading(true);
    try {
      const { url } = await createCheckoutSession({
        priceId: PRICE_ID,
        successUrl: window.location.origin + '/Billing?success=1',
        cancelUrl: window.location.origin + '/pricing',
        customerEmail: user?.email || undefined,
        userId: user?.id || undefined,
        trialDays: 14,
      });
      if (url) {
        window.location.href = url;
      } else {
        toast.error('Nie udało się utworzyć sesji płatności');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Błąd połączenia ze Stripe — spróbuj ponownie');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar variant="hero" />
      <div className="public-trading-bg flex-1 flex flex-col pt-24 pb-16">

        {/* Hero Section */}
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 mb-5 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-sky-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              {t('pricing14DayTrial') || '14 dni za darmo'}
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold text-white mb-5 tracking-tight leading-[1.1]">
              {t('pricingTitle')}
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-3 px-2">
              {t('pricingSubtitle')}
            </p>
            <p className="text-sm sm:text-base text-sky-300/80 max-w-xl mx-auto px-2">
              {t('pricingNoCreditCard') || 'Bez karty kredytowej. Anuluj w każdej chwili.'}
            </p>
          </motion.div>

          {/* Pricing Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-xl mx-auto mt-10 mb-16"
          >
            <Card className="relative overflow-hidden border-2 border-blue-500/40 bg-gradient-to-b from-slate-900/95 via-slate-900/85 to-slate-950/95 backdrop-blur-md shadow-[0_20px_60px_-15px_rgba(59,130,246,0.45)]">

              {/* Top ribbon */}
              <div className="absolute top-0 inset-x-0 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 text-center py-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-white drop-shadow-sm">
                  Najpopularniejszy plan • 14 dni gratis
                </span>
              </div>

              <CardContent className="pt-12 pb-8 px-6 sm:px-8 space-y-6">

                {/* Plan name */}
                <div className="text-center pt-2">
                  <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 items-center justify-center mb-3 shadow-lg shadow-blue-500/30">
                    <Zap className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">AiKeepTrade Pro</h2>
                  <p className="text-slate-400 text-sm sm:text-base mt-1">
                    {t('pricingPlanDesc')}
                  </p>
                </div>

                {/* Trial highlight box */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-emerald-300 font-bold text-sm sm:text-base">
                        14 dni pełnego dostępu — bez opłat
                      </p>
                      <p className="text-emerald-300/70 text-xs sm:text-sm mt-0.5">
                        Zapłacisz dopiero po okresie próbnym. Możesz anulować w każdej chwili.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="text-center pt-2 pb-4 border-y border-white/5 py-5">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-2xl text-slate-400 align-top">$</span>
                    <span className="text-5xl sm:text-6xl font-extrabold text-white tracking-tight">9.90</span>
                    <span className="text-lg text-slate-400 ml-1">/ {t('pricingPerMonth') || 'mies.'}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-2">
                    Po zakończeniu okresu próbnego — pełna kontrola nad subskrypcją
                  </p>
                </div>

                {/* Features list */}
                <div className="space-y-2.5">
                  {[
                    t('pricingInclude1'),
                    t('pricingInclude2'),
                    t('pricingInclude3'),
                    t('pricingInclude4'),
                    t('pricingInclude5'),
                    t('pricingInclude6'),
                  ].filter(Boolean).map((label, i) => (
                    <div key={i} className="flex items-start gap-3 text-slate-200 text-sm sm:text-base">
                      <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                        <Check className="w-3 h-3 text-emerald-400" strokeWidth={3} />
                      </span>
                      <span className="leading-snug">{label}</span>
                    </div>
                  ))}
                </div>

                {/* CTA button */}
                <div className="pt-2 space-y-3">
                  <Button
                    onClick={handleStartTrial}
                    disabled={loading}
                    size="lg"
                    className="hero-cta-pulse w-full h-14 rounded-xl fx-cta text-base sm:text-lg font-bold shadow-xl shadow-blue-500/30 disabled:opacity-70 group"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Przekierowuję do Stripe…
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        {isAuthenticated ? 'Aktywuj 14 dni za darmo' : (t('pricingStartTrial') || 'Rozpocznij 14 dni za darmo')}
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    )}
                  </Button>

                  {/* Trust row */}
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1.5"><Lock className="w-3 h-3 text-sky-400" /> Płatność przez Stripe</span>
                    <span className="text-slate-600 hidden sm:inline">•</span>
                    <span className="inline-flex items-center gap-1.5"><CreditCard className="w-3 h-3 text-sky-400" /> Karta dopiero po triale</span>
                    <span className="text-slate-600 hidden sm:inline">•</span>
                    <span className="inline-flex items-center gap-1.5"><X className="w-3 h-3 text-sky-400" /> Anuluj w każdej chwili</span>
                  </div>
                </div>

              </CardContent>
            </Card>
          </motion.div>

          {/* Why Choose Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-16"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3">
              {t('pricingWhyChoose')}
            </h2>
            <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto mb-10 px-2">
              {t('pricingCTADesc')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 + index * 0.08 }}
                  >
                    <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-700/50 h-full hover:border-blue-500/50 hover:bg-slate-900/80 transition-all group">
                      <CardContent className="p-5 sm:p-6 text-left">
                        <div className="w-11 h-11 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                          <Icon className="w-5 h-5 text-blue-400" />
                        </div>
                        <h3 className="text-base sm:text-lg font-semibold text-white mb-2">{feature.title}</h3>
                        <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{feature.desc}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* FAQ / Reassurance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="max-w-3xl mx-auto"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-left">
                <Shield className="w-5 h-5 text-sky-400 mb-2" />
                <p className="text-sm font-semibold text-white mb-1">Bezpieczna płatność</p>
                <p className="text-xs text-slate-400">Przetwarzane przez Stripe — TLS i PCI-DSS</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-left">
                <Clock className="w-5 h-5 text-sky-400 mb-2" />
                <p className="text-sm font-semibold text-white mb-1">14 dni testu</p>
                <p className="text-xs text-slate-400">Pełna funkcjonalność, bez kompromisów</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-left">
                <X className="w-5 h-5 text-sky-400 mb-2" />
                <p className="text-sm font-semibold text-white mb-1">Anuluj kiedy chcesz</p>
                <p className="text-xs text-slate-400">Jednym kliknięciem w ustawieniach</p>
              </div>
            </div>

            <Button
              onClick={handleStartTrial}
              disabled={loading}
              size="lg"
              className="hero-cta-pulse h-12 rounded-xl px-8 fx-cta text-base font-bold shadow-lg group"
            >
              <span className="inline-flex items-center gap-2">
                {isAuthenticated ? 'Aktywuj subskrypcję teraz' : (t('pricingGetStarted') || 'Rozpocznij za darmo')}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Button>
          </motion.div>
        </div>
      </div>
      <Footer variant="hero" />
    </div>
  );
}
