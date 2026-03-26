import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from '@/lib/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LayoutDashboard, BookOpen, BarChart3, Wallet, Brain, Calendar,
  Settings, LogOut, NotebookPen, CreditCard, ListTodo,
  ChevronRight, User,
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

const NAV_GROUPS = (t) => [
  {
    label: "TRADING",
    items: [
      { title: t('dashboard'), url: createPageUrl("Dashboard"), icon: LayoutDashboard },
      { title: t('journal'), url: createPageUrl("Journal"), icon: BookOpen },
      { title: t('plannedTrades') || 'Planned', url: createPageUrl("Planned"), icon: ListTodo },
      { title: t('calendar'), url: createPageUrl("Calendar"), icon: Calendar },
    ],
  },
  {
    label: "ANALIZA",
    items: [
      { title: t('analytics'), url: createPageUrl("Analytics"), icon: BarChart3 },
      { title: t('strategies'), url: createPageUrl("Strategies"), icon: Brain },
    ],
  },
  {
    label: "WORKSPACE",
    items: [
      { title: t('notes'), url: createPageUrl("Notes"), icon: NotebookPen },
      { title: t('accounts'), url: createPageUrl("Accounts"), icon: Wallet },
    ],
  },
  {
    label: "KONTO",
    items: [
      { title: t('settings'), url: createPageUrl("Settings"), icon: Settings },
      { title: t('billing'), url: createPageUrl("Billing"), icon: CreditCard },
    ],
  },
];

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
      : (user.theme || 'light');

    document.documentElement.classList.remove('dark');
    if (effectiveTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (effectiveTheme !== 'light') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      }
    }
    // Remove legacy skin attribute
    document.documentElement.removeAttribute('data-skin');
  }, [user]);

  const navGroups = NAV_GROUPS(t);

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-screen flex w-full bg-background">

        <Sidebar
          className="border-r border-border bg-sidebar"
          collapsible="icon"
        >
          {/* Logo */}
          <SidebarHeader className="border-b border-sidebar-border px-4 py-3 group-data-[collapsible=icon]:px-3 group-data-[collapsible=icon]:py-3">
            <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
              <div className="logo-arrow logo-arrow-square w-[36px] h-[36px] flex-shrink-0 rounded-xl">
                <span className="logo-arrow-path" />
                <span className="logo-arrow-shape"><span className="logo-arrow-letter-text">A</span></span>
                <span className="logo-arrow-tip"><span className="logo-arrow-letter-text">I</span></span>
                <span className="logo-arrow-wave" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden min-w-0">
                <h2 className="font-semibold text-sm text-sidebar-foreground tracking-tight truncate">
                  AiKeepTrade
                </h2>
                <p className="text-[11px] text-muted-foreground">Trading Journal</p>
              </div>
            </div>
          </SidebarHeader>

          {/* Navigation Groups */}
          <SidebarContent className="flex-1 px-2 py-3 !flex !flex-col !overflow-hidden">
            {navGroups.map((group, idx) => (
              <SidebarGroup key={group.label} className={`p-0 ${idx > 0 ? 'mt-5' : ''}`}>
                <SidebarGroupLabel className="h-5 text-[9px] font-bold text-muted-foreground/55 uppercase tracking-widest px-2.5 mb-1 group-data-[collapsible=icon]:hidden">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.url;
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            asChild
                            tooltip={item.title}
                            className={`
                              relative rounded-md transition-all duration-150 !py-0
                              ${isActive
                                ? 'sidebar-active font-medium'
                                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                              }
                            `}
                          >
                            <Link
                              to={item.url}
                              className="flex items-center gap-2.5 px-2.5 py-2 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:justify-center"
                            >
                              <item.icon className="w-[15px] h-[15px] flex-shrink-0" />
                              <span className="text-[13px] group-data-[collapsible=icon]:hidden">{item.title}</span>
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
          <SidebarFooter className="border-t border-sidebar-border px-2 py-2">
            {user && (
              <div className="flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-sidebar-accent transition-colors cursor-default group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
                    {initials || <User className="w-3 h-3" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="text-[13px] font-medium text-sidebar-foreground truncate leading-tight">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {user?.email || ''}
                  </p>
                </div>
                <button
                  onClick={() => logout()}
                  className="group-data-[collapsible=icon]:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors flex-shrink-0"
                  title={t('logout')}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </SidebarFooter>
        </Sidebar>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Top header bar */}
          <header className="bg-background/80 backdrop-blur-md border-b border-border px-4 md:px-6 py-3 sticky top-0 z-10 flex items-center justify-between gap-4">
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
