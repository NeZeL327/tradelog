import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, LogIn, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageToggle from '@/components/LanguageToggle';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

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
    setIsLoading(true);
    setError('');

    try {
      await login(formData.email, formData.password);
      toast.success(t('loginSuccess'));
      navigate('/Dashboard');
    } catch (err) {
      console.error('Login error:', err);
      const errorMap = {
        'Nieprawidłowy email lub hasło': t('loginInvalidCredentials'),
        'Invalid email or password': t('loginInvalidCredentials')
      };
      setError(errorMap[err.message] || t('loginError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col public-trading-bg overflow-y-auto">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 relative z-10">
        <div className="flex items-center gap-2">
          <img
            src="/aikeeptrade-icon-hires.png"
            alt="AiKeepTrade"
            width="32"
            height="32"
            className="h-8 w-8 object-contain"
          />
          <span className="text-base font-bold tracking-tight text-white">AiKeepTrade</span>
        </div>
        <LanguageToggle variant="dark" />
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pb-10 min-h-0">
        <Card className="w-full max-w-md hero-card fx-card-dark border-slate-700/60">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="mx-auto mb-2">
              <img
                src="/aikeeptrade-icon-hires.png"
                alt=""
                className="h-14 w-14 object-contain mx-auto drop-shadow-xl"
              />
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold text-white">{t('loginTitle')}</CardTitle>
            <CardDescription className="text-sm text-slate-400">
              {t('loginSubtitle')}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-4 sm:px-6 pb-6">
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
                    autoComplete="email"
                    placeholder={t('loginEmailPlaceholder')}
                    value={formData.email}
                    onChange={handleInputChange}
                    className="auth-input fx-input-dark pl-10 text-sm"
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
                    autoComplete="current-password"
                    placeholder={t('loginPasswordPlaceholder')}
                    value={formData.password}
                    onChange={handleInputChange}
                    className="auth-input fx-input-dark pl-10 text-sm"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="hero-cta fx-cta w-full h-11 rounded-xl text-base"
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

              <p className="pt-2 text-center text-xs text-slate-500">
                {t('loginInviteOnly')}
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
