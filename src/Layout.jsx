import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from '@/lib/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { LayoutDashboard, BookOpen, BarChart3, Wallet, Brain, Calendar, Settings, Activity, LogOut, User, NotebookPen, CreditCard } from "lucide-react";
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

function LayoutContent({ children }) {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  
  const navigationItems = [
    {
      title: t('dashboard'),
      url: createPageUrl("Dashboard"),
      icon: LayoutDashboard,
    },
    {
      title: t('journal'),
      url: createPageUrl("Journal"),
      icon: BookOpen,
    },
    {
      title: t('notes'),
      url: createPageUrl("Notes"),
      icon: NotebookPen,
    },
    {
      title: t('calendar'),
      url: createPageUrl("Calendar"),
      icon: Calendar,
    },
    {
      title: t('analytics'),
      url: createPageUrl("Analytics"),
      icon: BarChart3,
    },
    {
      title: t('accounts'),
      url: createPageUrl("Accounts"),
      icon: Wallet,
    },
    {
      title: t('strategies'),
      url: createPageUrl("Strategies"),
      icon: Brain,
    },
    {
      title: t('progressTracker'),
      url: createPageUrl("ProgressTracker"),
      icon: Activity,
    },
    {
      title: t('settings'),
      url: createPageUrl("Settings"),
      icon: Settings,
    },
    {
      title: t('billing'),
      url: createPageUrl("Billing"),
      icon: CreditCard,
    },
  ];
  const location = useLocation();
  const [userState, setUserState] = React.useState(user);

  const displayName = user?.fullName?.trim() || user?.email || t('profile');
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  React.useEffect(() => {
    setUserState(user);
    
    // Apply theme
    if (user) {
      const theme = user.theme || 'light';
      document.documentElement.classList.remove('dark');

      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (theme === 'light') {
        // Already removed all classes
      } else {
        // auto - use system preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
          document.documentElement.classList.add('dark');
        }
      }

      const allowedSkins = new Set(['default', 'ocean', 'blackblu']);
      const nextSkin = allowedSkins.has(user.skin) ? user.skin : 'ocean';
      document.documentElement.setAttribute('data-skin', nextSkin || 'ocean');
    }
  }, [user]);

  return (
    <SidebarProvider defaultOpen={!isMobile} className="dark:bg-[#14141f]">
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-blue-50 dark:from-[#0f0f16] dark:to-[#14141f] app-shell">
        <Sidebar className="border-r border-slate-200/40 dark:border-white/5 backdrop-blur-sm dark:bg-[#14141f]/95 gradient-separator-vertical" collapsible="icon">
          <SidebarHeader className="border-b border-slate-200/60 dark:border-[#2d2d40] p-6 group-data-[collapsible=icon]:p-3">
            <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
              <div className="logo-arrow logo-arrow-square w-[46px] h-[46px] rounded-2xl">
                <span className="logo-arrow-path" />
                <span className="logo-arrow-shape"><span className="logo-arrow-letter-text">T</span></span>
                <span className="logo-arrow-tip"><span className="logo-arrow-letter-text">L</span></span>
                <span className="logo-arrow-wave" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <h2 className="font-bold text-lg bg-gradient-to-r from-emerald-400 to-blue-500 dark:from-emerald-300 dark:to-blue-400 bg-clip-text text-transparent">TRADE LOG</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Trading Journal</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3 dark:bg-[#14141f]">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 py-2">
                Menu
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        tooltip={item.title}
                        className={`hover:bg-blue-50 dark:hover:bg-[#2d2d40] hover:text-blue-700 dark:hover:text-violet-300 transition-all duration-200 rounded-xl mb-1 ${
                          location.pathname === item.url 
                            ? 'sidebar-active bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-violet-600 dark:to-purple-600 text-white hover:text-white shadow-lg shadow-blue-500/30 dark:shadow-violet-500/30' 
                            : 'dark:text-slate-300'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:justify-center">
                          <item.icon className="w-5 h-5 flex-shrink-0" />
                          <span className="font-medium group-data-[collapsible=icon]:hidden">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-transparent dark:bg-[#14141f]/80 backdrop-blur-md border-b border-slate-200/40 dark:border-white/5 px-4 sm:px-6 py-3 sm:py-4 sticky top-0 z-10 md:hidden gradient-separator">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                <SidebarTrigger className="hover:bg-slate-100 dark:hover:bg-[#2d2d40] p-2 rounded-lg transition-colors duration-200 flex-shrink-0" />
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 dark:from-emerald-300 dark:to-blue-400 bg-clip-text text-transparent truncate">TRADE LOG</h1>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                <LanguageToggle />
                <ThemeToggle />
              </div>
            </div>
          </header>

          <header className="bg-transparent dark:bg-[#14141f]/80 backdrop-blur-md border-b border-slate-200/40 dark:border-white/5 px-6 py-4 sticky top-0 z-10 hidden md:flex items-center justify-between gradient-separator">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 dark:hover:bg-[#2d2d40] p-2 rounded-lg transition-colors duration-200" />
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-blue-500 text-white text-[10px] font-semibold">
                      {initials || <User className="w-3.5 h-3.5" />}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-[160px] truncate font-semibold">
                    {displayName}
                  </span>
                </Button>
              )}
              <div className="flex items-center gap-2">
                <LanguageToggle />
                <ThemeToggle />
              </div>
              {user && (
                <Button variant="outline" size="sm" onClick={() => logout()} className="gap-2">
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('logout')}</span>
                </Button>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-auto flex flex-col">
            <div className="flex-1 mx-auto" style={{ width: '75%', maxWidth: '75%' }}>
              {children}
            </div>
            <Footer />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

export default function Layout({ children }) {
  return <LayoutContent>{children}</LayoutContent>;
}