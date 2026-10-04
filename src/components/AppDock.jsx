import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlarmClockOff,
  BarChart3,
  BookOpen,
  Brain,
  Calculator,
  Calendar,
  CalendarCheck2,
  CandlestickChart,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  LogOut,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Settings,
  Target,
  Wallet,
} from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import ThoughtOfDay from "@/components/ThoughtOfDay";
import {
  ALL_NAV_ITEMS,
  DOCK_MAX,
  loadDockShortcuts,
  resolveDockItems,
  saveDockShortcuts,
} from "@/lib/navDock";
import { cn } from "@/lib/utils";

const ICONS = {
  LayoutDashboard,
  BookOpen,
  CalendarCheck2,
  Calendar,
  ListTodo,
  AlarmClockOff,
  CandlestickChart,
  BarChart3,
  FlaskConical,
  Brain,
  Target,
  Calculator,
  NotebookPen,
  FileBarChart,
  ClipboardList,
  ListChecks,
  Wallet,
  CreditCard,
  Settings,
};

const GROUP_LABELS = {
  trading: { pl: "Trading", en: "Trading" },
  analysis: { pl: "Analiza", en: "Analysis" },
  tools: { pl: "Narzędzia", en: "Tools" },
  workspace: { pl: "Materiały", en: "Workspace" },
  account: { pl: "Konto", en: "Account" },
};

function normalizePath(p) {
  if (!p) return "";
  return (p.split("?")[0].replace(/\/+$/, "") || "/").toLowerCase();
}

function isActivePath(current, url) {
  const c = normalizePath(current);
  const u = normalizePath(url);
  if (u === "/trade") return c === "/trade" || c.startsWith("/trade/");
  return c === u;
}

