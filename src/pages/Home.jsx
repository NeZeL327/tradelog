import { useEffect, useState } from "react";
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, BarChart3, Brain, Target } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import PublicNavbar from "@/components/PublicNavbar";
import Footer from "@/components/Footer";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated) {
        window.location.href = createPageUrl("Dashboard");
        return;
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="public-trading-bg min-h-screen flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const homeCards = [
    {
      icon: BarChart3,
      title: t('homeFeatureAnalysisTitle'),
      text: t('homeFeatureAnalysisSubtitle')
    },
    {
      icon: Brain,
      title: t('homeFeatureJournalTitle'),
      text: t('homeFeatureJournalSubtitle')
    },
    {
      icon: Target,
      title: t('homeFeatureStrategiesTitle'),
      text: t('homeFeatureStrategiesSubtitle')
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar variant="hero" />
      <div className="market-home public-trading-bg flex-1 flex flex-col pt-24">
        <div className="market-chart-bg" aria-hidden="true" />

        <main className="relative z-10">
          <section className="container mx-auto px-4 py-10 md:py-16">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
                className="space-y-6"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                  <img
                    src="/aikeeptrade-icon-hires.png"
                    alt=""
                    width="20"
                    height="20"
                    className="w-5 h-5 object-contain"
                  />
                  AiKeepTrade
                </span>

                <h1 className="text-3xl sm:text-5xl md:text-6xl xl:text-7xl font-extrabold leading-[1.05] sm:leading-[1.02] tracking-tight text-white">
                  AiKeepTrade<br />
                  <span className="fx-brand-text">{t('homeSubtitle')}</span>
                </h1>

                <p className="max-w-2xl text-base sm:text-lg md:text-xl leading-relaxed text-white/70">
                  {t('homeDescription')}
                </p>

                <div className="flex flex-wrap gap-3">
                  {homeCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <span key={card.title} className="inline-flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white/80">
                        <Icon className="w-4 h-4 text-primary" />
                        {card.title}
                      </span>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => window.location.href = createPageUrl("Register")}
                    className="fx-cta inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base"
                  >
                    {t('pricingGetStarted')}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => window.location.href = createPageUrl("Login")}
                    className="fx-cta-outline inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold"
                  >
                    {t('homeLoginButton')}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-white/55">
                  <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> {t('homeSecureLogin')}</span>
                  <span className="text-white/25">•</span>
                  <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> {t('homeAccessTo')}</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.12 }}
                className="fx-card-dark p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-white tracking-tight">{t('liveStats')}</h3>
                  <span className="rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">{t('liveStats')}</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/8 bg-[#07090d]/70 p-4">
                    <p className="text-xs uppercase tracking-wider text-white/40">{t('winRate')}</p>
                    <p className="mt-1 text-2xl font-bold text-white">{t('homeFeatureAnalysisTitle')}</p>
                    <p className="mt-1 text-sm text-white/70">{t('homeFeatureAnalysisSubtitle')}</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-[#07090d]/70 p-4">
                    <p className="text-xs uppercase tracking-wider text-white/40">{t('totalPL')}</p>
                    <p className="mt-1 text-2xl font-bold text-white">{t('homeFeatureJournalTitle')}</p>
                    <p className="mt-1 text-sm text-white/70">{t('homeFeatureJournalSubtitle')}</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-[#07090d]/70 p-4">
                    <p className="text-xs uppercase tracking-wider font-semibold text-white/55">{t('pricingFeature1Title')}</p>
                    <p className="mt-1 text-lg font-bold text-white">{t('pricingFeature1Desc')}</p>
                    <p className="mt-2 text-sm text-white/55">{t('homeFeatureAnalysisSubtitle')}</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-[#07090d]/70 p-4">
                    <p className="text-xs uppercase tracking-wider font-semibold text-white/55">{t('pricingFeature3Title')}</p>
                    <p className="mt-1 text-lg font-bold text-white">{t('pricingFeature3Desc')}</p>
                    <p className="mt-2 text-sm text-white/55">{t('homeFeatureStrategiesSubtitle')}</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          <section id="features" className="bg-[#06080c]/85 py-20 md:py-24 border-y border-white/5">
            <div className="container mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5 }}
                className="mx-auto max-w-4xl text-center"
              >
                <span className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Features</span>
                <h2 className="mt-5 text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight text-white">{t('pricingWhyChoose')}</h2>
                <p className="mt-4 text-base sm:text-lg md:text-xl text-white/55 max-w-2xl mx-auto">{t('pricingCTADesc')}</p>
              </motion.div>

              <div className="mt-12 grid gap-5 md:grid-cols-3">
                {homeCards.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.article
                      key={item.title}
                      initial={{ opacity: 0, y: 18 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.25 }}
                      transition={{ duration: 0.45, delay: index * 0.06 }}
                      className="fx-card-dark p-7 hover:border-primary/30 transition-colors"
                    >
                      <div className="mb-5 inline-flex rounded-md border border-white/10 bg-white/[0.04] p-3 text-primary">
                        <Icon className="w-6 h-6" />
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight text-white leading-tight">{item.title}</h3>
                      <p className="mt-3 text-base leading-relaxed text-white/55">{item.text}</p>
                    </motion.article>
                  );
                })}
              </div>
            </div>
          </section>

        </main>
      </div>
      <Footer variant="hero" />
    </div>
  );
}