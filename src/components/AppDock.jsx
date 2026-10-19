import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Brain,
  Calculator,
  Calendar,
  CandlestickChart,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  Bell,
  LogOut,
  Plus,
  Settings,
  Wallet,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import ThoughtOfDay from "@/components/ThoughtOfDay";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ALL_NAV_ITEMS } from "@/lib/navDock";
import { cn } from "@/lib/utils";
import { createPageUrl } from "@/utils";

const ICONS = {
  LayoutDashboard,
  BookOpen,
  Calendar,
  CandlestickChart,
  BarChart3,
  FlaskConical,
  Brain,
  Calculator,
  Wallet,
  CreditCard,
  Settings,
};

function normalizePath(p) {
  if (!p) return "";
  return (p.split("?")[0].replace(/\/+$/, "") || "/").toLowerCase();
}

function isActivePath(current, url) {
  const c = normalizePath(current);
  const u = normalizePath(url);
  if (u === "/trade") return c === "/trade" || c.startsWith("/trade/");
  if (u === "/dashboard" && (c === "/" || c === "/dashboard")) return true;
  return c === u;
}

function DockTip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="ds-glass-tip">{label}</TooltipContent>
    </Tooltip>
  );
}

export default function AppDock({ user, onLogout }) {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

  const settingsItem = ALL_NAV_ITEMS.find((item) => item.key === "settings");
  const settingsUrl = settingsItem?.url || "/Settings";
  const profileUrl = `${settingsUrl}?section=profile`;

  const navItems = useMemo(
    () =>
      ALL_NAV_ITEMS.filter((item) => item.key !== "settings").map((item) => ({
        ...item,
        title: t(item.titleKey) || item.fallbackTitle,
      })),
    [t]
  );

  const onSettingsPage = isActivePath(location.pathname, settingsUrl);
  const section = new URLSearchParams(location.search).get("section");
  const profileActive = onSettingsPage && (!section || section === "profile");
  const settingsActive = onSettingsPage && !profileActive;

  useEffect(() => {
    setSettingsOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onPointer = (event) => {
      if (!settingsRef.current?.contains(event.target)) setSettingsOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [settingsOpen]);

  const addLabel = t("addTrade") || "Dodaj transakcję";
  const notificationsLabel = t("notifications") || "Powiadomienia";
  const settingsLabel = t("settings") || "Ustawienia";
  const profileLabel = t("profile") || "Profil";

  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={100}>
    <nav
      className="app-side-nav relative z-40 flex h-full w-[60px] shrink-0 flex-col items-center border-r border-ds-line bg-transparent py-3"
      aria-label={t("mainNav") || "Nawigacja główna"}
    >
      <Link
        to={createPageUrl("Dashboard")}
        title="AiKeepTrade"
        aria-label="AiKeepTrade"
        className="dock-logo mb-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-ds-accent transition-[filter] duration-200 hover:brightness-125"
      >
        <img
          src="/aikeeptrade-icon-192.png"
          alt="AiKeepTrade"
          width="32"
          height="32"
          className="h-8 w-8 rounded-md object-contain"
        />
      </Link>

      <div className="dock-scroll flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto py-1">
        {navItems.map((item) => {
          const Icon = ICONS[item.iconName] || LayoutDashboard;
          const active = isActivePath(location.pathname, item.url);
          return (
            // Full-width row so the active bar can sit flush on the rail's right edge.
            <div key={item.key} className="dock-item relative flex w-full shrink-0 justify-center" data-active={active ? "true" : "false"}>
              <DockTip label={item.title}>
                <Link
                  to={item.url}
                  aria-current={active ? "page" : undefined}
                  data-active={active ? "true" : "false"}
                  className={cn(
                    "app-dock-link relative flex shrink-0 items-center justify-center transition-colors duration-200",
                    active
                      ? "bg-ds-s3 text-ds-text"
                      : "text-ds-text3 hover:bg-ds-s2 hover:text-ds-text"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span className="sr-only">{item.title}</span>
                </Link>
              </DockTip>
            </div>
          );
        })}
        <span className="my-2 h-px w-6 shrink-0 bg-ds-line" aria-hidden="true" />
        <DockTip label={addLabel}>
          <button
            type="button"
            onClick={() => navigate(`${createPageUrl("Journal")}?add=1`)}
            className="dock-plus ds-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ds-accent text-white transition-[filter] duration-200 hover:brightness-110"
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={2} />
            <span className="sr-only">{addLabel}</span>
          </button>
        </DockTip>
      </div>

      <div className="mt-auto flex w-full flex-col items-center gap-2 px-1.5 pt-3">
        <ThoughtOfDay drop="up" compact />
        <DockTip label={notificationsLabel}>
          <Link
            to={`${settingsUrl}?section=notifications`}
            className="app-dock-link flex shrink-0 items-center justify-center text-ds-text3 transition-colors duration-200 hover:bg-ds-s2 hover:text-ds-text"
          >
            <Bell className="h-4 w-4" strokeWidth={1.5} />
            <span className="sr-only">{notificationsLabel}</span>
          </Link>
        </DockTip>
        <div className="relative" ref={settingsRef}>
          <DockTip label={settingsLabel}>
            <button
              type="button"
              aria-expanded={settingsOpen}
              data-active={settingsActive ? "true" : "false"}
              onClick={() => setSettingsOpen((open) => !open)}
              className={cn(
                "app-dock-link flex items-center justify-center text-ds-text3 transition-colors duration-200 hover:bg-ds-s2 hover:text-ds-text",
                settingsActive && "bg-ds-s3 text-ds-text"
              )}
            >
              <Settings className="h-4 w-4" strokeWidth={1.5} />
              <span className="sr-only">{settingsLabel}</span>
            </button>
          </DockTip>
          {settingsOpen ? (
            <div className="absolute bottom-0 left-[calc(100%+8px)] z-[80] w-44 rounded-xl border border-ds-frame bg-ds-s1 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
              <Link
                to={settingsUrl}
                onClick={() => setSettingsOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ds-text hover:bg-ds-s3"
              >
                <Settings className="h-3.5 w-3.5 text-ds-text2" />
                {t("settings") || "Ustawienia"}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  onLogout?.();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ds-neg hover:bg-ds-s3"
              >
                <LogOut className="h-3.5 w-3.5" />
                {t("logout") || "Wyloguj się"}
              </button>
            </div>
          ) : null}
        </div>
        <DockTip label={profileLabel}>
          <Link
            to={profileUrl}
            data-active={profileActive ? "true" : "false"}
            className="dock-avatar mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ds-frame bg-ds-s3 text-[12px] font-semibold text-ds-text transition-[border-color,box-shadow] duration-200"
          >
            <span className="sr-only">{profileLabel}</span>
            {(user?.email || "A").slice(0, 1).toUpperCase()}
          </Link>
        </DockTip>
      </div>
    </nav>
    </TooltipProvider>
  );
}
