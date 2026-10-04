import React, { lazy, Suspense } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronRight, Plus, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useLanguage } from "@/components/LanguageProvider";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";
import SessionClocks from "@/components/SessionClocks";
import HeaderAccountSync from "@/components/HeaderAccountSync";
import ReminderWatcher from "@/components/ReminderWatcher";
import CommandSearch, { CommandSearchHost } from "@/components/CommandSearch";
import SessionRhythmBar from "@/components/SessionRhythmBar";
import AppDock from "@/components/AppDock";
import { applyTheme } from "@/lib/userSettings";
import { getAvatarPreset, getUserDisplayName, getUserInitials } from "@/lib/avatars";
import { useSubscription } from "@/hooks/use-subscription";

const FloatingCalculator = lazy(() => import("@/components/calculators/FloatingCalculator"));

function normalizePath(p) {
  if (!p) return "";
  return (p.split("?")[0].replace(/\/+$/, "") || "/").toLowerCase();
}

function isTradeDetailsPath(p) {
  const n = normalizePath(p);
  return n === "/trade" || n.startsWith("/trade/") || n === "/tradedetails";
}

export default function Layout({ children }) {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const { subscription } = useSubscription(user?.id);

  const displayName = getUserDisplayName(user, t("profile"));
  const initials = getUserInitials(user);
  const avatarPreset = getAvatarPreset(user?.avatar);
  const tradePage = isTradeDetailsPath(location.pathname);
  const isPro = subscription?.status && subscription.status !== "free";

  React.useEffect(() => {
    if (!user) return;
    const savedTheme = localStorage.getItem("appTheme");
    const effectiveTheme =
      savedTheme === "dark" || savedTheme === "light" ? savedTheme : user.theme || "auto";
    applyTheme(effectiveTheme);
  }, [user]);

  const onAddTrade = () => {
    navigate(`${createPageUrl("Journal")}?add=1`);
  };

  return (
    <>
      <CommandSearchHost />
      <div className="app-atmosphere flex h-full min-h-0 w-full flex-col overflow-hidden bg-[hsl(var(--app-shell))]">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-[hsl(var(--app-shell))] px-1 py-1.5 pt-[max(0.35rem,env(safe-area-inset-top))] sm:gap-2.5 sm:px-2">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <Link to={createPageUrl("Dashboard")} className="flex min-w-0 items-center gap-1.5">
              <img
                src="/aikeeptrade-icon-hires.png"
                alt="AiKeepTrade"
                width="24"
                height="24"
                className="h-6 w-6 shrink-0 rounded-md object-contain"
              />
              <span className="hidden truncate text-[13px] font-semibold tracking-tight text-foreground sm:inline">
                AiKeepTrade
              </span>
              <span className="hidden rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary sm:inline">
                {isPro ? "PRO" : "FREE"}
              </span>
            </Link>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onAddTrade}
              className="h-7 gap-1 border-primary/70 bg-transparent px-2 text-[11px] font-semibold text-primary hover:bg-primary/10 hover:text-primary sm:px-2.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("addTrade") || "Dodaj transakcję"}</span>
            </Button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground md:hidden"
              aria-label={t("search")}
              onClick={() => window.dispatchEvent(new Event("open-command-search"))}
            >
              <Search className="h-4 w-4" />
            </button>
            <div className="hidden md:block">
              <CommandSearch variant="header" />
            </div>
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
                  <Button variant="ghost" size="sm" className="hidden h-7 gap-2 px-2 hover:bg-white/5 md:flex" asChild>
                    <Link to={createPageUrl("Settings")}>
                      <Avatar className="h-6 w-6">
                        <AvatarFallback
                          className={`bg-gradient-to-br text-[10px] font-semibold text-white ${avatarPreset.gradient}`}
                        >
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

        <SessionRhythmBar />

        <main
          className={`min-h-0 min-w-0 flex-1 cyber-dashboard dash-scr dashboard-surface bg-[hsl(var(--background))] ${
            tradePage ? "flex flex-col overflow-hidden" : "overflow-x-hidden overflow-y-auto"
          }`}
        >
          <div
            className={
              tradePage
                ? "app-content-pad flex w-full flex-1 min-h-0 flex-col overflow-hidden py-3"
                : "app-content-pad app-dock-pad mx-auto w-full max-w-[1920px] py-2 sm:py-2.5"
            }
          >
            {children}
          </div>
        </main>
      </div>

      <AppDock user={user} onLogout={logout} />
      <ReminderWatcher />
      {!isMobile && (
        <Suspense fallback={null}>
          <FloatingCalculator />
        </Suspense>
      )}
    </>
  );
}
