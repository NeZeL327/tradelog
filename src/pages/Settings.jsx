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
import { User, Globe, Shield, Bell, Trash2, RotateCcw, Lock, Check } from "lucide-react";
import { toast } from "sonner";
import {
  applyTheme,
  getEffectiveUserSettings,
  getMissingCloudSettings,
  loadLocalUserSettings,
  pickUserSettings,
  saveLocalUserSettings,
  TIMEZONE_OPTIONS,
} from "@/lib/userSettings";
import { AVATAR_PRESETS, getAvatarPreset, getUserInitials } from "@/lib/avatars";

export default function Settings() {
  const { user: authUser, checkSession } = useAuth();
  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('profile');
  const [settings, setSettings] = useState(() => {
    const local = loadLocalUserSettings();
    const base = getEffectiveUserSettings({ localSettings: local });
    const activeTheme = localStorage.getItem("appTheme");
    return {
      ...base,
      theme: activeTheme === "dark" || activeTheme === "light" ? activeTheme : base.theme,
      default_account_id: "",
      default_risk_per_trade: 1,
      default_max_daily_loss: 5,
    };
  });

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
    if (!authUser) return;
    setUser(authUser);
    const local = loadLocalUserSettings();
    const effective = getEffectiveUserSettings({ cloudSettings: authUser, localSettings: local });
    const headerTheme = localStorage.getItem("appTheme");
    setSettings(prev => ({
      ...prev,
      ...effective,
      // Keep explicit dark/light from header toggle; cloud "auto" must not wipe it in the form or on save
      theme:
        headerTheme === "dark" || headerTheme === "light"
          ? headerTheme
          : effective.theme ?? prev.theme,
      fullName: authUser.fullName ?? prev.fullName ?? "",
      displayName: authUser.displayName ?? prev.displayName ?? "",
      avatar: authUser.avatar ?? prev.avatar ?? "initials",
      default_account_id: authUser.default_account_id || prev.default_account_id || "",
      default_risk_per_trade: authUser.default_risk_per_trade ?? prev.default_risk_per_trade ?? 1,
      default_max_daily_loss: authUser.default_max_daily_loss ?? prev.default_max_daily_loss ?? 5,
    }));

    const missing = getMissingCloudSettings({ cloudSettings: authUser, localSettings: local });
    if (Object.keys(missing).length > 0) {
      updateUser(authUser.id, missing).catch(() => null);
    }
  }, [authUser]);

  useEffect(() => {
    // Theme is managed by ThemeToggle — only apply non-theme runtime settings here
    // to avoid overriding the header toggle on every Settings mount.
    document.documentElement.classList.toggle("privacy-mode", !!settings.privacy_mode);
    document.documentElement.setAttribute(
      "data-pnl-view",
      settings.pnl_view === "percent" ? "percent" : "money"
    );
  }, [settings.privacy_mode, settings.pnl_view]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data) => {
      const picked = pickUserSettings(data);
      saveLocalUserSettings({ ...data, ...picked });
      return updateUser(authUser.id, { ...data, ...picked });
    },
    onSuccess: (updatedUser, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      setUser(updatedUser);
      setSettings(prev => ({
        ...prev,
        ...updatedUser,
        theme: variables.theme ?? prev.theme ?? updatedUser?.theme,
      }));
      // Do not use applyRuntimeSettings(updatedUser): Firestore snapshot can omit or differ on theme and forces light/auto.
      if (variables.theme === "dark" || variables.theme === "light" || variables.theme === "auto") {
        applyTheme(variables.theme);
      }
      document.documentElement.classList.toggle("privacy-mode", !!variables.privacy_mode);
      document.documentElement.setAttribute(
        "data-pnl-view",
        variables.pnl_view === "percent" ? "percent" : "money"
      );
      if (checkSession) checkSession();

      const language = variables?.language || updatedUser?.language || settings.language;
      toast(language === 'pl' ? "Ustawienia zapisane" : "Settings saved");
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate(settings);
  };

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
      trading: "Trading",
      notifications: "Powiadomienia",
      trash: "Kosz trade'ów",
      name: "Imię i nazwisko",
      email: "Email",
      language: "Język",
      currency: "Domyślna waluta",
      timezone: "Strefa wyświetlania",
      timezoneDesc: "W tej strefie pokazujemy godziny w dzienniku i na dashboardzie",
      tradeTimeSource: "Czas zapisany w trade'ach",
      tradeTimeSourceDesc: "W jakiej strefie są godziny z brokera/CSV. Jeśli import jest w UTC, wybierz UTC — wtedy 10:27 UTC stanie się np. 11:27/12:27 PL. Przy serwerze MT4 GMT+2 wybierz Broker GMT+2 (10:27 → 9:27 PL zimą).",
      dateFormat: "Format daty",
      timeFormat: "Format godziny",
      timeFormat24: "24-godzinny",
      timeFormat12: "12-godzinny (AM/PM)",
      showSessionClocks: "Zegary sesji w pasku górnym",
      showSessionClocksDesc: "Pokazuj aktualną godzinę PL, NY i Asia (Tokyo)",
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
      emptyTrash: "Kosz jest pusty",
      privacy: "Prywatność",
      privacyMode: "Tryb prywatny",
      privacyModeDesc: "Ukryj wartości P&L i saldo (przydatne przy udostępnianiu ekranu)",
      startPage: "Domyślna strona startowa",
      pnlView: "Widok P&L",
      pnlMoney: "Kwota (zł / $)",
      pnlPercent: "Procent (%)",
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
      timezone: "Display timezone",
      timezoneDesc: "Timezone used to show times in journal and dashboard",
      tradeTimeSource: "Times stored in trades",
      tradeTimeSourceDesc: "Timezone of broker/CSV times. For UTC imports pick UTC. For common MT4 GMT+2 server pick Broker GMT+2.",
      dateFormat: "Date Format",
      timeFormat: "Time format",
      timeFormat24: "24-hour",
      timeFormat12: "12-hour (AM/PM)",
      showSessionClocks: "Session clocks in top bar",
      showSessionClocksDesc: "Show current time for PL, NY and Asia (Tokyo)",
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
      emptyTrash: "Trash is empty",
      privacy: "Privacy",
      privacyMode: "Privacy mode",
      privacyModeDesc: "Blur P&L values and balance (useful when sharing screen)",
      startPage: "Default start page",
      pnlView: "P&L view",
      pnlMoney: "Amount ($ / zł)",
      pnlPercent: "Percentage (%)",
    }
  };

  const t = translations[settings?.language || 'pl'] || translations.pl;

  const sectionItems = [
    { id: 'profile', label: t.profile, icon: User },
    { id: 'preferences', label: t.preferences, icon: Globe },
    { id: 'trading', label: t.trading, icon: Shield },
    { id: 'notifications', label: t.notifications, icon: Bell },
    { id: 'privacy', label: t.privacy, icon: Lock },
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
      <div className="w-full min-h-[40vh] dashboard-surface">
        <div className="max-w-none mx-0 space-y-6">
          <div className="text-center">
            <h1 className="cyber-page-title mb-4">Wymagane logowanie</h1>
            <p className="cyber-page-sub">Musisz się zalogować, aby zarządzać ustawieniami.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-0 space-y-6 dashboard-surface">
      <div className="max-w-none mx-0 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="cyber-page-title">{t.title}</h1>
            <p className="cyber-page-sub">{t.subtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
          <div className="space-y-6 xl:order-2">
            {activeSection === 'profile' && (
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>{t.profile}</CardTitle>
                  <CardDescription>
                    {settings.language === 'pl'
                      ? "Podstawowe informacje, nazwa wyświetlana i awatar"
                      : "Basic info, display name and avatar"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Preview */}
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                    {(() => {
                      const preset = getAvatarPreset(settings.avatar);
                      const previewUser = { ...user, displayName: settings.displayName, fullName: settings.fullName };
                      const initials = getUserInitials(previewUser);
                      return (
                        <>
                          <div className={`h-14 w-14 rounded-full flex items-center justify-center text-white text-lg font-semibold shadow-md ring-2 ring-white/50 dark:ring-slate-700/60 bg-gradient-to-br ${preset.gradient}`}>
                            {preset.emoji ? <span className="text-2xl leading-none">{preset.emoji}</span> : initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {settings.displayName?.trim() || settings.fullName?.trim() || user?.email}
                            </p>
                            <p className="text-sm text-slate-500 truncate">{user?.email}</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div>
                    <Label htmlFor="fullName">{t.name}</Label>
                    <Input
                      id="fullName"
                      value={settings.fullName || ""}
                      onChange={(e) => setSettings({ ...settings, fullName: e.target.value })}
                      placeholder={settings.language === 'pl' ? "np. Jan Kowalski" : "e.g. John Doe"}
                      maxLength={64}
                    />
                  </div>

                  <div>
                    <Label htmlFor="displayName" className="flex items-center gap-2">
                      {settings.language === 'pl' ? "Nazwa wyświetlana" : "Display name"}
                      <span className="text-[10px] font-normal text-slate-500 uppercase tracking-wider">
                        {settings.language === 'pl' ? "opcjonalnie" : "optional"}
                      </span>
                    </Label>
                    <Input
                      id="displayName"
                      value={settings.displayName || ""}
                      onChange={(e) => setSettings({ ...settings, displayName: e.target.value })}
                      placeholder={settings.language === 'pl' ? "np. TraderPro, Nick" : "e.g. TraderPro, Nick"}
                      maxLength={32}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {settings.language === 'pl'
                        ? "Jeśli ustawisz, będzie używana w aplikacji zamiast imienia i nazwiska."
                        : "If set, it will be used in the app instead of full name."}
                    </p>
                  </div>

                  <div>
                    <Label>{t.email}</Label>
                    <Input value={user?.email || ""} disabled className="bg-slate-50 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-100" />
                    <p className="text-xs text-slate-500 mt-1">
                      {settings.language === 'pl' ? "Email nie może być zmieniony" : "Email cannot be changed"}
                    </p>
                  </div>

                  {/* Avatar gallery */}
                  <div>
                    <Label>
                      {settings.language === 'pl' ? "Awatar" : "Avatar"}
                    </Label>
                    <p className="text-xs text-slate-500 mt-1 mb-3">
                      {settings.language === 'pl'
                        ? "Wybierz jeden z gotowych motywów. Pierwsza opcja pokazuje Twoje inicjały."
                        : "Pick one of the presets. The first option shows your initials."}
                    </p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                      {AVATAR_PRESETS.map((preset) => {
                        const active = (settings.avatar || 'initials') === preset.id;
                        const previewUser = { ...user, displayName: settings.displayName, fullName: settings.fullName };
                        const initials = getUserInitials(previewUser);
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setSettings({ ...settings, avatar: preset.id })}
                            className={`relative group aspect-square rounded-xl flex flex-col items-center justify-center gap-1 text-white font-semibold shadow-sm transition-all duration-200 bg-gradient-to-br ${preset.gradient} ${
                              active
                                ? "ring-4 ring-blue-500 ring-offset-2 ring-offset-background scale-[1.03]"
                                : "hover:-translate-y-0.5 hover:shadow-md ring-1 ring-black/5 dark:ring-white/10"
                            }`}
                            aria-pressed={active}
                            title={preset.label}
                          >
                            {preset.emoji ? (
                              <span className="text-2xl sm:text-3xl leading-none">{preset.emoji}</span>
                            ) : (
                              <span className="text-lg sm:text-xl leading-none">{initials}</span>
                            )}
                            <span className="text-[10px] font-medium opacity-90">{preset.label}</span>
                            {active && (
                              <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white text-blue-600 flex items-center justify-center shadow">
                                <Check className="w-3 h-3" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'preferences' && (
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>{t.preferences}</CardTitle>
                  <CardDescription>Personalizuj wygląd i język aplikacji</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{t.language}</Label>
                    <Select value={settings.language || "pl"} onValueChange={(value) => setSettings({ ...settings, language: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pl">🇵🇱 Polski</SelectItem>
                        <SelectItem value="en">🇬🇧 English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.currency}</Label>
                    <Select value={settings.default_currency || "USD"} onValueChange={(value) => setSettings({ ...settings, default_currency: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="PLN">PLN - Polish Złoty</SelectItem>
                        <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.timezone}</Label>
                    <p className="text-xs text-muted-foreground mb-1.5">{t.timezoneDesc}</p>
                    <Select value={settings.timezone || "Europe/Warsaw"} onValueChange={(value) => setSettings({ ...settings, timezone: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.tradeTimeSource}</Label>
                    <p className="text-xs text-muted-foreground mb-1.5">{t.tradeTimeSourceDesc}</p>
                    <Select
                      value={settings.trade_time_source || "Europe/Warsaw"}
                      onValueChange={(value) => setSettings({ ...settings, trade_time_source: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map((opt) => (
                          <SelectItem key={`src-${opt.value}`} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.dateFormat}</Label>
                    <Select value={settings.date_format || "YYYY-MM-DD"} onValueChange={(value) => setSettings({ ...settings, date_format: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2026-02-03)</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (03/02/2026)</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (02/03/2026)</SelectItem>
                        <SelectItem value="DD.MM.YYYY">DD.MM.YYYY (03.02.2026)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.timeFormat}</Label>
                    <Select
                      value={settings.time_format || "24h"}
                      onValueChange={(value) => setSettings({ ...settings, time_format: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24h">{t.timeFormat24}</SelectItem>
                        <SelectItem value="12h">{t.timeFormat12}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                    <div className="space-y-0.5">
                      <Label>{t.showSessionClocks}</Label>
                      <p className="text-xs text-muted-foreground">{t.showSessionClocksDesc}</p>
                    </div>
                    <Switch
                      checked={settings.show_session_clocks !== false}
                      onCheckedChange={(checked) => setSettings({ ...settings, show_session_clocks: checked })}
                    />
                  </div>
                  <div>
                    <Label>{t.theme}</Label>
                    <Select value={settings.theme || "auto"} onValueChange={(value) => setSettings({ ...settings, theme: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
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
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>{t.trading}</CardTitle>
                  <CardDescription>Ustawienia domyślne dla nowych transakcji</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{t.defaultAccount}</Label>
                    <Select
                      value={settings.default_account_id || "none"}
                      onValueChange={(value) => setSettings({ ...settings, default_account_id: value === "none" ? "" : value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
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
                    <p className="text-xs text-slate-500 mt-1">Sugerowane: 1-2%</p>
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
                    <p className="text-xs text-slate-500 mt-1">Sugerowane: 3-5%</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'notifications' && (
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>{t.notifications}</CardTitle>
                  <CardDescription>Kontroluj powiadomienia i alerty</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t.enableNotifications}</Label>
                      <p className="text-sm text-slate-500">Otrzymuj powiadomienia o ważnych wydarzeniach</p>
                    </div>
                    <Switch
                      checked={settings.notifications_enabled !== undefined ? settings.notifications_enabled : true}
                      onCheckedChange={(checked) => setSettings({ ...settings, notifications_enabled: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t.showWeekends}</Label>
                      <p className="text-sm text-slate-500">Wyświetlaj weekendy w widoku kalendarza</p>
                    </div>
                    <Switch
                      checked={settings.show_weekends !== undefined ? settings.show_weekends : false}
                      onCheckedChange={(checked) => setSettings({ ...settings, show_weekends: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'privacy' && (
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>{t.privacy}</CardTitle>
                  <CardDescription>
                    {settings.language === 'pl'
                      ? "Kontroluj widoczność danych finansowych"
                      : "Control visibility of financial data"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t.privacyMode}</Label>
                      <p className="text-sm text-slate-500">{t.privacyModeDesc}</p>
                    </div>
                    <Switch
                      checked={!!settings.privacy_mode}
                      onCheckedChange={(checked) => setSettings({ ...settings, privacy_mode: checked })}
                    />
                  </div>
                  <div>
                    <Label>{t.startPage}</Label>
                    <Select
                      value={settings.start_page || "/Dashboard"}
                      onValueChange={(value) => setSettings({ ...settings, start_page: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="/Dashboard">Dashboard</SelectItem>
                        <SelectItem value="/journal">
                          {settings.language === 'pl' ? "Dziennik" : "Journal"}
                        </SelectItem>
                        <SelectItem value="/analytics">Analytics</SelectItem>
                        <SelectItem value="/calendar">
                          {settings.language === 'pl' ? "Kalendarz" : "Calendar"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-1">
                      {settings.language === 'pl'
                        ? "Strona otwierana po zalogowaniu"
                        : "Page opened after login"}
                    </p>
                  </div>
                  <div>
                    <Label>{t.pnlView}</Label>
                    <Select
                      value={settings.pnl_view || "money"}
                      onValueChange={(value) => setSettings({ ...settings, pnl_view: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="money">{t.pnlMoney}</SelectItem>
                        <SelectItem value="percent">{t.pnlPercent}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'trash' && (
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>{t.trash}</CardTitle>
                  <CardDescription>
                    Usunięte trade możesz przywrócić do 30 dni. Po tym czasie znikają trwale.
                  </CardDescription>
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
                                Konto: {getAccountName(trade.account_id)}
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
                  className="cyber-primary-btn px-8"
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? "Zapisywanie..." : t.save}
                </Button>
              </div>
            )}
          </div>

          <Card className="h-fit shadow-md xl:sticky xl:top-6 xl:order-1">
            <CardHeader>
              <CardTitle className="text-base">Sekcje</CardTitle>
              <CardDescription>Wybierz, co chcesz edytować</CardDescription>
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