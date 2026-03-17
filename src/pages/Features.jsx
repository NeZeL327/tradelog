import { motion } from 'framer-motion';
import { Activity, BookOpen, Layers, TrendingUp, UsersRound, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import AnimatedPublicBackground from '@/components/AnimatedPublicBackground';
import TradingWallpaper from '@/components/TradingWallpaper';
import AnimatedFeatureIcon from '@/components/AnimatedFeatureIcon';
import { Card, CardContent } from '@/components/ui/card';
import LiveCard from '@/components/LiveCard';
import { createPageUrl } from '@/utils';
import { mainFeaturesVariants, moreFeaturesVariants } from './featuresCardVariants';

export default function Features() {
  const { t } = useLanguage();

  const mainFeatures = [
    {
      icon: Activity,
      title: t('homeFeatureAnalysisTitle'),
      description: t('homeFeatureAnalysisSubtitle'),
    },
    {
      icon: BookOpen,
      title: t('homeFeatureJournalTitle'),
      description: t('homeFeatureJournalSubtitle'),
    },
    {
      icon: Layers,
      title: t('homeFeatureStrategiesTitle'),
      description: t('homeFeatureStrategiesSubtitle'),
    },
  ];

  const moreFeatures = [
    {
      icon: Activity,
      title: 'Analiza transakcji',
      description: 'Śledź swoje wyniki i analizuj strategie handlowe',
    },
    {
      icon: TrendingUp,
      title: 'Statystyki w czasie rzeczywistym',
      description: 'Przegląd wydajności i postępów na bieżąco',
    },
    {
      icon: UsersRound,
      title: 'Wspólnota traderów',
      description: 'Dołącz do rosnącej społeczności profesjonalistów',
    },
  ];

  return (
    <>
      <PublicNavbar variant="hero" />
      <div className="public-trading-bg use-trading-wallpaper min-h-screen pt-24 pb-12 transition-colors duration-300 relative">
        <TradingWallpaper variant="lineChart" />
        <AnimatedPublicBackground />
        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          {/* Header */}
          <motion.section
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16 flex flex-col items-center justify-center overflow-visible"
            aria-labelledby="features-heading"
          >
            <div className="w-full max-w-3xl flex flex-col items-center text-center">
              <h1
                id="features-heading"
                className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-emerald-200 via-cyan-200 to-blue-300 bg-clip-text text-transparent pb-5 mb-4 drop-shadow-[0_0_20px_rgba(167,243,208,0.15)]"
              >
                {t('features') || 'Funkcje'}
              </h1>
              <p className="text-slate-300 text-lg max-w-xl leading-relaxed">
                Wszystko, czego potrzebujesz do prowadzenia dziennika handlowego — w jednym miejscu.
              </p>
            </div>
          </motion.section>

          {/* Main features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-20"
          >
            <h2 className="text-2xl font-semibold text-slate-100 text-center mb-8">
              Główne narzędzia
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {mainFeatures.map((feature, index) => {
                const Icon = feature.icon;
                const v = mainFeaturesVariants[index];
                return (
                  <motion.div
                    key={feature.title}
                    initial={v.initial}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <motion.div whileHover={v.hover} className="h-full">
                      <LiveCard variant="main" className="h-full">
                        <Card className="feature-card-live feature-card-live-main bg-slate-800/80 border-slate-800 hover:border-emerald-500/50 h-full overflow-hidden shadow-lg group">
                          <CardContent className="p-6 relative">
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-emerald-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                            <motion.div
                              className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
                              style={{ transformOrigin: 'left' }}
                            />
                            <AnimatedFeatureIcon
                              icon={Icon}
                              variant="main"
                              className="mb-4"
                              iconAnimation={v.icon}
                            />
                            <h3 className="relative text-xl font-semibold text-slate-100 mb-2">
                              {feature.title}
                            </h3>
                            <p className="relative text-slate-300">{feature.description}</p>
                          </CardContent>
                        </Card>
                      </LiveCard>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* More features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mb-16"
          >
            <h2 className="text-2xl font-semibold text-slate-100 text-center mb-8">
              Co jeszcze oferujemy
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {moreFeatures.map((feature, index) => {
                const Icon = feature.icon;
                const v = moreFeaturesVariants[index];
                return (
                  <motion.div
                    key={feature.title}
                    initial={v.initial}
                    animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.6 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <motion.div whileHover={v.hover} className="h-full">
                      <LiveCard variant="more" className="h-full">
                        <Card className="feature-card-live feature-card-live-more bg-slate-800/70 border-slate-800 hover:border-primary/50 h-full overflow-hidden shadow-lg group">
                          <CardContent className="p-6 relative">
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-blue-400/8 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                            <AnimatedFeatureIcon
                              icon={Icon}
                              variant="more"
                              className="mb-4"
                              iconAnimation={v.icon}
                            />
                            <h3 className="relative text-lg font-semibold text-slate-100 mb-2">
                              {feature.title}
                            </h3>
                            <p className="relative text-slate-400 text-sm">{feature.description}</p>
                          </CardContent>
                        </Card>
                      </LiveCard>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-center"
          >
            <LiveCard variant="main" className="max-w-2xl mx-auto">
            <Card className="feature-card-live feature-card-live-main bg-slate-800/80 border-emerald-500/40 max-w-2xl mx-auto">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-slate-100 mb-3">
                  Gotowy na start?
                </h2>
                <p className="text-slate-400 mb-6">
                  Załóż konto i korzystaj ze wszystkich funkcji. Bez karty kredytowej.
                </p>
                <a
                  href={createPageUrl('Register')}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-blue-700 transition-colors"
                >
                  {t('pricingGetStarted') || 'Zacznij za darmo'}
                  <ArrowRight className="w-5 h-5" />
                </a>
              </CardContent>
            </Card>
            </LiveCard>
          </motion.div>
        </div>
      </div>
      <Footer variant="hero" />
    </>
  );
}
