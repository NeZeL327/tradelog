import React, { lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from '@/lib/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LayoutDashboard, BookOpen, BarChart3, Wallet, Brain, Calendar, CalendarCheck2,
  LogOut, NotebookPen, ListTodo, AlarmClockOff, Target,
  ChevronRight, User, FlaskConical, Settings as SettingsIcon, FileBarChart, Calculator, ClipboardList,
  Search, CandlestickChart,
} from "lucide-react";

const FloatingCalculator = lazy(() => import("@/components/calculators/FloatingCalculator"));
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
import HeaderAccountSync from "@/components/HeaderAccountSync";
import ReminderWatcher from "@/components/ReminderWatcher";
import MobileTabBar from "@/components/MobileTabBar";
import CommandSearch, { CommandSearchHost } from "@/components/CommandSearch";
import QuoteLine from "@/components/QuoteLine";
import { applyTheme } from "@/lib/userSettings";
import { getAvatarPreset, getUserDisplayName, getUserInitials } from "@/lib/avatars";
import { useSubscription } from "@/hooks/use-subscription";

/** Sidebar IA: core daily tools first (TradesViz / Tradervue), then insights, workspace, account (TradeZella-style bottom account). */
const NAV_GROUPS = (t) => [
  {
    label: t("navGroupMain"),
    items: [
      { title: t("dashboard"), url: createPageUrl("Dashboard"), icon: LayoutDashboard },
      { title: t("journal"), url: createPageUrl("Journal"), icon: BookOpen },
      { title: t("calendar"), url: createPageUrl("Calendar"), icon: Calendar },
      { title: t("dayPlan") || "Plan dnia", url: createPageUrl("DayPlan"), icon: CalendarCheck2 },
      { title: t("plannedTrades") || "Planned", url: createPageUrl("Planned"), icon: ListTodo },
      { title: t("missedTrades") || "Missed", url: createPageUrl("Missed"), icon: AlarmClockOff },
    ],
  },
  {
    label: t("navGroupAnalysis"),
    items: [
      { title: t("tradeDetails"), url: "/trade", icon: CandlestickChart },
      { title: t("analytics"), url: createPageUrl("Analytics"), icon: BarChart3 },
      { title: t("backtesting"), url: createPageUrl("Backtesting"), icon: FlaskConical },
      { title: t("strategies"), url: createPageUrl("Strategies"), icon: Brain },
      { title: t("goals") || "Cele", url: createPageUrl("Goals"), icon: Target },
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
      { title: t("processReview") || "Przegląd procesu", url: createPageUrl("ProcessReview"), icon: ClipboardList },
      { title: t("accounts"), url: createPageUrl("Accounts"), icon: Wallet },
    ],
  },
];

function normalizePath(p) {
  if (!p) return "";
  const s = p.split("?")[0].replace(/\/+$/, "") || "/";
  return s.toLowerCase();
}

