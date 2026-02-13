import React, { useState, useEffect } from "react";
import { useAuth } from '@/lib/AuthContext';
import { getTradingAccounts, updateUser } from '@/lib/localStorage';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, User, Globe, Shield, Bell } from "lucide-react";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";

export default function Settings() {
  const { user: authUser, checkSession } = useAuth();
  const queryClient = useQueryClient();

  if (!authUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Wymagane logowanie</h1>
            <p className="text-slate-600 dark:text-slate-400">Musisz się zalogować, aby zarządzać ustawieniami.</p>
          </div>
        </div>
      </div>
    );
  }

  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({
    language: "pl",
    default_currency: "USD",
    timezone: "Europe/Warsaw",
    default_account_id: "",
    default_risk_per_trade: 1,
    default_max_daily_loss: 5,
    date_format: "YYYY-MM-DD",
    theme: "light",
    skin: "ocean",
    notifications_enabled: true,
    show_weekends: false
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => getTradingAccounts(authUser?.id),
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
        theme: authUser.theme || "light",
        skin: nextSkin || "ocean",
        notifications_enabled: authUser.notifications_enabled !== undefined ? authUser.notifications_enabled : true,
        show_weekends: authUser.show_weekends || false
      }));
    };
  }, [authUser]);

  const applyTheme = (theme) => {
    document.documentElement.classList.remove('dark');

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'auto') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      }
    }
  };

  useEffect(() => {
    applyTheme(settings.theme || 'light');
  }, [settings.theme]);

  const applySkin = (skin) => {
    const allowedSkins = new Set(['default', 'ocean', 'blackblu']);
    const nextSkin = allowedSkins.has(skin) ? skin : 'ocean';
    document.documentElement.setAttribute('data-skin', nextSkin || 'ocean');
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

  const translations = {
    pl: {
      title: "Ustawienia",
      subtitle: "Zarządzaj swoim kontem i preferencjami",
      profile: "Profil",
      preferences: "Preferencje",
      trading: "Trading",
      notifications: "Powiadomienia",
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
      skinBlackBlu: "BlackBlu"
    },
    en: {
      title: "Settings",
      subtitle: "Manage your account and preferences",
      profile: "Profile",
      preferences: "Preferences",
      trading: "Trading",
      notifications: "Notifications",
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
      skinBlackBlu: "BlackBlu"
    }
  };

  const t = translations[settings?.language || 'pl'] || translations.pl;

  // Show loading if user is not loaded yet
  if (!authUser || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-[#0f0f16] dark:via-[#14141f] dark:to-[#1a1a2e] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">{t.title}</h1>
            <p className="text-slate-600 dark:text-slate-400">{t.subtitle}</p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-white dark:bg-[#1a1a2e] shadow-lg border border-slate-200 dark:border-[#2d2d40]">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              {t.profile}
            </TabsTrigger>
            <TabsTrigger value="preferences">
              <Globe className="w-4 h-4 mr-2" />
              {t.preferences}
            </TabsTrigger>
            <TabsTrigger value="trading">
              <Shield className="w-4 h-4 mr-2" />
              {t.trading}
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              {t.notifications}
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
              <CardHeader>
                <CardTitle>{t.profile}</CardTitle>
                <CardDescription>Podstawowe informacje o Twoim koncie</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t.name}</Label>
                  <Input
                    value={user?.fullName || ""}
                    disabled
                    className="bg-slate-50"
                  />
                  <p className="text-xs text-slate-500 mt-1">Możesz zmienić imię w ustawieniach konta</p>
                </div>

                <div>
                  <Label>{t.email}</Label>
                  <Input
                    value={user?.email || ""}
                    disabled
                    className="bg-slate-50"
                  />
                  <p className="text-xs text-slate-500 mt-1">Email nie może być zmieniony</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <Card className="bg-white dark:bg-[#1a1a2e] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
              <CardHeader>
                <CardTitle>{t.preferences}</CardTitle>
                <CardDescription>Personalizuj wygląd i język aplikacji</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t.language}</Label>
                  <Select value={settings.language || "pl"} onValueChange={(value) => setSettings({ ...settings, language: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pl">🇵🇱 Polski</SelectItem>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{t.currency}</Label>
                  <Select value={settings.default_currency || "USD"} onValueChange={(value) => setSettings({ ...settings, default_currency: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t.light}</SelectItem>
                      <SelectItem value="dark">{t.dark}</SelectItem>
                      <SelectItem value="auto">{t.auto}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </CardContent>
            </Card>
          </TabsContent>

          {/* Trading Tab */}
          <TabsContent value="trading">
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
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
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-8"
            disabled={updateSettingsMutation.isPending}
          >
            {updateSettingsMutation.isPending ? "Zapisywanie..." : t.save}
          </Button>
        </div>
      </div>
    </div>
  );
}