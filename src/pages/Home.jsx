import { useEffect, useState } from "react";
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, ShieldCheck, TrendingUp, Activity, BookOpen, Layers } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import PublicNavbar from "@/components/PublicNavbar";
import Footer from "@/components/Footer";
import AnimatedPublicBackground from "@/components/AnimatedPublicBackground";
import TradingWallpaper from "@/components/TradingWallpaper";
import LiveCard from "@/components/LiveCard";
import AnimatedFeatureIcon from "@/components/AnimatedFeatureIcon";
import { featureCardVariants } from "./homeFeatureCardVariants";

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
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const homeCards = [
    {
      icon: Activity,
      title: t('homeFeatureAnalysisTitle'),
      text: t('homeFeatureAnalysisSubtitle')
    },
    {
      icon: BookOpen,
      title: t('homeFeatureJournalTitle'),
      text: t('homeFeatureJournalSubtitle')
    },
    {
      icon: Layers,
      title: t('homeFeatureStrategiesTitle'),
      text: t('homeFeatureStrategiesSubtitle')
    }
  ];

  return (
    <>
      <PublicNavbar variant="hero" />
      <div className="market-home public-trading-bg use-trading-wallpaper min-h-screen pt-24">
        <div className="market-chart-bg" aria-hidden="true" />
        <TradingWallpaper />
        <AnimatedPublicBackground />

        <main className="relative z-10">
          <section className="container mx-auto px-4 py-10 md:py-16">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
              <motion.div
                initial={{ opacity: 0, x: -56 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="space-y-6"
              >
                <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300">
                  <span className="logo-arrow w-5 h-5 rounded-md">
                    <span className="logo-arrow-path" />
                    <span className="logo-arrow-shape"><span className="logo-arrow-letter-text">A</span></span>
                    <span className="logo-arrow-tip"><span className="logo-arrow-letter-text">I</span></span>
                    <span className="logo-arrow-wave" />
                  </span>
                  AiKeepTrade
                </span>

                <h1 className="text-5xl md:text-6xl xl:text-7xl font-extrabold leading-[1.04] text-white overflow-hidden">
                  <span className="inline-flex flex-wrap" aria-label="AiKeepTrade">
                    {'AiKeepTrade'.split('').map((letter, i) => (
                      <motion.span
                        key={`${letter}-${i}`}
                        initial={{ opacity: 0, y: 28 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.15 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                        className="inline-block"
                        style={{ transformOrigin: 'bottom' }}
                      >
                        {letter === ' ' ? '\u00A0' : letter}
                      </motion.span>
                    ))}
                  </span>
                  <br />
                  <motion.span
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="hero-subtitle-shine inline-block mt-1"
                  >
                    {t('homeSubtitle')}
                  </motion.span>
                </h1>

                <p className="max-w-2xl text-xl leading-relaxed text-slate-300">
                  {t('homeDescription')}
                </p>

                <div className="flex flex-wrap gap-3">
                  {homeCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <span key={card.title} className="inline-flex items-center gap-2.5 rounded-xl border border-slate-700/80 bg-slate-900/75 px-4 py-2.5 text-sm text-slate-200">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-400/20">
                          <Icon className="w-4 h-4 text-emerald-400" strokeWidth={1.9} />
                        </span>
                        {card.title}
                      </span>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-4 pt-1">
                  <span className="btn-shine-wrap inline-flex rounded-xl shadow-lg shadow-blue-500/30 transition-transform hover:-translate-y-0.5">
                    <span className="btn-shine" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => window.location.href = createPageUrl("Register")}
                      className="relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 px-7 py-4 text-xl font-bold text-white"
                    >
                      {t('pricingGetStarted')}
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </span>
                  <span className="btn-shine-wrap inline-flex rounded-xl">
                    <span className="btn-shine" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => window.location.href = createPageUrl("Login")}
                      className="relative inline-flex items-center gap-2 rounded-xl border-2 border-slate-600 bg-slate-900/75 px-7 py-4 text-xl font-bold text-slate-100 transition-colors hover:bg-slate-800/75"
                    >
                      {t('homeLoginButton')}
                    </button>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                  <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t('homeSecureLogin')}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t('homeAccessTo')}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t('pricingNoCreditCard')}</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 56 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
                className="rounded-3xl border border-slate-700/75 bg-slate-900/70 p-5 shadow-xl backdrop-blur-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-3xl font-bold text-slate-100">{t('liveStats')}</h3>
                  <span className="rounded-full bg-emerald-500 px-3 py-1 text-sm font-semibold text-white">{t('liveStats')}</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                    <p className="text-sm text-slate-400">{t('winRate')}</p>
                    <p className="text-3xl font-bold text-emerald-300">{t('homeFeatureAnalysisTitle')}</p>
                    <p className="text-sm text-slate-300">{t('homeFeatureAnalysisSubtitle')}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                    <p className="text-sm text-slate-400">{t('totalPL')}</p>
                    <p className="text-3xl font-bold text-emerald-300">{t('homeFeatureJournalTitle')}</p>
                    <p className="text-sm text-slate-300">{t('homeFeatureJournalSubtitle')}</p>
                  </div>
                  <div className="rounded-xl border border-blue-500/45 bg-blue-500/10 p-4">
                    <p className="text-sm font-semibold text-blue-200">{t('pricingFeature1Title')}</p>
                    <p className="mt-1 text-xl font-bold text-slate-100">{t('pricingFeature1Desc')}</p>
                    <p className="mt-2 text-sm text-emerald-300">{t('homeFeatureAnalysisSubtitle')}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/45 bg-emerald-500/10 p-4">
                    <p className="text-sm font-semibold text-emerald-200">{t('pricingFeature3Title')}</p>
                    <p className="mt-1 text-xl font-bold text-slate-100">{t('pricingFeature3Desc')}</p>
                    <p className="mt-2 text-sm text-emerald-300">{t('homeFeatureStrategiesSubtitle')}</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          <section id="features" className="scroll-mt-24 bg-slate-950/75 py-16 md:py-20">
            <div className="container mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5 }}
                className="mx-auto max-w-4xl text-center"
              >
                <h2 className="text-5xl md:text-6xl font-extrabold text-slate-100">{t('pricingWhyChoose')}</h2>
                <p className="mt-4 text-2xl text-slate-400">{t('pricingCTADesc')}</p>
              </motion.div>

              <div className="mt-12 grid gap-6 md:grid-cols-3">
                {homeCards.map((item, index) => {
                  const Icon = item.icon;
                  const v = featureCardVariants[index];
                  return (
                    <motion.div
                      key={item.title}
                      initial={v.initial}
                      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.55, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
                      whileHover={v.hover}
                      className="h-full"
                    >
                      <LiveCard variant="main" className="h-full">
                    <article
                      className="feature-card-live feature-card-live-main rounded-2xl border border-slate-700 bg-slate-900/80 p-7 shadow-lg backdrop-blur-sm transition-colors hover:border-emerald-500/30 h-full"
                    >
                      <AnimatedFeatureIcon
                        icon={Icon}
                        variant="main"
                        size="lg"
                        className="mb-5"
                        iconAnimation={v.icon}
                      />
                      <h3 className="text-4xl font-bold text-slate-100 leading-tight">{item.title}</h3>
                      <p className="mt-4 text-xl leading-relaxed text-slate-400">{item.text}</p>
                      <motion.div
                        className="mt-5 h-0.5 w-12 rounded-full bg-gradient-to-r from-emerald-400 to-transparent"
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                        style={{ transformOrigin: 'left' }}
                      />
                    </article>
                      </LiveCard>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="py-16 md:py-20">
            <div className="container mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5 }}
                className="mx-auto max-w-5xl text-center"
              >
                <span className="inline-flex rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-300">AiKeepTrade</span>
                <h2 className="mt-5 text-5xl md:text-6xl font-extrabold text-slate-100">{t('pricingTitle')}</h2>
                <p className="mt-4 text-2xl text-slate-400">{t('pricingSubtitle')}</p>
              </motion.div>

              <div className="mt-12 grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
                <motion.div
                  initial={{ opacity: 0, x: -64 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                  className="h-full"
                >
                  <LiveCard variant="main" className="h-full">
                  <div className="feature-card-live feature-card-live-main rounded-3xl border border-slate-700 bg-slate-900/70 p-6 md:p-7 shadow-lg backdrop-blur-sm h-full"
                  >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg text-slate-300">{t('pricingPlanDesc')}</p>
                    <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                      {t('pricing14DayTrial')}
                    </span>
                  </div>

                  <div className="mt-5 flex items-end gap-2">
                    <p className="text-5xl font-extrabold tracking-tight text-slate-100">$9.9</p>
                    <p className="pb-1 text-lg text-slate-400">/ {t('pricingPerMonth')}</p>
                  </div>

                  <div className="mt-6 rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                    <ul className="space-y-2 text-sm text-slate-300">
                      <li className="inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t('pricingInclude1')}</li>
                      <li className="inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t('pricingInclude2')}</li>
                      <li className="inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> {t('pricingInclude3')}</li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => window.location.href = createPageUrl("Register")}
                    className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 px-6 py-3 text-lg font-bold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-blue-700 transition-colors"
                  >
                    {t('pricingStartTrial')}
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" /> {t('pricingNoCreditCard')}
                  </p>
                  </div>
                  </LiveCard>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 64 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.55, delay: 0.1, ease: 'easeOut' }}
                >
                  <motion.span
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                    className="inline-flex rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-300"
                  >
                    {t('pricingBadge')}
                  </motion.span>
                  <motion.h3
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-4 text-5xl font-extrabold text-slate-100 leading-tight"
                  >
                    {t('pricingCTATitle')}
                  </motion.h3>
                  <motion.p
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: 0.25 }}
                    className="mt-5 text-2xl text-slate-400 leading-relaxed"
                  >
                    {t('pricingCTADesc')}
                  </motion.p>

                  <ul className="mt-6 space-y-3 text-xl text-slate-300">
                    <li className="inline-flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" /> {t('pricingInclude1')}</li>
                    <li className="inline-flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-400" /> {t('pricingInclude2')}</li>
                    <li className="inline-flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> {t('pricingInclude3')}</li>
                  </ul>
                </motion.div>
              </div>
            </div>
          </section>
        </main>
      </div>
      <Footer variant="hero" />
    </>
  );
}