export default function AppDock({ user, onLogout }) {
  const { t, language } = useLanguage();
  const location = useLocation();
  const [keys, setKeys] = useState(() => loadDockShortcuts(user?.id));
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setKeys(loadDockShortcuts(user?.id));
  }, [user?.id]);

  const { primary, more } = useMemo(() => resolveDockItems(t, keys), [t, keys]);
  const lang = language === "en" ? "en" : "pl";

  const persist = (next) => {
    const saved = saveDockShortcuts(user?.id, next);
    setKeys(saved);
  };

  const addShortcut = (key) => {
    if (keys.includes(key) || keys.length >= DOCK_MAX) return;
    persist([...keys, key]);
  };

  const removeShortcut = (key) => {
    if (keys.length <= 3) return;
    persist(keys.filter((k) => k !== key));
  };

  const moveShortcut = (key, direction) => {
    const idx = keys.indexOf(key);
    if (idx < 0) return;
    const next = [...keys];
    const swap = idx + direction;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    persist(next);
  };

  const groupedAll = useMemo(() => {
    const groups = {};
    for (const item of ALL_NAV_ITEMS) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push({
        ...item,
        title: t(item.titleKey) || item.fallbackTitle,
      });
    }
    return groups;
  }, [t]);

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-[var(--app-edge,0.5rem)] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      aria-label={t("mainNav") || "Nawigacja główna"}
    >
      <div className="app-dock-bar pointer-events-auto relative flex items-center border border-[hsl(var(--window-border)/0.85)] bg-[hsl(var(--app-shell)/0.96)] shadow-xl backdrop-blur-md">
        <ThoughtOfDay />
        <span className="app-dock-sep mx-0.5 w-px bg-border/80" aria-hidden />

        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto scrollbar-none">
          {primary.map((item) => {
            const Icon = ICONS[item.iconName] || LayoutDashboard;
            const active = isActivePath(location.pathname, item.url);
            return (
              <Link
                key={item.key}
                to={item.url}
                title={item.title}
                className={cn(
                  "app-dock-link relative flex shrink-0 flex-col items-center justify-center font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.35 : 1.85} />
                <span className="hidden max-w-[5rem] truncate sm:inline">{item.title}</span>
                {active && (
                  <span className="absolute inset-x-3 bottom-0.5 h-0.5 rounded-full bg-primary" aria-hidden />
                )}
              </Link>
            );
          })}
        </div>

        <span className="app-dock-sep mx-0.5 w-px bg-border/80" aria-hidden />

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShortcutOpen((v) => !v);
              setMoreOpen(false);
            }}
            className="app-dock-link flex flex-row items-center gap-1 font-semibold text-primary hover:bg-primary/10"
            aria-expanded={shortcutOpen}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t("addShortcut") || "Skrót"}</span>
          </button>
          {shortcutOpen && (
            <div className="absolute bottom-[calc(100%+10px)] right-0 z-[80] max-h-[60vh] w-[min(300px,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-border bg-[hsl(var(--window-bg))] p-3 shadow-xl">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold text-foreground">
                  {t("addShortcutTitle") || "Dodaj skrót do paska"}
                </p>
                <span className="text-[10px] text-muted-foreground">{keys.length}/{DOCK_MAX}</span>
              </div>
              {keys.length > 0 && (
                <div className="mb-3 rounded-lg border border-border/70 p-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("dockOrder") || "Kolejność na pasku"}
                  </p>
                  <ul className="space-y-0.5">
                    {keys.map((key, index) => {
                      const item = ALL_NAV_ITEMS.find((row) => row.key === key);
                      if (!item) return null;
                      const title = t(item.titleKey) || item.fallbackTitle;
                      return (
                        <li key={key} className="flex items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-white/5">
                          <span className="truncate text-[12px]">{title}</span>
                          <span className="flex items-center gap-0.5">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveShortcut(key, -1)}
                              className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                              aria-label={`${t("moveUp") || "W górę"} ${title}`}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === keys.length - 1}
                              onClick={() => moveShortcut(key, 1)}
                              className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                              aria-label={`${t("moveDown") || "W dół"} ${title}`}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeShortcut(key)}
                              className="ml-1 text-[10px] text-muted-foreground hover:text-loss"
                              aria-label={`${t("remove") || "Usuń"} ${title}`}
                            >
                              −
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {Object.entries(groupedAll).map(([group, items]) => (
                <div key={group} className="mb-3 last:mb-0">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {GROUP_LABELS[group]?.[lang] || group}
                  </p>
                  <ul className="space-y-0.5">
                    {items.map((item) => {
                      const onDock = keys.includes(item.key);
                      const Icon = ICONS[item.iconName] || LayoutDashboard;
                      return (
                        <li key={item.key} className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-white/5">
                          <span className="flex min-w-0 items-center gap-2 text-[12px] text-foreground/90">
                            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{item.title}</span>
                          </span>
                          {onDock ? (
                            <button
                              type="button"
                              onClick={() => removeShortcut(item.key)}
                              className="text-[10px] text-muted-foreground hover:text-loss"
                              aria-label={`${t("remove") || "Usuń"} ${item.title}`}
                            >
                              −
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={keys.length >= DOCK_MAX}
                              onClick={() => addShortcut(item.key)}
                              className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 text-primary disabled:opacity-40"
                              aria-label={`${t("add") || "Dodaj"} ${item.title}`}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setMoreOpen((v) => !v);
              setShortcutOpen(false);
            }}
            className="app-dock-link flex flex-row items-center gap-1 font-semibold text-muted-foreground hover:bg-primary/10 hover:text-foreground"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="hidden sm:inline">{t("navMore") || "Więcej"}</span>
          </button>
          {moreOpen && (
            <div className="absolute bottom-[calc(100%+10px)] right-0 z-[80] max-h-[60vh] w-[min(260px,calc(100vw-1.5rem))] overflow-y-auto rounded-xl border border-border bg-[hsl(var(--window-bg))] p-2 shadow-xl">
              {more.map((item) => {
                const Icon = ICONS[item.iconName] || LayoutDashboard;
                const active = isActivePath(location.pathname, item.url);
                return (
                  <Link
                    key={item.key}
                    to={item.url}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px]",
                      active ? "bg-primary/10 text-primary" : "text-foreground/90 hover:bg-primary/5"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.title}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onLogout?.();
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-loss hover:bg-white/5"
              >
                <LogOut className="h-3.5 w-3.5" />
                {t("logout") || "Wyloguj"}
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
