import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from '@/lib/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LayoutDashboard, BookOpen, BarChart3, Wallet, Brain, Calendar,
  LogOut, NotebookPen, ListTodo, AlarmClockOff,
  ChevronRight, User, FlaskConical, Settings as SettingsIcon,
  CreditCard,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLanguage } from "@/components/LanguageProvider";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";
import Footer from "@/components/Footer";
import { applyTheme } from "@/lib/userSettings";
import { getAvatarPreset, getUserDisplayName, getUserInitials } from "@/lib/avatars";

/** Sidebar IA: core daily tools first (TradesViz / Tradervue), then insights, workspace, account (TradeZella-style bottom account). */
const NAV_GROUPS = (t) => [
  {
    label: t("navGroupMain"),
    items: [
      { title: t("dashboard"), url: createPageUrl("Dashboard"), icon: LayoutDashboard },
      { title: t("journal"), url: createPageUrl("Journal"), icon: BookOpen },
      { title: t("plannedTrades") || "Planned", url: createPageUrl("Planned"), icon: ListTodo },
      { title: t("missedTrades") || "Missed", url: createPageUrl("Missed"), icon: AlarmClockOff },
      { title: t("calendar"), url: createPageUrl("Calendar"), icon: Calendar },
    ],
  },
  {
    label: t("navGroupAnalysis"),
    items: [
      { title: t("analytics"), url: createPageUrl("Analytics"), icon: BarChart3 },
      { title: t("backtesting"), url: createPageUrl("Backtesting"), icon: FlaskConical },
      { title: t("strategies"), url: createPageUrl("Strategies"), icon: Brain },
    ],
  },
  {
    label: t("navGroupWorkspace"),
    items: [
      { title: t("notes"), url: createPageUrl("Notes"), icon: NotebookPen },
      { title: t("accounts"), url: createPageUrl("Accounts"), icon: Wallet },
    ],
  },
];

function normalizePath(p) {
  if (!p) return "";
  const s = p.split("?")[0].replace(/\/+$/, "") || "/";
  return s.toLowerCase();
}

