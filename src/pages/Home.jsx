import { useEffect, useState } from "react";
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, ShieldCheck, TrendingUp, BarChart3, Brain, Target } from "lucide-react";
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
        <div className="animate-spin w-12 h-12 border-4 border-lime-400 border-t-transparent rounded-full"></div>
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
                <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">
                  <span className="logo-arrow w-5 h-5 rounded-md">
                    <span className="logo-arrow-path" />
                    <span className="logo-arrow-shape"><span className="logo-arrow-letter-text">A</span></span>
                    <span className="logo-arrow-tip"><span className="logo-arrow-letter-text">I</span></span>
                    <span className="logo-arrow-wave" />
                  </span>
                  AiKeepTrade
                </span>

                <h1 className="text-5xl md:text-6xl xl:text-7xl font-extrabold leading-[1.02] tracking-tight text-white">
                  AiKeepTrade<br />
                  <span className="fx-brand-text">{t('homeSubtitle')}</span>
                </h1>

                <p className="max-w-2xl text-xl leading-relaxed text-slate-300/90">
                  {t('homeDescription')}
                </p>

                <div className="flex flex-wrap gap-3">
                  {homeCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <span key={card.title} className="inline-flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-slate-200">
                        <Icon className="w-4 h-4 text-sky-300" />
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

                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-sky-400" /> {t('homeSecureLogin')}</span>
                  <span className="text-slate-600">•</span>
                  <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-sky-400" /> {t('homeAccessTo')}</span>
                  <span className="text-slate-600">•</span>
                  <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-sky-400" /> {t('pricingNoCreditCard')}</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.12 }}
                className="fx-card-dark p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-slate-100 tracking-tight">{t('liveStats')}</h3>
                  <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">{t('liveStats')}</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/8 bg-[#07090d]/70 p-4">
                    <p className="text-xs uppercase tracking-wider text-slate-500">{t('winRate')}</p>
                    <p className="mt-1 text-2xl font-bold text-sky-300">{t('homeFeatureAnalysisTitle')}</p>
                    <p className="mt-1 text-sm text-slate-300/90">{t('homeFeatureAnalysisSubtitle')}</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-[#07090d]/70 p-4">
                    <p className="text-xs uppercase tracking-wider text-slate-500">{t('totalPL')}</p>
                    <p className="mt-1 text-2xl font-bold text-sky-300">{t('homeFeatureJournalTitle')}</p>
                    <p className="mt-1 text-sm text-slate-300/90">{t('homeFeatureJournalSubtitle')}</p>
                  </div>
                  <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-4">
                    <p className="text-xs uppercase tracking-wider font-semibold text-sky-300">{t('pricingFeature1Title')}</p>
                    <p className="mt-1 text-lg font-bold text-slate-100">{t('pricingFeature1Desc')}</p>
                    <p className="mt-2 text-sm text-sky-300/80">{t('homeFeatureAnalysisSubtitle')}</p>
                  </div>
                  <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-4">
                    <p className="text-xs uppercase tracking-wider font-semibold text-sky-300">{t('pricingFeature3Title')}</p>
                    <p className="mt-1 text-lg font-bold text-slate-100">{t('pricingFeature3Desc')}</p>
                    <p className="mt-2 text-sm text-sky-300/80">{t('homeFeatureStrategiesSubtitle')}</p>
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
                <span className="inline-flex rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">Features</span>
                <h2 className="mt-5 text-4xl md:text-5xl font-extrabold tracking-tight text-slate-100">{t('pricingWhyChoose')}</h2>
                <p className="mt-4 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">{t('pricingCTADesc')}</p>
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
                      className="fx-card-dark p-7 hover:border-blue-500/30 transition-colors"
                    >
                      <div className="mb-5 inline-flex rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-sky-300">
                        <Icon className="w-6 h-6" />
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight text-slate-100 leading-tight">{item.title}</h3>
                      <p className="mt-3 text-base leading-relaxed text-slate-400">{item.text}</p>
                    </motion.article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="py-20 md:py-24">
            <div className="container mx-auto px-4">
              <div className="mx-auto max-w-5xl text-center">
                <span className="inline-flex rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">AiKeepTrade</span>
                <h2 className="mt-5 text-4xl md:text-5xl font-extrabold tracking-tight text-slate-100">{t('pricingTitle')}</h2>
                <p className="mt-4 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">{t('pricingSubtitle')}</p>
              </div>

              <div className="mt-12 grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
                <div className="fx-card-dark p-7">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-base text-slate-300">{t('pricingPlanDesc')}</p>
                    <span className="shrink-0 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-sky-300">
                      {t('pricing14DayTrial')}
                    </span>
                  </div>

                  <div className="mt-5 flex items-end gap-2">
                    <p className="text-5xl font-extrabold tracking-tight text-slate-100">$9.9</p>
                    <p className="pb-1 text-base text-slate-500">/ {t('pricingPerMonth')}</p>
                  </div>

                  <div className="mt-6 rounded-xl border border-white/5 bg-[#07090d]/60 p-4">
                    <ul className="space-y-2 text-sm text-slate-300">
                      <li className="inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-sky-400" /> {t('pricingInclude1')}</li>
                      <li className="inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-sky-400" /> {t('pricingInclude2')}</li>
                      <li className="inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-sky-400" /> {t('pricingInclude3')}</li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => window.location.href = createPageUrl("Register")}
                    className="fx-cta mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base"
                  >
                    {t('pricingStartTrial')}
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-sky-300">
                    <CheckCircle2 className="w-4 h-4" /> {t('pricingNoCreditCard')}
                  </p>
                </div>

                <div>
                  <span className="inline-flex rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">{t('pricingBadge')}</span>
                  <h3 className="mt-4 text-4xl md:text-5xl font-extrabold tracking-tight text-slate-100 leading-[1.05]">{t('pricingCTATitle')}</h3>
                  <p className="mt-5 text-lg md:text-xl text-slate-400 leading-relaxed">{t('pricingCTADesc')}</p>

                  <ul className="mt-6 space-y-3 text-base text-slate-300">
                    <li className="inline-flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-sky-400" /> {t('pricingInclude1')}</li>
                    <li className="inline-flex items-center gap-2"><TrendingUp className="w-5 h-5 text-sky-400" /> {t('pricingInclude2')}</li>
                    <li className="inline-flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-sky-400" /> {t('pricingInclude3')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
      <Footer variant="hero" />
    </div>
  );
}