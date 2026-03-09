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
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Wymagane logowanie</h1>
            <p className="text-slate-600 dark:text-slate-400">Musisz się zalogować, aby zarządzać ustawieniami.</p>
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
                  <CardDescription>Podstawowe informacje o Twoim koncie</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>{t.name}</Label>
                    <Input value={user?.fullName || ""} disabled className="bg-slate-50" />
                    <p className="text-xs text-slate-500 mt-1">Możesz zmienić imię w ustawieniach konta</p>
                  </div>
                  <div>
                    <Label>{t.email}</Label>
                    <Input value={user?.email || ""} disabled className="bg-slate-50" />
                    <p className="text-xs text-slate-500 mt-1">Email nie może być zmieniony</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'preferences' && (
              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
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
                    <Select value={settings.timezone || "Europe/Warsaw"} onValueChange={(value) => setSettings({ ...settings, timezone: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Europe/Warsaw">Europe/Warsaw (GMT+1)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                        <SelectItem value="Australia/Sydney">Australia/Sydney (AEDT)</SelectItem>
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
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.theme}</Label>
                    <Select value={settings.theme || "light"} onValueChange={(value) => setSettings({ ...settings, theme: value })}>
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
              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
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
              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
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

            {activeSection === 'trash' && (
              <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
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
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8"
                  disabled={updateSettingsMutation.isPending}
                >
                  {updateSettingsMutation.isPending ? "Zapisywanie..." : t.save}
                </Button>
              </div>
            )}
          </div>

          <Card className="h-fit bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40] xl:sticky xl:top-6 xl:order-1">
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