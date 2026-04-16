import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from '@/lib/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LayoutDashboard, BookOpen, BarChart3, Wallet, Brain, Calendar,
  Settings, LogOut, NotebookPen, CreditCard, ListTodo,
  ChevronRight, User, FlaskConical,
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
  SidebarFooter,
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

/** Sidebar IA: core daily tools first (TradesViz / Tradervue), then insights, workspace, account (TradeZella-style bottom account). */
const NAV_GROUPS = (t) => [
  {
    label: t("navGroupMain"),
    items: [
      { title: t("dashboard"), url: createPageUrl("Dashboard"), icon: LayoutDashboard },
      { title: t("journal"), url: createPageUrl("Journal"), icon: BookOpen },
      { title: t("plannedTrades") || "Planned", url: createPageUrl("Planned"), icon: ListTodo },
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
  {
    label: t("navGroupAccount"),
    items: [
      { title: t("settings"), url: createPageUrl("Settings"), icon: Settings },
      { title: t("billing"), url: createPageUrl("Billing"), icon: CreditCard },
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

  const displayName = user?.fullName?.trim() || user?.email || t('profile');
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
          className="cyber-app-sidebar border-r border-sidebar-border/80 bg-sidebar shadow-[inset_-1px_0_0_0_hsl(var(--sidebar-border)/0.35)]"
          collapsible="icon"
        >
          {/* Logo — compact brand rail (Notion / Linear density) */}
          <SidebarHeader className="border-b border-sidebar-border/70 px-3 py-3.5 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3 bg-gradient-to-b from-sidebar-accent/25 to-transparent">
            <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center rounded-xl px-1 py-0.5">
              <div className="logo-arrow logo-arrow-square w-[38px] h-[38px] flex-shrink-0 rounded-xl ring-1 ring-sidebar-border/60 shadow-sm">
                <span className="logo-arrow-path" />
                <span className="logo-arrow-shape"><span className="logo-arrow-letter-text">A</span></span>
                <span className="logo-arrow-tip"><span className="logo-arrow-letter-text">I</span></span>
                <span className="logo-arrow-wave" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden min-w-0">
                <h2 className="font-semibold text-[0.9375rem] text-sidebar-foreground tracking-tight truncate leading-tight">
                  AiKeepTrade
                </h2>
                <p className="text-[11px] text-muted-foreground/90 mt-0.5 font-medium">{t("navTagline")}</p>
              </div>
            </div>
          </SidebarHeader>

          {/* Navigation — grouped like TradesViz / TradeZella (workflow → insights → tools → account) */}
          <SidebarContent className="flex-1 px-2.5 py-3 !flex !flex-col !overflow-hidden gap-0">
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
            {/* Spacer — pushes footer to the very bottom regardless of resolution */}
            <div className="flex-1" />
          </SidebarContent>

          {/* User footer */}
          <SidebarFooter className="border-t border-sidebar-border/80 px-2.5 py-2.5 bg-sidebar-accent/15">
            {user && (
              <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl border border-sidebar-border/50 bg-sidebar/80 hover:bg-sidebar-accent/40 transition-colors cursor-default group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:border-transparent">
                <Avatar className="h-8 w-8 flex-shrink-0 ring-2 ring-sidebar-border/40">
                  <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
                    {initials || <User className="w-3.5 h-3.5" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="text-[13px] font-semibold text-sidebar-foreground truncate leading-tight">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {user?.email || ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="group-data-[collapsible=icon]:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors flex-shrink-0"
                  title={t("logout")}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>

        {/* Main content — cyber-dashboard: tło, karty i typografia jak na Dashboardzie */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden cyber-dashboard dashboard-surface">

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
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">
                      {initials || <User className="w-3.5 h-3.5" />}
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
          <div className="flex-1 overflow-auto flex flex-col">
            <div className="flex-1 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
              {children}
            </div>
            <Footer variant="app" />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

export default function Layout({ children }) {
  return <LayoutContent>{children}</LayoutContent>;
}
