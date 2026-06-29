import { useState, useEffect } from "react";
import { useAuth } from '@/lib/AuthContext';
import { getTradingAccounts, updateUser, getDeletedTrades, restoreTrade, permanentlyDeleteTrade } from '@/lib/localStorage';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { User, Globe, Shield, Bell, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } from "firebase/auth";

export default function Settings() {
  const { user: authUser, checkSession } = useAuth();
  const queryClient = useQueryClient();

  const resolveInitialTheme = () => {
    const allowedThemes = new Set(['light', 'dark', 'auto']);
    const savedTheme = localStorage.getItem('appTheme');

    if (savedTheme && allowedThemes.has(savedTheme)) {
      return savedTheme;
    }

    if (document.documentElement.classList.contains('dark')) {
      return 'dark';
    }

    return 'light';
  };

  const resolveInitialSkin = () => {
    const allowedSkins = new Set(['default', 'ocean', 'blackblu']);
    const savedSkin = localStorage.getItem('appSkin');

    if (savedSkin && allowedSkins.has(savedSkin)) {
      return savedSkin;
    }

    const currentSkin = document.documentElement.getAttribute('data-skin');
    if (currentSkin && allowedSkins.has(currentSkin)) {
      return currentSkin;
    }

    return 'ocean';
  };

  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('profile');
  const [settings, setSettings] = useState({
    language: "pl",
    default_currency: "USD",
    timezone: "Europe/Warsaw",
    default_account_id: "",
    default_risk_per_trade: 1,
    default_max_daily_loss: 5,
    date_format: "YYYY-MM-DD",
    theme: resolveInitialTheme(),
    skin: resolveInitialSkin(),
    notifications_enabled: true,
    show_weekends: false
  });
  const [emailFlow, setEmailFlow] = useState({
    isOpen: false,
    newEmail: "",
    password: "",
    smsCode: "",
    challengeHash: "",
    challengeExpiresAt: 0,
    attemptsLeft: 0,
    requestedAt: 0,
    isSending: false,
    isVerifying: false,
  });
  const [codeCountdown, setCodeCountdown] = useState(0);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => getTradingAccounts(authUser?.id),
    enabled: !!authUser,
  });

  const { data: deletedTrades = [] } = useQuery({
    queryKey: ['deleted-trades', authUser?.id],
    queryFn: () => getDeletedTrades(authUser?.id),
    enabled: !!authUser?.id,
  });

  useEffect(() => {
    if (authUser) {
      const allowedSkins = new Set(['default', 'ocean', 'blackblu']);
      const nextSkin = allowedSkins.has(authUser.skin) ? authUser.skin : 'ocean';
      setUser(authUser);
      
      // Merge user settings with defaults
      setSettings(prev => ({
        ...prev,
        ...authUser,
        language: authUser.language || "pl",
        default_currency: authUser.default_currency || "USD",
        timezone: authUser.timezone || "Europe/Warsaw",
        default_risk_per_trade: authUser.default_risk_per_trade || 1,
        default_max_daily_loss: authUser.default_max_daily_loss || 5,
        date_format: authUser.date_format || "YYYY-MM-DD",
        theme: prev.theme || authUser.theme || "light",
        skin: prev.skin || nextSkin || "ocean",
        notifications_enabled: authUser.notifications_enabled !== undefined ? authUser.notifications_enabled : true,
        show_weekends: authUser.show_weekends || false
      }));
    };
  }, [authUser]);

  const applyTheme = (theme) => {
    const root = document.documentElement;
    const shouldBeDark = theme === 'dark' || (
      theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches
    );
    const isDark = root.classList.contains('dark');

    if (isDark !== shouldBeDark) {
      root.classList.toggle('dark', shouldBeDark);
    }

    if (theme === 'dark') {
      root.setAttribute('data-skin', 'blackblu');
      localStorage.setItem('appTheme', 'dark');
      localStorage.setItem('appSkin', 'blackblu');
    } else if (theme === 'light') {
      root.setAttribute('data-skin', 'default');
      localStorage.setItem('appTheme', 'light');
      localStorage.setItem('appSkin', 'default');
    } else if (theme === 'auto') {
      localStorage.removeItem('appTheme');
      localStorage.removeItem('appSkin');
    }
  };

  useEffect(() => {
    applyTheme(settings.theme || 'light');
  }, [settings.theme]);

  const applySkin = (skin) => {
    const allowedSkins = new Set(['default', 'ocean', 'blackblu']);
    const nextSkin = allowedSkins.has(skin) ? skin : 'ocean';
    const root = document.documentElement;
    if (root.getAttribute('data-skin') !== nextSkin) {
      root.setAttribute('data-skin', nextSkin || 'ocean');
    }
  };

  useEffect(() => {
    applySkin(settings.skin || 'ocean');
  }, [settings.skin]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data) => updateUser(authUser.id, data),
    onSuccess: (updatedUser, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user'] });

      setUser(updatedUser);

      setSettings(prev => ({
        ...prev,
        ...updatedUser
      }));

      applyTheme(updatedUser.theme || settings.theme || 'light');
      applySkin(updatedUser.skin || settings.skin || 'ocean');

      if (checkSession) {
        checkSession();
      }

      const language = variables?.language || updatedUser?.language || settings.language;
      toast({
        title: language === 'pl' ? "Zapisano" : "Saved",
        description: language === 'pl' ? "Ustawienia zostały zaktualizowane" : "Settings have been updated",
      });
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate(settings);
  };

  const maskPhone = (phone) => {
    if (!phone) return '';
    const str = String(phone);
    if (str.length <= 4) return `***${str}`;
    return `${'*'.repeat(Math.max(0, str.length - 4))}${str.slice(-4)}`;
  };

  const hashText = async (value) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  };

  const generateSmsCode = () => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return String(arr[0] % 1000000).padStart(6, '0');
  };

  const resetEmailFlow = () => {
    setEmailFlow({
      isOpen: false,
      newEmail: "",
      password: "",
      smsCode: "",
      challengeHash: "",
      challengeExpiresAt: 0,
      attemptsLeft: 0,
      requestedAt: 0,
      isSending: false,
      isVerifying: false,
    });
    setCodeCountdown(0);
  };

  const handleRequestEmailChangeCode = async () => {
    const trimmedEmail = String(emailFlow.newEmail || "").trim().toLowerCase();
    const currentEmail = String(user?.email || "").trim().toLowerCase();
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!isEmailValid) {
      toast.error(settings.language === 'pl' ? 'Podaj poprawny email' : 'Please enter a valid email');
      return;
    }

    if (trimmedEmail === currentEmail) {
      toast.error(settings.language === 'pl' ? 'Nowy email musi być inny niż obecny' : 'New email must be different');
      return;
    }

    if (!emailFlow.password || emailFlow.password.length < 6) {
      toast.error(settings.language === 'pl' ? 'Podaj aktualne hasło' : 'Please enter your current password');
      return;
    }

    const now = Date.now();
    if (emailFlow.requestedAt && now - emailFlow.requestedAt < 30000) {
      toast.error(settings.language === 'pl' ? 'Odczekaj chwilę przed ponownym wysłaniem kodu' : 'Please wait before requesting another code');
      return;
    }

    try {
      setEmailFlow((prev) => ({ ...prev, isSending: true }));
      const firebaseUser = auth.currentUser;
      if (!firebaseUser || !firebaseUser.email) {
        toast.error(settings.language === 'pl' ? 'Sesja wygasła. Zaloguj się ponownie.' : 'Session expired. Please log in again.');
        return;
      }

      const credential = EmailAuthProvider.credential(firebaseUser.email, emailFlow.password);
      await reauthenticateWithCredential(firebaseUser, credential);

      // 1) Reauth hasłem  2) kod 6-cyfrowy  3) limit prób + TTL
      const rawCode = generateSmsCode();
      const codeHash = await hashText(rawCode);
      const expiresAt = now + 5 * 60 * 1000;

      setEmailFlow((prev) => ({
        ...prev,
        newEmail: trimmedEmail,
        challengeHash: codeHash,
        challengeExpiresAt: expiresAt,
        attemptsLeft: 3,
        requestedAt: now,
        smsCode: "",
      }));
      setCodeCountdown(300);

      const maskedPhone = maskPhone(auth.currentUser?.phoneNumber);
      const sentMessage = maskedPhone
        ? (settings.language === 'pl'
            ? `Kod bezpieczeństwa wysłany SMS na numer ${maskedPhone}`
            : `Security code sent via SMS to ${maskedPhone}`)
        : (settings.language === 'pl'
            ? 'Kod bezpieczeństwa wygenerowany. Brak numeru telefonu - użyj kodu developerskiego.'
            : 'Security code generated. No phone number configured - using developer code.');

      toast.success(sentMessage);

      if (import.meta.env.DEV) {
        toast.info(`DEV SMS: ${rawCode}`);
      }
    } catch (error) {
      toast.error(settings.language === 'pl' ? 'Weryfikacja hasła nie powiodła się' : 'Password verification failed');
    } finally {
      setEmailFlow((prev) => ({ ...prev, isSending: false }));
    }
  };

  const handleConfirmEmailChange = async () => {
    const now = Date.now();
    const code = String(emailFlow.smsCode || "").trim();
    if (!/^\d{6}$/.test(code)) {
      toast.error(settings.language === 'pl' ? 'Kod musi mieć 6 cyfr' : 'Code must have 6 digits');
      return;
    }

    if (!emailFlow.challengeHash || !emailFlow.challengeExpiresAt || now > emailFlow.challengeExpiresAt) {
      toast.error(settings.language === 'pl' ? 'Kod wygasł. Wygeneruj nowy.' : 'Code expired. Request a new one.');
      return;
    }

    if (emailFlow.attemptsLeft <= 0) {
      toast.error(settings.language === 'pl' ? 'Wykorzystano limit prób. Wygeneruj nowy kod.' : 'Attempt limit reached. Request a new code.');
      return;
    }

    try {
      setEmailFlow((prev) => ({ ...prev, isVerifying: true }));
      const hash = await hashText(code);
      if (hash !== emailFlow.challengeHash) {
        setEmailFlow((prev) => ({ ...prev, attemptsLeft: Math.max(0, prev.attemptsLeft - 1) }));
        toast.error(settings.language === 'pl' ? 'Niepoprawny kod bezpieczeństwa' : 'Invalid security code');
        return;
      }

      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        toast.error(settings.language === 'pl' ? 'Sesja wygasła. Zaloguj się ponownie.' : 'Session expired. Please log in again.');
        return;
      }

      await verifyBeforeUpdateEmail(firebaseUser, emailFlow.newEmail.trim().toLowerCase());
      await updateUser(authUser?.id, {
        pending_email: emailFlow.newEmail.trim().toLowerCase(),
        pending_email_requested_at: new Date().toISOString(),
      });
      checkSession?.();

      toast.success(
        settings.language === 'pl'
          ? 'Wysłaliśmy link weryfikacyjny. Potwierdź zmianę emaila w skrzynce.'
          : 'Verification link sent. Confirm email change in your inbox.'
      );
      resetEmailFlow();
    } catch (error) {
      toast.error(
        settings.language === 'pl'
          ? 'Nie udało się rozpocząć zmiany emaila'
          : 'Failed to start email change'
      );
    } finally {
      setEmailFlow((prev) => ({ ...prev, isVerifying: false }));
    }
  };

  useEffect(() => {
    if (!emailFlow.challengeExpiresAt) return;
    const interval = setInterval(() => {
      const left = Math.max(0, Math.ceil((emailFlow.challengeExpiresAt - Date.now()) / 1000));
      setCodeCountdown(left);
    }, 1000);
    return () => clearInterval(interval);
  }, [emailFlow.challengeExpiresAt]);

  const restoreTradeMutation = useMutation({
    mutationFn: (tradeId) => restoreTrade(authUser?.id, tradeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades', authUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-trades', authUser?.id] });
      toast.success('Trade został przywrócony z kosza');
    },
  });

  const permanentlyDeleteTradeMutation = useMutation({
    mutationFn: (tradeId) => permanentlyDeleteTrade(authUser?.id, tradeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades', authUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-trades', authUser?.id] });
      toast.success('Trade został usunięty trwale');
    },
  });

  const translations = {
    pl: {
      title: "Ustawienia",
      subtitle: "Zarządzaj swoim kontem i preferencjami",
      profile: "Profil",
      preferences: "Preferencje",
      trading: "Handel",
      notifications: "Powiadomienia",
      trash: "Kosz trade'ów",
      name: "Imię i nazwisko",
      email: "E-mail",
      language: "Język",
      currency: "Domyślna waluta",
      timezone: "Strefa czasowa",
      dateFormat: "Format daty",
      theme: "Motyw",
      skin: "Skórka",
      defaultAccount: "Domyślne konto",
      riskPerTrade: "Domyślne ryzyko na transakcję (%)",
      maxDailyLoss: "Domyślna max dzienna strata (%)",
      enableNotifications: "Włącz powiadomienia",
      showWeekends: "Pokazuj weekendy w kalendarzu",
      save: "Zapisz zmiany",
      logout: "Wyloguj się",
      light: "Jasny",
      dark: "Ciemny",
      auto: "Auto",
      noAccount: "Brak domyślnego konta",
      skinDefault: "Domyślna",
      skinOcean: "Ocean",
      skinBlackBlu: "BlackBlu",
      daysLeft: "dni do usunięcia",
      restore: "Przywróć",
      deleteNow: "Usuń teraz",
      emptyTrash: "Kosz jest pusty"
      ,
      changeEmail: "Zmień email",
      secureEmailChange: "Bezpieczna zmiana emaila",
      currentPassword: "Aktualne hasło",
      newEmail: "Nowy email",
      smsCode: "Kod bezpieczeństwa",
      sendCode: "Wyślij kod",
      verifyAndSendLink: "Zweryfikuj i wyślij link",
      cancel: "Anuluj",
      codeExpiresIn: "Kod wygasa za",
      attemptsLeft: "Pozostałe próby",
      sections: "Sekcje",
      chooseSection: "Wybierz, co chcesz edytować",
      loginRequired: "Wymagane logowanie",
      loginRequiredDesc: "Musisz się zalogować, aby zarządzać ustawieniami.",
      profileBasicInfo: "Podstawowe informacje o Twoim koncie",
      profileNameHint: "Imię i nazwisko będzie zapisane po kliknięciu \"Zapisz zmiany\"",
      preferencesDesc: "Personalizuj wygląd i język aplikacji",
      tradingDesc: "Ustawienia domyślne dla nowych transakcji",
      notificationsDesc: "Kontroluj powiadomienia i alerty",
      notificationsHint: "Otrzymuj powiadomienia o ważnych wydarzeniach",
      showWeekendsHint: "Wyświetlaj weekendy w widoku kalendarza",
      trashDesc: "Usunięte transakcje możesz przywrócić do 30 dni. Po tym czasie znikają trwale.",
      accountLabel: "Konto",
      suggestedRisk: "Sugerowane: 1-2%",
      suggestedLoss: "Sugerowane: 3-5%",
      saving: "Zapisywanie..."
      ,
      emailPlaceholder: "twoj@email.pl",
      codePlaceholder: "Wpisz kod 6-cyfrowy",
      currencyUsd: "USD - Dolar amerykański",
      currencyEur: "EUR - Euro",
      currencyGbp: "GBP - Funt brytyjski",
      currencyPln: "PLN - Polski złoty",
      currencyJpy: "JPY - Jen japoński",
      tzWarsaw: "Europa/Warszawa (GMT+1)",
      tzNewYork: "Ameryka/Nowy Jork (EST)",
      tzLondon: "Europa/Londyn (GMT)",
      tzTokyo: "Azja/Tokio (JST)",
      tzSydney: "Australia/Sydney (AEDT)",
      dateIso: "YYYY-MM-DD (2026-02-03)",
      dateDmy: "DD/MM/YYYY (03/02/2026)",
      dateMdy: "MM/DD/YYYY (02/03/2026)"
    },
    en: {
      title: "Settings",
      subtitle: "Manage your account and preferences",
      profile: "Profile",
      preferences: "Preferences",
      trading: "Trading",
      notifications: "Notifications",
      trash: "Trade Trash",
      name: "Full Name",
      email: "Email",
      language: "Language",
      currency: "Default Currency",
      timezone: "Timezone",
      dateFormat: "Date Format",
      theme: "Theme",
      skin: "Skin",
      defaultAccount: "Default Account",
      riskPerTrade: "Default Risk Per Trade (%)",
      maxDailyLoss: "Default Max Daily Loss (%)",
      enableNotifications: "Enable Notifications",
      showWeekends: "Show Weekends in Calendar",
      save: "Save Changes",
      logout: "Log Out",
      light: "Light",
      dark: "Dark",
      auto: "Auto",
      noAccount: "No default account",
      skinDefault: "Default",
      skinOcean: "Ocean",
      skinBlackBlu: "BlackBlu",
      daysLeft: "days left",
      restore: "Restore",
      deleteNow: "Delete now",
      emptyTrash: "Trash is empty"
      ,
      changeEmail: "Change email",
      secureEmailChange: "Secure email change",
      currentPassword: "Current password",
      newEmail: "New email",
      smsCode: "Security code",
      sendCode: "Send code",
      verifyAndSendLink: "Verify and send link",
      cancel: "Cancel",
      codeExpiresIn: "Code expires in",
      attemptsLeft: "Attempts left",
      sections: "Sections",
      chooseSection: "Choose what you want to edit",
      loginRequired: "Login required",
      loginRequiredDesc: "You must be signed in to manage settings.",
      profileBasicInfo: "Basic information about your account",
      profileNameHint: "Full name will be saved after clicking \"Save changes\"",
      preferencesDesc: "Customize app appearance and language",
      tradingDesc: "Default settings for new trades",
      notificationsDesc: "Control notifications and alerts",
      notificationsHint: "Receive notifications about important events",
      showWeekendsHint: "Show weekends in calendar view",
      trashDesc: "Deleted trades can be restored for up to 30 days. After that, they are permanently removed.",
      accountLabel: "Account",
      suggestedRisk: "Suggested: 1-2%",
      suggestedLoss: "Suggested: 3-5%",
      saving: "Saving..."
      ,
      emailPlaceholder: "you@example.com",
      codePlaceholder: "Enter 6-digit code",
      currencyUsd: "USD - US Dollar",
      currencyEur: "EUR - Euro",
      currencyGbp: "GBP - British Pound",
      currencyPln: "PLN - Polish Zloty",
      currencyJpy: "JPY - Japanese Yen",
      tzWarsaw: "Europe/Warsaw (GMT+1)",
      tzNewYork: "America/New York (EST)",
      tzLondon: "Europe/London (GMT)",
      tzTokyo: "Asia/Tokyo (JST)",
      tzSydney: "Australia/Sydney (AEDT)",
      dateIso: "YYYY-MM-DD (2026-02-03)",
      dateDmy: "DD/MM/YYYY (03/02/2026)",
      dateMdy: "MM/DD/YYYY (02/03/2026)"
    }
  };

  const t = translations[settings?.language || 'pl'] || translations.pl;

  const sectionItems = [
    { id: 'profile', label: t.profile, icon: User },
    { id: 'preferences', label: t.preferences, icon: Globe },
    { id: 'trading', label: t.trading, icon: Shield },
    { id: 'notifications', label: t.notifications, icon: Bell },
    { id: 'trash', label: t.trash, icon: Trash2 },
  ];

  const getDaysLeft = (deletedExpiresAt) => {
    if (!deletedExpiresAt) return 0;
    const expiresAt = new Date(deletedExpiresAt).getTime();
    if (!Number.isFinite(expiresAt)) return 0;
    const msLeft = expiresAt - Date.now();
    return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  };

  const getAccountName = (accountId) => {
    return accounts.find((account) => String(account.id) === String(accountId))?.name || '-';
  };

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
        <div className="max-w-none mx-0 space-y-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">{t.loginRequired}</h1>
            <p className="text-slate-600 dark:text-slate-400">{t.loginRequiredDesc}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-[#0f0f16] dark:via-[#14141f] dark:to-[#1a1a2e]">
      <div className="max-w-none mx-0 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{t.title}</h1>
            <p className="text-slate-600 dark:text-slate-400">{t.subtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
          <div className="space-y-6 xl:order-2">
            {activeSection === 'profile' && (
              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                <CardHeader>
                  <CardTitle>{t.profile}</CardTitle>
                  <CardDescription>{t.profileBasicInfo}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{t.name}</Label>
                    <Input
                      value={settings?.fullName || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSettings((prev) => ({ ...prev, fullName: val }));
                        setUser((prev) => ({ ...(prev || {}), fullName: val }));
                      }}
                      placeholder={settings.language === 'pl' ? "Wpisz imię i nazwisko" : "Enter full name"}
                    />
                    <p className="text-xs text-slate-500 mt-1">{t.profileNameHint}</p>
                  </div>
                  <div>
                    <Label>{t.email}</Label>
                    <Input value={user?.email || ""} disabled className="bg-slate-50" />
                    <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{t.secureEmailChange}</p>
                        <Button
                          type="button"
                          variant={emailFlow.isOpen ? "outline" : "default"}
                          size="sm"
                          onClick={() => {
                            if (emailFlow.isOpen) {
                              resetEmailFlow();
                            } else {
                              setEmailFlow((prev) => ({ ...prev, isOpen: true }));
                            }
                          }}
                        >
                          {emailFlow.isOpen ? t.cancel : t.changeEmail}
                        </Button>
                      </div>

                      {emailFlow.isOpen && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">{t.newEmail}</Label>
                              <Input
                                type="email"
                                value={emailFlow.newEmail}
                                onChange={(e) => setEmailFlow((prev) => ({ ...prev, newEmail: e.target.value }))}
                                placeholder={t.emailPlaceholder}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">{t.currentPassword}</Label>
                              <Input
                                type="password"
                                value={emailFlow.password}
                                onChange={(e) => setEmailFlow((prev) => ({ ...prev, password: e.target.value }))}
                                placeholder="••••••••"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleRequestEmailChangeCode}
                              disabled={emailFlow.isSending}
                            >
                              {emailFlow.isSending ? "..." : t.sendCode}
                            </Button>
                            {emailFlow.challengeExpiresAt > Date.now() && (
                              <span className="text-xs text-slate-500">
                                {t.codeExpiresIn}: {Math.floor(codeCountdown / 60)}:{String(codeCountdown % 60).padStart(2, '0')}
                              </span>
                            )}
                            {emailFlow.challengeHash && (
                              <span className="text-xs text-slate-500">
                                {t.attemptsLeft}: {emailFlow.attemptsLeft}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                              inputMode="numeric"
                              maxLength={6}
                              value={emailFlow.smsCode}
                              onChange={(e) => setEmailFlow((prev) => ({ ...prev, smsCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                              placeholder={t.codePlaceholder}
                              className="sm:max-w-[220px]"
                            />
                            <Button
                              type="button"
                              onClick={handleConfirmEmailChange}
                              disabled={emailFlow.isVerifying || !emailFlow.challengeHash}
                            >
                              {emailFlow.isVerifying ? "..." : t.verifyAndSendLink}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'preferences' && (
              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                <CardHeader>
                  <CardTitle>{t.preferences}</CardTitle>
                  <CardDescription>{t.preferencesDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{t.language}</Label>
                    <Select value={settings.language || "pl"} onValueChange={(value) => setSettings({ ...settings, language: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent position="popper" side="bottom" align="start" className="w-[--radix-select-trigger-width] min-w-0">
                        <SelectItem value="pl">🇵🇱 Polski</SelectItem>
                        <SelectItem value="en">🇬🇧 English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.currency}</Label>
                    <Select value={settings.default_currency || "USD"} onValueChange={(value) => setSettings({ ...settings, default_currency: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent position="popper" side="bottom" align="start" className="w-[--radix-select-trigger-width] min-w-0">
                        <SelectItem value="USD">{t.currencyUsd}</SelectItem>
                        <SelectItem value="EUR">{t.currencyEur}</SelectItem>
                        <SelectItem value="GBP">{t.currencyGbp}</SelectItem>
                        <SelectItem value="PLN">{t.currencyPln}</SelectItem>
                        <SelectItem value="JPY">{t.currencyJpy}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.timezone}</Label>
                    <Select value={settings.timezone || "Europe/Warsaw"} onValueChange={(value) => setSettings({ ...settings, timezone: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent position="popper" side="bottom" align="start" className="w-[--radix-select-trigger-width] min-w-0">
                        <SelectItem value="Europe/Warsaw">{t.tzWarsaw}</SelectItem>
                        <SelectItem value="America/New_York">{t.tzNewYork}</SelectItem>
                        <SelectItem value="Europe/London">{t.tzLondon}</SelectItem>
                        <SelectItem value="Asia/Tokyo">{t.tzTokyo}</SelectItem>
                        <SelectItem value="Australia/Sydney">{t.tzSydney}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.dateFormat}</Label>
                    <Select value={settings.date_format || "YYYY-MM-DD"} onValueChange={(value) => setSettings({ ...settings, date_format: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent position="popper" side="bottom" align="start" className="w-[--radix-select-trigger-width] min-w-0">
                        <SelectItem value="YYYY-MM-DD">{t.dateIso}</SelectItem>
                        <SelectItem value="DD/MM/YYYY">{t.dateDmy}</SelectItem>
                        <SelectItem value="MM/DD/YYYY">{t.dateMdy}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.theme}</Label>
                    <Select value={settings.theme || "light"} onValueChange={(value) => setSettings({ ...settings, theme: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent position="popper" side="bottom" align="start" className="w-[--radix-select-trigger-width] min-w-0">
                        <SelectItem value="light">{t.light}</SelectItem>
                        <SelectItem value="dark">{t.dark}</SelectItem>
                        <SelectItem value="auto">{t.auto}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'trading' && (
              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                <CardHeader>
                  <CardTitle>{t.trading}</CardTitle>
                  <CardDescription>{t.tradingDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{t.defaultAccount}</Label>
                    <Select
                      value={settings.default_account_id || "none"}
                      onValueChange={(value) => setSettings({ ...settings, default_account_id: value === "none" ? "" : value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent position="popper" side="bottom" align="start" className="w-[--radix-select-trigger-width] min-w-0">
                        <SelectItem value="none">{t.noAccount}</SelectItem>
                        {accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.account_type})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.riskPerTrade}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={settings.default_risk_per_trade || 1}
                      onChange={(e) => setSettings({ ...settings, default_risk_per_trade: parseFloat(e.target.value) })}
                      placeholder="1.0"
                    />
                    <p className="text-xs text-slate-500 mt-1">{t.suggestedRisk}</p>
                  </div>
                  <div>
                    <Label>{t.maxDailyLoss}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={settings.default_max_daily_loss || 5}
                      onChange={(e) => setSettings({ ...settings, default_max_daily_loss: parseFloat(e.target.value) })}
                      placeholder="5.0"
                    />
                    <p className="text-xs text-slate-500 mt-1">{t.suggestedLoss}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'notifications' && (
              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                <CardHeader>
                  <CardTitle>{t.notifications}</CardTitle>
                  <CardDescription>{t.notificationsDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t.enableNotifications}</Label>
                      <p className="text-sm text-slate-500">{t.notificationsHint}</p>
                    </div>
                    <Switch
                      checked={settings.notifications_enabled !== undefined ? settings.notifications_enabled : true}
                      onCheckedChange={(checked) => setSettings({ ...settings, notifications_enabled: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t.showWeekends}</Label>
                      <p className="text-sm text-slate-500">{t.showWeekendsHint}</p>
                    </div>
                    <Switch
                      checked={settings.show_weekends !== undefined ? settings.show_weekends : false}
                      onCheckedChange={(checked) => setSettings({ ...settings, show_weekends: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'trash' && (
              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                <CardHeader>
                  <CardTitle>{t.trash}</CardTitle>
                  <CardDescription>{t.trashDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  {deletedTrades.length === 0 ? (
                    <div className="text-sm text-slate-500">{t.emptyTrash}</div>
                  ) : (
                    <div className="space-y-3">
                      {deletedTrades.map((trade) => {
                        const daysLeft = getDaysLeft(trade.deleted_expires_at);
                        return (
                          <div
                            key={trade.id}
                            className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {trade.symbol || '-'} • {trade.date || '-'}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                {t.accountLabel}: {getAccountName(trade.account_id)}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                {daysLeft} {t.daysLeft}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => restoreTradeMutation.mutate(trade.id)}
                                disabled={restoreTradeMutation.isPending || permanentlyDeleteTradeMutation.isPending}
                              >
                                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                                {t.restore}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => permanentlyDeleteTradeMutation.mutate(trade.id)}
                                disabled={restoreTradeMutation.isPending || permanentlyDeleteTradeMutation.isPending}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                {t.deleteNow}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeSection !== 'trash' && (
              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8"
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? t.saving : t.save}
                </Button>
              </div>
            )}
          </div>

          <Card className="h-fit bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40] xl:sticky xl:top-6 xl:order-1">
            <CardHeader>
              <CardTitle className="text-base">{t.sections}</CardTitle>
              <CardDescription>{t.chooseSection}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {sectionItems.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <Button
                    key={section.id}
                    variant={isActive ? 'default' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => setActiveSection(section.id)}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {section.label}
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}