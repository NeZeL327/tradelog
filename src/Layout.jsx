import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from '@/lib/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LayoutDashboard, BookOpen, BarChart3, Wallet, Brain, Calendar,
  LogOut, NotebookPen, ListTodo, AlarmClockOff,
  ChevronRight, User, FlaskConical, Settings as SettingsIcon, FileBarChart, Calculator,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLanguage } from "@/components/LanguageProvider";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";
import SessionClocks from "@/components/SessionClocks";
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
    label: t("navGroupCalculators"),
    items: [
      { title: t("calculators"), url: createPageUrl("Calculators"), icon: Calculator },
    ],
  },
  {
    label: t("navGroupWorkspace"),
    items: [
      { title: t("notes"), url: createPageUrl("Notes"), icon: NotebookPen },
      { title: t("reports") || "Raporty", url: createPageUrl("Raporty"), icon: FileBarChart },
      { title: t("accounts"), url: createPageUrl("Accounts"), icon: Wallet },
    ],
  },
];

function normalizePath(p) {
  if (!p) return "";
  const s = p.split("?")[0].replace(/\/+$/, "") || "/";
  return s.toLowerCase();
}

function NavLink({ to, children, className, onNavigate }) {
  return (
    <Link
      to={to}
      className={className}
      onClick={() => onNavigate?.()}
    >
      {children}
    </Link>
  );
}

function LayoutContent({ children }) {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const { setOpenMobile } = useSidebar();

  const displayName = getUserDisplayName(user, t('profile'));
  const initials = getUserInitials(user);
  const avatarPreset = getAvatarPreset(user?.avatar);

  const closeMobileNav = React.useCallback(() => {
    if (isMobile) setOpenMobile(false);
  }, [isMobile, setOpenMobile]);

  React.useEffect(() => {
    if (!user) return;
    const savedTheme = localStorage.getItem('appTheme');
    const effectiveTheme = savedTheme === 'dark' || savedTheme === 'light'
      ? savedTheme
      : (user.theme || 'auto');

    // Avoid "flash" by not removing 'dark' first; applyTheme toggles in one pass.
    applyTheme(effectiveTheme);
  }, [user]);

  // Close sheet after route change (back/forward, deep links)
  React.useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [location.pathname, isMobile, setOpenMobile]);

  const navGroups = NAV_GROUPS(t);
  const pathNorm = normalizePath(location.pathname);

  return (
    <>
      {/* Connected shell (sidebar + header) + inset rounded content — both themes */}
      <div className="min-h-full h-full flex w-full bg-[hsl(var(--app-shell))]">

        <Sidebar
          className="cyber-app-sidebar border-transparent bg-transparent"
          collapsible="icon"
        >
          {/* Brand row + compact user card */}
          <SidebarHeader className="border-transparent px-3 py-3 group-data-[collapsible=icon]:px-2 space-y-3">
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
              <NavLink
                to={createPageUrl("Settings")}
                onNavigate={closeMobileNav}
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
              </NavLink>
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
                            <NavLink
                              to={item.url}
                              onNavigate={closeMobileNav}
                              className="flex items-center gap-3 min-h-[2.75rem] px-3 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:min-h-[2.35rem]"
                            >
                              <item.icon
                                className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "opacity-100" : "opacity-85"}`}
                                strokeWidth={isActive ? 2.25 : 2}
                              />
                              <span className="text-[13px] leading-snug group-data-[collapsible=icon]:hidden">{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}

            {/* Bottom section — settings + logout */}
            <div className="mt-auto pt-3 border-t border-sidebar-border/50 space-y-1 dark:border-white/5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <SidebarMenu className="gap-1">
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
                    <NavLink
                      to={createPageUrl("Settings")}
                      onNavigate={closeMobileNav}
                      className="flex items-center gap-3 min-h-[2.75rem] px-3 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center"
                    >
                      <SettingsIcon className="w-[18px] h-[18px] flex-shrink-0 opacity-85" strokeWidth={2} />
                      <span className="text-[13px] leading-snug group-data-[collapsible=icon]:hidden">{t("settings")}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={t("logout")}
                    onClick={() => logout()}
                    className="relative rounded-xl transition-all duration-200 !py-0 !h-auto text-sidebar-foreground/80 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <div className="flex items-center gap-3 min-h-[2.75rem] px-3 py-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center w-full cursor-pointer">
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

        {/* Column: top bar (shell) + inset content panel */}
        <div className="flex-1 flex flex-col min-w-0 min-h-full h-full bg-[hsl(var(--app-shell))]">
          {/* Top header — same color as sidebar (connected frame) */}
          <header className="cyber-app-header border-transparent bg-transparent px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 sticky top-0 z-10 flex items-center justify-between gap-2 sm:gap-4 pt-[max(0.625rem,env(safe-area-inset-top))]">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <SidebarTrigger className="h-10 w-10 sm:h-8 sm:w-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0" />

              {/* Mobile brand name */}
              <span className="md:hidden text-sm font-semibold text-foreground truncate">AiKeepTrade</span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <SessionClocks />
              <LanguageToggle />
              <ThemeToggle />
              {/* Desktop user button */}
              {user && (
                <Button variant="ghost" size="sm" className="hidden md:flex h-8 gap-2 items-center px-2.5 hover:bg-black/5 dark:hover:bg-white/5" onClick={() => logout()}>
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

          {/* Content panel — rounded inset (connected transition under header) */}
          <main className="flex-1 flex flex-col min-w-0 overflow-auto cyber-dashboard dashboard-surface bg-[hsl(var(--background))] md:mr-3 md:mb-3 md:rounded-2xl md:border border-black/[0.06] dark:border-white/[0.06] shadow-[0_1px_3px_rgba(15,23,42,0.04)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex-1 w-full max-w-screen-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
            <Footer variant="app" />
          </main>
        </div>
      </div>
    </>
  );
}

export default function Layout({ children }) {
  const isMobile = useIsMobile();
  return (
    <SidebarProvider defaultOpen={!isMobile} className="!min-h-full h-full">
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
}