function isTradeDetailsPath(p) {
  const n = normalizePath(p);
  return n === "/trade" || n.startsWith("/trade/") || n === "/tradedetails";
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
  const { subscription } = useSubscription(user?.id);
  const isFreePlan = !subscription?.status || subscription.status === "free";

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
  const tradePage = isTradeDetailsPath(pathNorm);

  return (
    <>
      <CommandSearchHost />
      {/* Connected shell (sidebar + header) + inset rounded content — both themes */}
      <div className="h-full min-h-0 flex w-full overflow-hidden bg-[hsl(var(--app-shell))] app-atmosphere">

        <Sidebar
          className="cyber-app-sidebar border-transparent bg-transparent"
          collapsible="icon"
        >
          <div className="sidebar-mountain-layer" aria-hidden="true">
            <img src="/sidebar-mountains.png" alt="" />
          </div>
          {/* Brand row */}
          <SidebarHeader className="relative z-[1] h-14 shrink-0 border-b border-[#3e484f]/30 bg-[#191b23] px-3 group-data-[collapsible=icon]:h-auto group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2">
            <div className="flex h-full items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
              <div className="flex min-w-0 items-center gap-2">
                <img
                  src="/aikeeptrade-icon-hires.png"
                  alt="AiKeepTrade"
                  width="22"
                  height="22"
                  className="h-[22px] w-[22px] flex-shrink-0 rounded-sm object-contain"
                />
                <span className="truncate font-mono text-[15px] font-semibold leading-6 tracking-[0.01em] text-[#e1e2ec] group-data-[collapsible=icon]:hidden">
                  AiKeepTrade
                </span>
                <span className="shrink-0 rounded-sm bg-[#32353d] px-1 py-0.5 font-mono text-[11px] font-semibold leading-none tracking-[0.06em] text-[#8ed5ff] group-data-[collapsible=icon]:hidden">
                  PRO
                </span>
              </div>
            </div>
          </SidebarHeader>
          <div className="relative z-[1] px-1 pt-2 group-data-[collapsible=icon]:px-2">
            <CommandSearch variant="sidebar" />
          </div>

          {/* Navigation — grouped like TradesViz / TradeZella (workflow → insights → tools → account) */}
          <SidebarContent className="relative z-[1] flex-1 min-h-0 px-1 py-2 !flex !flex-col overflow-y-auto gap-0 sidebar-scroll">
            {navGroups.map((group, idx) => (
              <SidebarGroup key={group.label} className="p-0">
                <SidebarGroupLabel className="nav-group-label h-auto px-2 py-1 mb-0 mt-3 text-[#87929a] group-data-[collapsible=icon]:hidden">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {group.items.map((item) => {
                      const isActive =
                        pathNorm === normalizePath(item.url)
                        || (isTradeDetailsPath(item.url) && isTradeDetailsPath(pathNorm));
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            tooltip={item.title}
                            className={`
                              nav-row relative rounded transition-colors duration-150 !py-0 !h-[30px]
                              ${isActive
                                ? "sidebar-active"
                                : "text-[#bdc8d1] hover:bg-[#191b23] hover:text-[#e1e2ec]"
                              }
                            `}
                          >
                            <NavLink
                              to={item.url}
                              onNavigate={closeMobileNav}
                              className="flex items-center gap-2 h-[30px] px-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:min-h-[2.35rem]"
                            >
                              <item.icon
                                className="w-[18px] h-[18px] flex-shrink-0"
                                strokeWidth={1.75}
                              />
                              <span className="text-[13px] font-normal leading-[18px] tracking-normal group-data-[collapsible=icon]:hidden">{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}

            <div className="mt-auto pt-3 space-y-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <div className="group-data-[collapsible=icon]:hidden px-0.5">
                <QuoteLine variant="sidebar" />
              </div>
              {user && (
                <NavLink
                  to={createPageUrl("Settings")}
                  onNavigate={closeMobileNav}
                  className="flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-foreground/5 transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1"
                >
                  <Avatar className="h-8 w-8 ring-1 ring-border">
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
                    <p className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium mt-0.5">
                      <span>{user?.plan || t("freePlanLabel")}</span>
                      {isFreePlan && (
                        <span className="text-primary font-semibold">{t("upgradePlan")}</span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                </NavLink>
              )}
              <SidebarMenu className="gap-1">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={t("settings")}
                    className={`nav-row relative rounded transition-colors duration-150 !py-0 !h-[30px] ${
                      pathNorm === normalizePath(createPageUrl("Settings"))
                        ? "sidebar-active"
                        : "text-[#bdc8d1] hover:bg-[#191b23] hover:text-[#e1e2ec]"
                    }`}
                  >
                    <NavLink
                      to={createPageUrl("Settings")}
                      onNavigate={closeMobileNav}
                      className="flex items-center gap-2 h-[30px] px-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center"
                    >
                      <SettingsIcon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.75} />
                      <span className="text-[13px] font-normal leading-[18px] group-data-[collapsible=icon]:hidden">{t("settings")}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={t("logout")}
                    onClick={() => logout()}
                    className="nav-row relative rounded transition-colors duration-150 !py-0 !h-[30px] text-[#bdc8d1] hover:bg-[#191b23] hover:text-[#ffb4ab]"
                  >
                    <div className="flex items-center gap-2 h-[30px] px-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center w-full cursor-pointer">
                      <LogOut className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.75} />
                      <span className="text-[13px] font-normal leading-[18px] group-data-[collapsible=icon]:hidden">{t("logout")}</span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
          </SidebarContent>
        </Sidebar>

        {/* Column: top bar (shell) + inset content panel */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden bg-[hsl(var(--app-shell))]">
          {/* Top header — same color as sidebar (connected frame) */}
          <header className="cyber-app-header sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-[hsl(var(--app-shell))] px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:gap-3 sm:px-4 md:px-5">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <SidebarTrigger className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-black/5 hover:text-foreground sm:h-8 sm:w-8 dark:hover:bg-white/5" />
              <span className="truncate text-sm font-semibold text-foreground md:hidden">AiKeepTrade</span>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground md:hidden"
                aria-label={t("search")}
                onClick={() => {
                  window.dispatchEvent(new Event("open-command-search"));
                }}
              >
                <Search className="w-4 h-4" />
              </button>
            </div>

            <div className="flex min-w-0 shrink items-center gap-1.5 sm:gap-2.5">
              <HeaderAccountSync />
              <SessionClocks />
              <div className="header-cluster flex h-8 items-center gap-0.5 px-0.5">
                <LanguageToggle className="!h-7 border-0 bg-transparent p-0.5 shadow-none" />
                <span className="header-cluster-sep" aria-hidden />
                <ThemeToggle className="!h-7 border-0 bg-transparent p-0.5 shadow-none" />
                {user ? (
                  <>
                    <span className="header-cluster-sep hidden md:block" aria-hidden />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hidden h-7 gap-2 px-2 hover:bg-white/5 md:flex"
                      asChild
                    >
                      <Link to={createPageUrl("Settings")}>
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className={`bg-gradient-to-br text-[10px] font-semibold text-white ${avatarPreset.gradient}`}>
                            {avatarPreset.emoji ? (
                              <span className="text-[13px] leading-none">{avatarPreset.emoji}</span>
                            ) : (
                              initials || <User className="h-3.5 w-3.5" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden max-w-[120px] truncate text-sm font-medium lg:inline">
                          {displayName}
                        </span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </Link>
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </header>

          {/* Content panel — rounded inset (connected transition under header) */}
          <main className={`flex-1 min-h-0 min-w-0 cyber-dashboard dashboard-surface bg-[hsl(var(--background))] md:mr-2 md:mb-2 md:rounded-md md:border border-border ${tradePage ? "overflow-hidden flex flex-col" : "overflow-y-auto overflow-x-hidden"}`}>
            <div className={tradePage
              ? "flex-1 min-h-0 flex flex-col overflow-hidden w-full px-3 sm:px-5 py-3"
              : "w-full max-w-screen-2xl mx-auto px-3 sm:px-5 py-3 sm:py-4 pb-32 app-mobile-tab-pad"
            }>
              {children}
            </div>
          </main>
        </div>
      </div>
      <MobileTabBar />
      <ReminderWatcher />
      {!isMobile && (
        <Suspense fallback={null}>
          <FloatingCalculator />
        </Suspense>
      )}
    </>
  );
}

export default function Layout({ children }) {
  const isMobile = useIsMobile();
  return (
    <SidebarProvider defaultOpen={!isMobile} className="h-full min-h-0 overflow-hidden">
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
}
