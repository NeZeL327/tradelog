import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, UserPlus, Mail, Lock, User } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/components/LanguageProvider';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function Register() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: ''
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

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError(t('registerRequiredFields'));
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('registerPasswordMismatch'));
      return false;
    }

    if (formData.password.length < 6) {
      setError(t('registerPasswordTooShort'));
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError(t('registerInvalidEmail'));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError('');
    let createdUser = null;

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const firebaseUser = userCredential.user;
      createdUser = firebaseUser;

      await setDoc(doc(db, 'users', firebaseUser.uid), {
        email: firebaseUser.email,
        fullName: formData.fullName || '',
        plan: 'free',
        language: 'pl',
        theme: 'dark',
        skin: 'blackblu',
        createdAt: serverTimestamp()
      }, { merge: true });

      const welcomeName = formData.fullName || firebaseUser.email || '';
      toast.success(`${t('registerSuccess')} ${welcomeName}!`);
      navigate('/Login');
    } catch (error) {
      if (createdUser) {
        try {
          await deleteUser(createdUser);
        } catch {
          // Ignore cleanup errors
        }
      }
      console.error('Registration error:', error);
      const errorMap = {
        'Użytkownik z tym adresem email już istnieje': t('registerEmailExists'),
        'An account with this email already exists': t('registerEmailExists')
      };
      setError(errorMap[error.message] || t('registerError'));
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
            className="absolute top-1/3 -left-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-2xl"
            animate={{ y: [0, -18, 0], opacity: [0.25, 0.5, 0.25] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <div className="parallax-layer">
          <motion.div
            className="absolute top-20 right-1/3 w-52 h-52 border border-blue-500/20 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        <div className="parallax-layer parallax-layer-fast">
          <motion.div
            className="absolute bottom-16 left-1/4 w-40 h-40 border border-emerald-400/20 rounded-full"
            animate={{ rotate: -360 }}
            transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
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
          <p className="premium-subtitle text-lg text-slate-200 mb-2">{t('registerHeroSubtitle')}</p>
          <p className="text-slate-400 text-sm max-w-md md:max-w-lg">{t('registerHeroDescription')}</p>
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
              <CardTitle className="text-2xl font-bold text-white">{t('registerTitle')}</CardTitle>
              <CardDescription className="text-slate-400">{t('registerSubtitle')}</CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-slate-200">{t('registerFullNameLabel')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      id="fullName"
                      name="fullName"
                      type="text"
                      placeholder={t('registerFullNamePlaceholder')}
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="auth-input pl-10 bg-slate-950/40 border-slate-800 text-slate-100 placeholder:text-slate-500"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">{t('registerEmailLabel')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder={t('registerEmailPlaceholder')}
                      value={formData.email}
                      onChange={handleInputChange}
                      className="auth-input pl-10 bg-slate-950/40 border-slate-800 text-slate-100 placeholder:text-slate-500"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-200">{t('registerPasswordLabel')}</Label>
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
                  <p className="text-xs text-slate-500">{t('registerPasswordHint')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-200">{t('registerConfirmPasswordLabel')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      className="auth-input pl-10 bg-slate-950/40 border-slate-800 text-slate-100 placeholder:text-slate-500"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="hero-cta hero-cta-pulse w-full bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 text-white font-semibold py-2.5 shadow-lg shadow-emerald-500/20"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('registerLoading')}
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      {t('registerButton')}
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-slate-400">
                  {t('registerHaveAccount')}{' '}
                  <button
                    onClick={() => navigate('/Login')}
                    className="text-emerald-300 hover:text-emerald-200 font-medium"
                  >
                    {t('registerLoginLink')}
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