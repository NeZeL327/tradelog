import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, TrendingUp, Shield, BarChart3, Brain, Target } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';

export default function Pricing() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const features = [
    { icon: BarChart3, title: t('pricingFeature1Title'), desc: t('pricingFeature1Desc') },
    { icon: Brain, title: t('pricingFeature2Title'), desc: t('pricingFeature2Desc') },
    { icon: Target, title: t('pricingFeature3Title'), desc: t('pricingFeature3Desc') },
    { icon: TrendingUp, title: t('pricingFeature4Title'), desc: t('pricingFeature4Desc') },
    { icon: Shield, title: t('pricingFeature5Title'), desc: t('pricingFeature5Desc') },
    { icon: Zap, title: t('pricingFeature6Title'), desc: t('pricingFeature6Desc') },
  ];

  return (
    <>
      <PublicNavbar />
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 pt-24 pb-16">
        {/* Hero Section */}
        <div className="container mx-auto px-6 py-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-4 bg-gradient-to-r from-emerald-500 to-blue-600 text-white border-0">
              {t('pricingBadge')}
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              {t('pricingTitle')}
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-8">
              {t('pricingSubtitle')}
            </p>
          </motion.div>

          {/* Pricing Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-lg mx-auto mb-16"
          >
            <Card className="border-2 border-blue-500/50 bg-slate-900/80 backdrop-blur-sm shadow-2xl">
              <CardHeader className="text-center pb-8">
                <div className="inline-block mx-auto mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                </div>
                <CardTitle className="text-3xl text-white mb-2">Trade Log Pro</CardTitle>
                <CardDescription className="text-slate-300 text-lg">
                  {t('pricingPlanDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pb-8">
                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-2 mb-2">
                    <span className="text-5xl font-bold text-white">$9.9</span>
                    <span className="text-slate-400 text-lg">/ {t('pricingPerMonth')}</span>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                    {t('pricing14DayTrial')}
                  </Badge>
                </div>

                <div className="space-y-3 pt-4">
                  <div className="flex items-start gap-3 text-slate-200">
                    <Check className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{t('pricingInclude1')}</span>
                  </div>
                  <div className="flex items-start gap-3 text-slate-200">
                    <Check className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{t('pricingInclude2')}</span>
                  </div>
                  <div className="flex items-start gap-3 text-slate-200">
                    <Check className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{t('pricingInclude3')}</span>
                  </div>
                  <div className="flex items-start gap-3 text-slate-200">
                    <Check className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{t('pricingInclude4')}</span>
                  </div>
                  <div className="flex items-start gap-3 text-slate-200">
                    <Check className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{t('pricingInclude5')}</span>
                  </div>
                  <div className="flex items-start gap-3 text-slate-200">
                    <Check className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>{t('pricingInclude6')}</span>
                  </div>
                </div>

                <Button
                  onClick={() => navigate('/register')}
                  className="w-full h-12 text-lg bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700"
                  size="lg"
                >
                  {t('pricingStartTrial')}
                </Button>

                <p className="text-center text-sm text-slate-400">
                  {t('pricingNoCreditCard')}
                </p>
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
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-12">
              {t('pricingWhyChoose')}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                  >
                    <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-700/50 h-full hover:border-blue-500/50 transition-all">
                      <CardContent className="p-6">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-600/20 flex items-center justify-center mb-4">
                          <Icon className="w-6 h-6 text-blue-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                        <p className="text-slate-400 text-sm">{feature.desc}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-center"
          >
            <h2 className="text-3xl font-bold text-white mb-6">
              {t('pricingCTATitle')}
            </h2>
            <p className="text-slate-300 text-lg mb-8 max-w-2xl mx-auto">
              {t('pricingCTADesc')}
            </p>
            <Button
              onClick={() => navigate('/register')}
              size="lg"
              className="h-14 px-8 text-lg bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700"
            >
              {t('pricingGetStarted')}
            </Button>
          </motion.div>
        </div>
      </div>
      <Footer />
    </>
  );
}
