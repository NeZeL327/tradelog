import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, LogIn, Mail, Lock, Eye, EyeOff, BookOpen, Calendar, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageToggle from '@/components/LanguageToggle';
import AnimatedPublicBackground from '@/components/AnimatedPublicBackground';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Login() {
  const navigate = useNavigate();
  const { login, authError } = useAuth();
  const { t, language } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setParallax({ x, y });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = formData.email.trim().toLowerCase();
    const password = formData.password;

    if (!email || !password) {
      setError(t('loginInvalidCredentials'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
      toast.success(t('loginSuccess'));
      navigate('/Dashboard');
    } catch (err) {
      const errorMap = {
        'Nieprawidłowy email lub hasło': t('loginInvalidCredentials'),
        'Invalid email or password': t('loginInvalidCredentials'),
        'Nieprawidłowy email': t('loginInvalidCredentials'),
        'Konto jest zablokowane': t('loginError'),
        'Zbyt wiele prób. Spróbuj później.': t('loginError'),
      };
      setError(errorMap[err.message] || err.message || t('loginError'));
    } finally {
      setIsLoading(false);
    }
  };

  const visibleError = error || (authError?.type === 'login_error' ? authError.message : '');

  const journalItems = language === 'en'
    ? [
        { icon: BookOpen, label: 'Trade journal' },
        { icon: Calendar, label: 'Calendar' },
        { icon: BarChart3, label: 'Analytics' },
      ]
    : [
        { icon: BookOpen, label: 'Dziennik transakcji' },
        { icon: Calendar, label: 'Kalendarz' },
        { icon: BarChart3, label: 'Analityka' },
      ];

  return (
    <div
      className="auth-screen parallax-root relative flex min-h-full flex-col public-trading-bg overflow-x-hidden"
      style={{ '--px': parallax.x, '--py': parallax.y }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setParallax({ x: 0, y: 0 })}
    >
      <AnimatedPublicBackground />
      <div className="auth-orb auth-orb-a parallax-layer-fast" />
      <div className="auth-orb auth-orb-b parallax-layer-slow" />
      <div className="auth-orb auth-orb-c parallax-layer" />
      <div className="hero-stars pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-5">
        <motion.div
          className="flex items-center gap-2.5"
          initial="hidden"
          animate="show"
          variants={fadeUp}
          custom={0}
        >
          <img
            src="/aikeeptrade-icon-hires.png"
            alt="AiKeepTrade"
            width="32"
            height="32"
            className="h-8 w-8 object-contain"
          />
          <span className="text-base font-bold tracking-tight text-white">AiKeepTrade</span>
        </motion.div>
        <motion.div initial="hidden" animate="show" variants={fadeUp} custom={0.08}>
          <LanguageToggle variant="dark" />
        </motion.div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-8 py-8 lg:py-12">
        <div className="w-full max-w-5xl grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden lg:block space-y-6">
            <motion.h1
              className="text-4xl xl:text-5xl font-extrabold leading-[1.1] tracking-tight text-white"
              initial="hidden"
              animate="show"
              variants={fadeUp}
              custom={0.12}
            >
              AiKeepTrade
              <span className="block mt-1 text-2xl font-semibold text-white/70">
                {t('homeSubtitle')}
              </span>
            </motion.h1>

            <motion.svg
              viewBox="0 0 240 56"
              className="auth-spark w-56 h-14 text-primary"
              fill="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.6 }}
            >
              <path
                className="auth-spark-line"
                d="M2 42 C 28 40, 36 18, 58 22 C 82 27, 92 8, 118 14 C 142 20, 150 36, 176 24 C 198 14, 210 6, 238 10"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle className="auth-spark-dot" cx="238" cy="10" r="3.5" fill="currentColor" />
            </motion.svg>

            <ul className="space-y-2">
              {journalItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.li
                    key={item.label}
                    className="auth-journal-item flex items-center gap-3 text-white/70 rounded-xl border border-transparent px-3 py-2"
                    initial="hidden"
                    animate="show"
                    variants={fadeUp}
                    custom={0.22 + index * 0.08}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm">{item.label}</span>
                  </motion.li>
                );
              })}
            </ul>
          </div>

          <motion.div
            className="w-full max-w-md mx-auto lg:max-w-none lg:mx-0"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Card className="hero-card fx-card-dark border-white/10">
                <CardHeader className="text-center space-y-3 pb-2 pt-8 px-6">
                  <motion.div
                    className="auth-logo-glow mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]"
                    animate={{ rotate: [0, 2.5, -2.5, 0] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <img
                      src="/aikeeptrade-icon-hires.png"
                      alt=""
                      className="h-8 w-8 object-contain"
                    />
                  </motion.div>
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-bold tracking-tight text-white">
                      {t('loginTitle')}
                    </CardTitle>
                    <CardDescription className="text-sm text-white/50">
                      {t('loginSubtitle')}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="px-6 pb-8 pt-4">
                  <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
                    {visibleError && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Alert variant="destructive" className="text-sm bg-loss/10 border-red-500/30 text-red-200">
                          <AlertDescription>{visibleError}</AlertDescription>
                        </Alert>
                      </motion.div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-white/80 text-sm">{t('loginEmailLabel')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          inputMode="email"
                          autoComplete="username"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder={t('loginEmailPlaceholder')}
                          value={formData.email}
                          onChange={handleInputChange}
                          className="auth-input fx-input-dark h-11 pl-11 text-sm rounded-xl"
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-white/80 text-sm">{t('loginPasswordLabel')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder={t('loginPasswordPlaceholder')}
                          value={formData.password}
                          onChange={handleInputChange}
                          className="auth-input fx-input-dark h-11 pl-11 pr-11 text-sm rounded-xl"
                          required
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/75 transition-colors"
                          onClick={() => setShowPassword((prev) => !prev)}
                          tabIndex={-1}
                          aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <motion.div whileHover={{ scale: isLoading ? 1 : 1.015 }} whileTap={{ scale: 0.985 }}>
                      <Button
                        type="submit"
                        className="hero-cta fx-cta w-full h-11 mt-2 text-sm"
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
                    </motion.div>

                    <p className="pt-1 text-center text-[11px] leading-relaxed text-white/40">
                      {t('loginInviteOnly')}
                    </p>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
