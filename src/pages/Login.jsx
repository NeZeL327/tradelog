import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import LiveCard from '@/components/LiveCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, LogIn, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useLanguage } from '@/components/LanguageProvider';
import PublicNavbar from '@/components/PublicNavbar';
import Footer from '@/components/Footer';
import AnimatedPublicBackground from '@/components/AnimatedPublicBackground';
import TradingWallpaper from '@/components/TradingWallpaper';

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, loginWithApple } = useAuth();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null);
  const [error, setError] = useState('');
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

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
    } catch (err) {
      const errorMap = {
        'Nieprawidłowy email lub hasło': t('loginInvalidCredentials'),
        'Invalid email or password': t('loginInvalidCredentials'),
      };
      setError(errorMap[err.message] || t('loginError'));
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
    <>
      <PublicNavbar variant="hero" />
      <div
        className="parallax-root public-trading-bg use-trading-wallpaper min-h-screen flex items-center justify-center p-6 overflow-hidden relative pt-24"
        style={/** @type {any} */ ({ '--px': parallax.x, '--py': parallax.y })}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
      <TradingWallpaper variant="lineChart" />
      <AnimatedPublicBackground />

      <div className="relative z-10 w-full max-w-6xl px-4 sm:px-6 grid items-center gap-8 md:gap-12 md:grid-cols-[1.1fr_0.9fr]">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center md:text-left"
        >
          <div className="inline-flex items-center justify-center mb-6 md:justify-start">
            <div className="logo-arrow hero-logo w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex-shrink-0">
              <span className="logo-arrow-path" />
              <span className="logo-arrow-shape"><span className="logo-arrow-letter-text">A</span></span>
              <span className="logo-arrow-tip"><span className="logo-arrow-letter-text">I</span></span>
              <span className="logo-arrow-wave" />
            </div>
          </div>
          <h1 className="hero-title premium-title text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-emerald-300 to-blue-400 bg-clip-text text-transparent mb-3">
            AiKeepTrade
          </h1>
          <p className="premium-subtitle text-base sm:text-lg text-slate-200 mb-2">{t('loginWelcomeTitle')}</p>
          <p className="text-slate-400 text-sm max-w-md">{t('loginWelcomeDescription')}</p>
          <div className="hero-signal mt-6 mx-auto md:mx-0" />

          <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-3 max-w-sm mx-auto md:mx-0">
            <motion.div
              className="hero-feature hero-feature-blue hero-feature-neon"
              animate={{ y: [0, -8, 0], rotate: [0, 1.2, 0] }}
              transition={{ duration: 5.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="hero-feature-icon text-lg sm:text-2xl">📊</div>
              <p className="hero-feature-title text-xs sm:text-sm">{t('homeFeatureAnalysisTitle')}</p>
              <p className="hero-feature-sub text-xs">{t('homeFeatureAnalysisSubtitle')}</p>
            </motion.div>
            <motion.div
              className="hero-feature hero-feature-cyan hero-feature-neon"
              animate={{ y: [0, -10, 0], rotate: [0, -1.4, 0] }}
              transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="hero-feature-icon text-lg sm:text-2xl">📝</div>
              <p className="hero-feature-title text-xs sm:text-sm">{t('homeFeatureJournalTitle')}</p>
              <p className="hero-feature-sub text-xs">{t('homeFeatureJournalSubtitle')}</p>
            </motion.div>
            <motion.div
              className="hero-feature hero-feature-indigo hero-feature-neon"
              animate={{ y: [0, -7, 0], rotate: [0, 1, 0] }}
              transition={{ duration: 5.1, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="hero-feature-icon text-lg sm:text-2xl">🎯</div>
              <p className="hero-feature-title text-xs sm:text-sm">{t('homeFeatureStrategiesTitle')}</p>
              <p className="hero-feature-sub text-xs">{t('homeFeatureStrategiesSubtitle')}</p>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full"
        >
          <LiveCard variant="more">
          <Card className="feature-card-live feature-card-live-more hero-card border border-slate-800/60 bg-slate-950/70 shadow-2xl shadow-blue-500/10 backdrop-blur-sm">
            <CardHeader className="text-center space-y-2 pb-4">
              <CardTitle className="text-xl sm:text-2xl font-bold text-white">{t('loginTitle')}</CardTitle>
              <CardDescription className="text-sm text-slate-400">{t('loginSubtitle')}</CardDescription>
            </CardHeader>

            <CardContent className="px-4 sm:px-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="text-sm">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200 text-sm">{t('loginEmailLabel')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500 flex-shrink-0" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder={t('loginEmailPlaceholder')}
                      value={formData.email}
                      onChange={handleInputChange}
                      className="auth-input pl-10 bg-slate-950/40 border-slate-800 text-slate-100 placeholder:text-slate-500 text-sm"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-200 text-sm">{t('loginPasswordLabel')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500 flex-shrink-0" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder={t('loginPasswordPlaceholder')}
                      value={formData.password}
                      onChange={handleInputChange}
                      className="auth-input pl-10 bg-slate-950/40 border-slate-800 text-slate-100 placeholder:text-slate-500 text-sm"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="hero-cta hero-cta-pulse w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 text-white text-base font-bold shadow-lg shadow-emerald-500/25"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
                      <span className="text-sm">{t('loginLoading')}</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="text-sm">{t('loginButton')}</span>
                    </>
                  )}
                </Button>

                <div className="pt-2 text-center text-xs sm:text-sm text-slate-400">
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

                <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-slate-800 bg-slate-950/40 text-slate-100 hover:bg-slate-900/60 text-xs sm:text-sm h-9 disabled:opacity-70"
                    disabled={isLoading || oauthLoading !== null}
                    onClick={async () => {
                      setError('');
                      setOauthLoading('google');
                      try {
                        await loginWithGoogle();
                        toast.success(t('loginSuccess'));
                        navigate('/Dashboard');
                      } catch (err) {
                        setError(err.message || t('loginError'));
                        toast.error(err.message);
                      } finally {
                        setOauthLoading(null);
                      }
                    }}
                  >
                    {oauthLoading === 'google' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-1 sm:mr-2 flex-shrink-0" />
                        <span className="hidden sm:inline">Przekierowujemy…</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span className="hidden sm:inline">Google</span>
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full border-slate-800 bg-slate-950/40 text-slate-100 hover:bg-slate-900/60 text-xs sm:text-sm h-9 disabled:opacity-70"
                    disabled={isLoading || oauthLoading !== null}
                    onClick={async () => {
                      setError('');
                      setOauthLoading('apple');
                      try {
                        await loginWithApple();
                        toast.success(t('loginSuccess'));
                        navigate('/Dashboard');
                      } catch (err) {
                        setError(err.message || t('loginError'));
                        toast.error(err.message);
                      } finally {
                        setOauthLoading(null);
                      }
                    }}
                  >
                    {oauthLoading === 'apple' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-1 sm:mr-2 flex-shrink-0" />
                        <span className="hidden sm:inline">Przekierowujemy…</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-1 sm:mr-2 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                        </svg>
                        <span className="hidden sm:inline">Apple</span>
                      </>
                    )}
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
          </LiveCard>
        </motion.div>
      </div>
      </div>
      <Footer variant="hero" />
    </>
  );
}