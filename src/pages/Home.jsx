import React, { useEffect, useState } from "react";
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import LanguageToggle from "@/components/LanguageToggle";
import { useLanguage } from "@/components/LanguageProvider";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setParallax({ x, y });
  };

  const handleMouseLeave = () => {
    setParallax({ x: 0, y: 0 });
  };

  return (
    <div
      className="parallax-root min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex flex-col items-center justify-center p-4 overflow-hidden relative"
      style={/** @type {any} */ ({ '--px': parallax.x, '--py': parallax.y })}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="hero-grid parallax-layer parallax-layer-slow" />
        <div className="hero-stars parallax-layer" />
        <div className="hero-trail" />
        <div className="hero-vignette" />
        <div className="parallax-layer parallax-layer-fast">
          <motion.div
            className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
        <div className="parallax-layer">
          <motion.div
            className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.3, 0.2, 0.3],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
        <div className="parallax-layer parallax-layer-slow">
          <motion.div
            className="absolute top-1/4 right-24 w-56 h-56 border border-blue-500/20 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <div className="parallax-layer parallax-layer-fast">
          <motion.div
            className="absolute bottom-16 left-1/3 w-36 h-36 border border-emerald-400/20 rounded-full"
            animate={{ rotate: -360 }}
            transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 text-center mb-12 max-w-2xl"
      >
        <div className="inline-flex items-center justify-center mb-6">
          <div className="logo-arrow hero-logo w-20 h-20 rounded-2xl">
            <span className="logo-arrow-path" />
              <span className="logo-arrow-shape"><span className="logo-arrow-letter-text">T</span></span>
              <span className="logo-arrow-tip"><span className="logo-arrow-letter-text">L</span></span>
            <span className="logo-arrow-wave" />
          </div>
        </div>
        <h1 className="hero-title premium-title text-6xl md:text-7xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent mb-4">
          TRADE LOG
        </h1>
        <p className="premium-subtitle text-lg text-slate-200 mb-2">{t('homeSubtitle')}</p>
        <p className="text-slate-400 text-sm max-w-md mx-auto">{t('homeDescription')}</p>
        <div className="hero-signal mt-6 mx-auto" />
      </motion.div>

      {/* Login Button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="relative z-10 w-full max-w-sm"
      >
        <motion.button
          onClick={() => window.location.href = '/Login'}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="hero-cta hero-cta-pulse w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-blue-500/40 transition-all flex items-center justify-center gap-2 text-lg"
        >
          {t('homeLoginButton')}
          <ArrowRight className="w-5 h-5" />
        </motion.button>

        <p className="text-center text-slate-400 text-sm mt-6">
          {t('homeSecureLogin')}
        </p>
        <p className="text-center text-slate-400 text-sm mt-2">
          {t('loginNoAccount')} <button type="button" onClick={() => window.location.href = '/Register'} className="text-emerald-300 hover:text-emerald-200 underline">{t('loginRegisterLink')}</button>
        </p>
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="mt-16 z-10 text-center"
      >
        <p className="text-slate-300 text-sm font-semibold mb-6">{t('homeAccessTo')}</p>
        <div className="grid grid-cols-3 gap-3">
          <motion.div
            className="hero-feature hero-feature-blue hero-feature-neon"
            animate={{ y: [0, -8, 0], rotate: [0, 1.2, 0] }}
            transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="hero-feature-icon">📊</div>
            <p className="hero-feature-title">{t('homeFeatureAnalysisTitle')}</p>
            <p className="hero-feature-sub">{t('homeFeatureAnalysisSubtitle')}</p>
          </motion.div>
          <motion.div
            className="hero-feature hero-feature-cyan hero-feature-neon"
            animate={{ y: [0, -10, 0], rotate: [0, -1.4, 0] }}
            transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="hero-feature-icon">📝</div>
            <p className="hero-feature-title">{t('homeFeatureJournalTitle')}</p>
            <p className="hero-feature-sub">{t('homeFeatureJournalSubtitle')}</p>
          </motion.div>
          <motion.div
            className="hero-feature hero-feature-indigo hero-feature-neon"
            animate={{ y: [0, -7, 0], rotate: [0, 1, 0] }}
            transition={{ duration: 5.1, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="hero-feature-icon">🎯</div>
            <p className="hero-feature-title">{t('homeFeatureStrategiesTitle')}</p>
            <p className="hero-feature-sub">{t('homeFeatureStrategiesSubtitle')}</p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}