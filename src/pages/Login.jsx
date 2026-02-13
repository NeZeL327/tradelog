import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, LogIn, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/components/LanguageProvider';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    const prevSkin = root.getAttribute('data-skin');
    root.classList.add('dark');
    root.setAttribute('data-skin', 'blackblu');

    return () => {
      if (!hadDark) {
        root.classList.remove('dark');
      }
      if (prevSkin) {
        root.setAttribute('data-skin', prevSkin);
      } else {
        root.removeAttribute('data-skin');
      }
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(formData.email, formData.password);
      toast.success(t('loginSuccess'));
      navigate('/Dashboard');
    } catch (error) {
      console.error('Login error:', error);
      const errorMap = {
        'Nieprawidłowy email lub hasło': t('loginInvalidCredentials'),
        'Invalid email or password': t('loginInvalidCredentials')
      };
      setError(errorMap[error.message] || t('loginError'));
    } finally {
      setIsLoading(false);
    }
  };

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
      className="parallax-root min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-6 overflow-hidden relative"
      style={/** @type {any} */ ({ '--px': parallax.x, '--py': parallax.y })}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LanguageToggle />
      </div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="hero-grid parallax-layer parallax-layer-slow" />
        <div className="hero-stars parallax-layer" />
        <div className="hero-trail" />
        <div className="hero-vignette" />
        <div className="parallax-layer parallax-layer-fast">
          <motion.div
            className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"
            animate={{ scale: [1, 1.25, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <div className="parallax-layer">
          <motion.div
            className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.2, 0.3] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <div className="parallax-layer parallax-layer-slow">
          <motion.div
            className="absolute top-1/4 right-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-2xl"
            animate={{ y: [0, -20, 0], opacity: [0.25, 0.5, 0.25] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <div className="parallax-layer">
          <motion.div
            className="absolute bottom-12 left-24 w-36 h-36 border border-emerald-400/20 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 38, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        <div className="parallax-layer parallax-layer-fast">
          <motion.div
            className="absolute top-24 right-1/3 w-56 h-56 border border-blue-500/20 rounded-full"
            animate={{ rotate: -360 }}
            transition={{ duration: 44, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      </div>

      <div className="relative z-10 w-full max-w-5xl grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center md:text-left"
        >
          <div className="inline-flex items-center justify-center mb-6 md:justify-start">
            <div className="logo-arrow hero-logo w-20 h-20 rounded-2xl">
              <span className="logo-arrow-path" />
              <span className="logo-arrow-shape"><span className="logo-arrow-letter-text">T</span></span>
              <span className="logo-arrow-tip"><span className="logo-arrow-letter-text">L</span></span>
              <span className="logo-arrow-wave" />
            </div>
          </div>
          <h1 className="hero-title premium-title text-5xl md:text-6xl font-bold bg-gradient-to-r from-emerald-300 to-blue-400 bg-clip-text text-transparent mb-3">
            TRADE LOG
          </h1>
          <p className="premium-subtitle text-lg text-slate-200 mb-2">{t('loginWelcomeTitle')}</p>
          <p className="text-slate-400 text-sm max-w-md md:max-w-lg">{t('loginWelcomeDescription')}</p>
          <div className="hero-signal mt-6 mx-auto md:mx-0" />

          <div className="mt-8 grid grid-cols-3 gap-3 max-w-sm md:max-w-md mx-auto md:mx-0">
            <motion.div
              className="hero-feature hero-feature-blue hero-feature-neon"
              animate={{ y: [0, -8, 0], rotate: [0, 1.2, 0] }}
              transition={{ duration: 5.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="hero-feature-icon">📊</div>
              <p className="hero-feature-title">{t('homeFeatureAnalysisTitle')}</p>
              <p className="hero-feature-sub">{t('homeFeatureAnalysisSubtitle')}</p>
            </motion.div>
            <motion.div
              className="hero-feature hero-feature-cyan hero-feature-neon"
              animate={{ y: [0, -10, 0], rotate: [0, -1.4, 0] }}
              transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="hero-feature-icon">📝</div>
              <p className="hero-feature-title">{t('homeFeatureJournalTitle')}</p>
              <p className="hero-feature-sub">{t('homeFeatureJournalSubtitle')}</p>
            </motion.div>
            <motion.div
              className="hero-feature hero-feature-indigo hero-feature-neon"
              animate={{ y: [0, -7, 0], rotate: [0, 1, 0] }}
              transition={{ duration: 5.1, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="hero-feature-icon">🎯</div>
              <p className="hero-feature-title">{t('homeFeatureStrategiesTitle')}</p>
              <p className="hero-feature-sub">{t('homeFeatureStrategiesSubtitle')}</p>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="hero-card border border-slate-800/60 bg-slate-950/70 shadow-2xl shadow-blue-500/10 backdrop-blur-sm">
            <CardHeader className="text-center space-y-2">
              <CardTitle className="text-2xl font-bold text-white">{t('loginTitle')}</CardTitle>
              <CardDescription className="text-slate-400">{t('loginSubtitle')}</CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">{t('loginEmailLabel')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder={t('loginEmailPlaceholder')}
                      value={formData.email}
                      onChange={handleInputChange}
                      className="auth-input pl-10 bg-slate-950/40 border-slate-800 text-slate-100 placeholder:text-slate-500"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-200">{t('loginPasswordLabel')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder={t('loginPasswordPlaceholder')}
                      value={formData.password}
                      onChange={handleInputChange}
                      className="auth-input pl-10 bg-slate-950/40 border-slate-800 text-slate-100 placeholder:text-slate-500"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="hero-cta hero-cta-pulse w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-2.5 shadow-lg shadow-blue-500/30"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('loginLoading')}
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      {t('loginButton')}
                    </>
                  )}
                </Button>

                  <div className="pt-2 text-center text-sm text-slate-400">
                    {t('loginNoAccount')} <button type="button" onClick={() => navigate('/Register')} className="text-emerald-300 hover:text-emerald-200 underline">{t('loginRegisterLink')}</button>
                  </div>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="auth-separator-line" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-950 px-2 text-slate-500">
                      {t('loginSeparator')}
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="w-full border-slate-800 bg-slate-950/40 text-slate-100 hover:bg-slate-900/60"
                    onClick={() => toast.info(t('loginGoogleSoon'))}
                  >
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full border-slate-800 bg-slate-950/40 text-slate-100 hover:bg-slate-900/60"
                    onClick={() => toast.info(t('loginMicrosoftSoon'))}
                  >
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                      <path fill="#F25022" d="M1 1h10v10H1z"/>
                      <path fill="#00A4EF" d="M12 1h10v10H12z"/>
                      <path fill="#7FBA00" d="M1 12h10v10H1z"/>
                      <path fill="#FFB900" d="M12 12h10v10H12z"/>
                    </svg>
                    Microsoft
                  </Button>
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-slate-400">
                  {t('loginNoAccount')}{' '}
                  <button
                    onClick={() => navigate('/Register')}
                    className="text-emerald-300 hover:text-emerald-200 font-medium"
                  >
                    {t('loginRegisterLink')}
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}