function LayoutContent({ children }) {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();

  const displayName = getUserDisplayName(user, t('profile'));
  const initials = getUserInitials(user);
  const avatarPreset = getAvatarPreset(user?.avatar);

  React.useEffect(() => {
    if (!user) return;
    const savedTheme = localStorage.getItem('appTheme');
    const effectiveTheme = savedTheme === 'dark' || savedTheme === 'light'
      ? savedTheme
      : (user.theme || 'auto');

    // Avoid "flash" by not removing 'dark' first; applyTheme toggles in one pass.
    applyTheme(effectiveTheme);
  }, [user]);

  const navGroups = NAV_GROUPS(t);
  const pathNorm = normalizePath(location.pathname);

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-screen flex w-full bg-background">

        <Sidebar
          className="cyber-app-sidebar border-r border-sidebar-border/80 bg-sidebar"
          collapsible="icon"
        >
          {/* FX-Replay-style brand row + compact user card */}
          <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-3 group-data-[collapsible=icon]:px-2 space-y-3">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center px-1">
              <img
                src="/aikeeptrade-icon-hires.png"
                alt="AiKeepTrade"
                width="36"
                height="36"
                className="w-9 h-9 flex-shrink-0 rounded-lg object-contain"
              />
              <span className="text-lg font-bold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                AiKeepTrade
              </span>
            </div>

            {/* Compact user pill — avatar + name (FX Replay style) */}
            {user && (
              <Link
                to={createPageUrl("Settings")}
                title={t("settings")}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-sidebar-accent/60 transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1"
              >
                <Avatar className="h-8 w-8 ring-1 ring-sidebar-border/60">
                  <AvatarFallback
                    className={`text-white font-semibold bg-gradient-to-br ${avatarPreset.gradient}`}
                  >
                    {avatarPreset.emoji ? (
                      <span className="text-base leading-none">{avatarPreset.emoji}</span>
                    ) : (
                      <span className="text-[11px]">{initials || <User className="w-3.5 h-3.5" />}</span>
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <p className="text-[13px] font-semibold text-sidebar-foreground truncate leading-tight">
                    {displayName}
                  </p>
                  {user?.plan && (
                    <p className="text-[10px] uppercase tracking-wider text-blue-400/90 font-semibold mt-0.5">{user.plan}</p>
                  )}
                </div>
              </Link>
            )}
          </SidebarHeader>

          {/* Navigation — grouped like TradesViz / TradeZella (workflow → insights → tools → account) */}
          <SidebarContent className="flex-1 min-h-0 px-2.5 py-3 !flex !flex-col overflow-y-auto gap-0 sidebar-scroll">
            {navGroups.map((group, idx) => (
              <SidebarGroup key={group.label} className="p-0">
                {idx > 0 && (
                  <div className="h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent my-3 mx-1 group-data-[collapsible=icon]:my-2" aria-hidden />
                )}
                <SidebarGroupLabel className="h-auto text-[11px] font-semibold text-muted-foreground/70 normal-case tracking-wide px-2.5 mb-1.5 group-data-[collapsible=icon]:hidden">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {group.items.map((item) => {
                      const isActive = pathNorm === normalizePath(item.url);
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            tooltip={item.title}
                            className={`
                              relative rounded-xl transition-all duration-200 !py-0 !h-auto
                              ${isActive
                                ? "sidebar-active font-semibold shadow-sm"
                                : "text-sidebar-foreground/90 hover:bg-sidebar-accent/85 hover:text-sidebar-accent-foreground"
                              }
                            `}
                          >
                            <Link
                              to={item.url}
                              className="flex items-center gap-3 min-h-[2.5rem] px-3 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:min-h-[2.35rem]"
                            >
                              <item.icon
                                className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "opacity-100" : "opacity-85"}`}
                                strokeWidth={isActive ? 2.25 : 2}
                              />
                              <span className="text-[13px] leading-snug group-data-[collapsible=icon]:hidden">{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}

            {/* Bottom section — billing + settings + logout (FX Replay style) */}
            <div className="mt-auto pt-3 border-t border-sidebar-border/60 space-y-1">
              <SidebarMenu className="gap-1">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={t("billing") || "Subskrypcja"}
                    className={`relative rounded-xl transition-all duration-200 !py-0 !h-auto ${
                      pathNorm === normalizePath(createPageUrl("Billing"))
                        ? "sidebar-active font-semibold shadow-sm"
                        : "text-sidebar-foreground/90 hover:bg-sidebar-accent/85 hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <Link
                      to={createPageUrl("Billing")}
                      className="flex items-center gap-3 min-h-[2.5rem] px-3 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center"
                    >
                      <CreditCard className="w-[18px] h-[18px] flex-shrink-0 opacity-85" strokeWidth={2} />
                      <span className="text-[13px] leading-snug group-data-[collapsible=icon]:hidden">{t("billing") || "Subskrypcja"}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={t("settings")}
                    className={`relative rounded-xl transition-all duration-200 !py-0 !h-auto ${
                      pathNorm === normalizePath(createPageUrl("Settings"))
                        ? "sidebar-active font-semibold shadow-sm"
                        : "text-sidebar-foreground/90 hover:bg-sidebar-accent/85 hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <Link
                      to={createPageUrl("Settings")}
                      className="flex items-center gap-3 min-h-[2.5rem] px-3 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center"
                    >
                      <SettingsIcon className="w-[18px] h-[18px] flex-shrink-0 opacity-85" strokeWidth={2} />
                      <span className="text-[13px] leading-snug group-data-[collapsible=icon]:hidden">{t("settings")}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={t("logout")}
                    onClick={() => logout()}
                    className="relative rounded-xl transition-all duration-200 !py-0 !h-auto text-sidebar-foreground/80 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <div className="flex items-center gap-3 min-h-[2.5rem] px-3 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center w-full cursor-pointer">
                      <LogOut className="w-[18px] h-[18px] flex-shrink-0 opacity-85" strokeWidth={2} />
                      <span className="text-[13px] leading-snug group-data-[collapsible=icon]:hidden">{t("logout")}</span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
              <p className="text-[10px] text-muted-foreground/60 text-center px-3 pt-2 group-data-[collapsible=icon]:hidden">
                v1.0
              </p>
            </div>
          </SidebarContent>
        </Sidebar>

        {/* Main content — cyber-dashboard: tło, karty i typografia jak na Dashboardzie */}
        <main className="flex-1 flex flex-col min-w-0 min-h-screen overflow-auto cyber-dashboard dashboard-surface">

          {/* Top header bar */}
          <header className="cyber-app-header border-b px-4 md:px-6 py-3 sticky top-0 z-10 flex items-center justify-between gap-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-8 w-8 rounded-lg hover:bg-accent transition-colors duration-150 flex items-center justify-center text-muted-foreground hover:text-foreground" />

              {/* Mobile brand name */}
              <span className="md:hidden text-sm font-semibold text-foreground">AiKeepTrade</span>
            </div>

            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              {/* Desktop user button */}
              {user && (
                <Button variant="ghost" size="sm" className="hidden md:flex h-8 gap-2 items-center px-2.5" onClick={() => logout()}>
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className={`text-white text-[10px] font-semibold bg-gradient-to-br ${avatarPreset.gradient}`}>
                      {avatarPreset.emoji ? (
                        <span className="text-[13px] leading-none">{avatarPreset.emoji}</span>
                      ) : (
                        initials || <User className="w-3.5 h-3.5" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium max-w-[140px] truncate hidden lg:inline">
                    {displayName}
                  </span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                </Button>
              )}
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </div>
          <Footer variant="app" />
        </main>
      </div>
    </SidebarProvider>
  );
}

export default function Layout({ children }) {
  return <LayoutContent>{children}</LayoutContent>;
}
