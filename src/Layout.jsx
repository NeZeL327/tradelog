import React, { lazy, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Search } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import CommandSearch, { CommandSearchHost } from "@/components/CommandSearch";
import HeaderAccountSync from "@/components/HeaderAccountSync";
import SessionClocks from "@/components/SessionClocks";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";
import PnlViewToggle from "@/components/PnlViewToggle";
import AppDock from "@/components/AppDock";
import { applyTheme } from "@/lib/userSettings";
import { useSubscription } from "@/hooks/use-subscription";
import { useSpotlight } from "@/hooks/use-spotlight";

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
  const { subscription } = useSubscription(user?.id);

  const tradePage = isTradeDetailsPath(location.pathname);
  const isPro = subscription?.status && subscription.status !== "free";
  useSpotlight();

  React.useEffect(() => {
    const warm = () => {
      import("@/pages/Journal");
      import("@/pages/Dashboard");
      import("@/pages/Calendar");
      import("@/pages/Analytics");
    };
    const idleId = window.requestIdleCallback?.(warm);
    const timer = idleId == null ? window.setTimeout(warm, 600) : null;
    return () => {
      if (idleId != null) window.cancelIdleCallback?.(idleId);
      if (timer != null) window.clearTimeout(timer);
    };
  }, []);

  React.useEffect(() => {
    if (!user) return;
    const savedTheme = localStorage.getItem("appTheme");
    const effectiveTheme =
      savedTheme === "dark" || savedTheme === "light" ? savedTheme : user.theme || "auto";
    applyTheme(effectiveTheme);
  }, [user]);

  return (
    <>
      <CommandSearchHost />
      <div className="app-atmosphere flex h-full min-h-0 w-full overflow-hidden bg-background text-foreground">
        <div className="app-window flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[24px] border border-ds-frame bg-ds-s1">
        <AppDock user={user} onLogout={logout} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="app-topbar sticky top-0 z-20 flex h-12 items-center justify-between gap-3 border-b border-ds-line bg-transparent px-3">
          <div className="flex shrink-0 items-center gap-2 xl:min-w-0 xl:shrink">
          <Link to={createPageUrl("Dashboard")} className="flex shrink-0 items-center gap-1.5">
            <img
              src="/aikeeptrade-icon-192.png"
              alt="AiKeepTrade"
              width="24"
              height="24"
              className="h-6 w-6 shrink-0 rounded-md object-contain"
            />
            <span className="hidden truncate text-[13px] font-semibold tracking-tight text-ds-text xl:inline">
              AiKeepTrade
            </span>
            <span className="hidden rounded-full border border-ds-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ds-text2 xl:inline">
              {isPro ? "PRO" : "FREE"}
            </span>
          </Link>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ds-text3 transition-colors hover:bg-ds-s3 hover:text-ds-text xl:hidden"
            aria-label={t("search")}
            onClick={() => window.dispatchEvent(new Event("open-command-search"))}
          >
            <Search className="h-4 w-4" />
          </button>
          <div className="hidden min-w-0 overflow-hidden xl:block">
            <CommandSearch variant="header" />
          </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="hidden items-center gap-1.5 md:flex">
              <LanguageToggle className="ds-pill-group" />
              <ThemeToggle className="ds-pill-group" />
              <PnlViewToggle className="ds-pill-group" />
            </div>
            <div className="topbar-account min-w-0">
              <HeaderAccountSync />
            </div>
            <SessionClocks />
          </div>
        </header>

          <main
            className={`min-h-0 min-w-0 flex-1 cyber-dashboard dash-scr dashboard-surface bg-transparent ${
              tradePage ? "flex flex-col overflow-hidden" : "overflow-x-hidden overflow-y-auto"
            }`}
          >
            <div
              className={
                tradePage
                  ? "app-content-pad w-full min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-3"
                  : "app-content-pad mx-auto w-full max-w-[1920px] py-2 sm:py-2.5"
              }
            >
              {children}
            </div>
          </main>
        </div>
        </div>
      </div>
      {!isMobile && (
        <Suspense fallback={null}>
          <FloatingCalculator />
        </Suspense>
      )}
    </>
  );
}
