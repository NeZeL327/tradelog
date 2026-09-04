import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import {
  LayoutDashboard, BookOpen, Calendar, ListTodo, AlarmClockOff,
  BarChart3, FlaskConical, Brain, Calculator, NotebookPen,
  FileBarChart, ClipboardList, Wallet, Settings as SettingsIcon,
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/LanguageProvider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

function navItems(t) {
  return [
    { title: t("dashboard"), url: createPageUrl("Dashboard"), icon: LayoutDashboard },
    { title: t("journal"), url: createPageUrl("Journal"), icon: BookOpen },
    { title: t("calendar"), url: createPageUrl("Calendar"), icon: Calendar },
    { title: t("plannedTrades") || "Planned", url: createPageUrl("Planned"), icon: ListTodo },
    { title: t("missedTrades") || "Missed", url: createPageUrl("Missed"), icon: AlarmClockOff },
    { title: t("analytics"), url: createPageUrl("Analytics"), icon: BarChart3 },
    { title: t("backtesting"), url: createPageUrl("Backtesting"), icon: FlaskConical },
    { title: t("strategies"), url: createPageUrl("Strategies"), icon: Brain },
    { title: t("calculators"), url: createPageUrl("Calculators"), icon: Calculator },
    { title: t("notes"), url: createPageUrl("Notes"), icon: NotebookPen },
    { title: t("reports") || "Raporty", url: createPageUrl("Raporty"), icon: FileBarChart },
    { title: t("processReview") || "Przegląd procesu", url: createPageUrl("ProcessReview"), icon: ClipboardList },
    { title: t("accounts"), url: createPageUrl("Accounts"), icon: Wallet },
    { title: t("settings"), url: createPageUrl("Settings"), icon: SettingsIcon },
  ];
}

export function openCommandSearch() {
  window.dispatchEvent(new Event("open-command-search"));
}

/** Always mounted outside the mobile Sheet so Ctrl+K works with a closed sidebar. */
export function CommandSearchHost() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = navItems(t);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-search", onOpen);
    };
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={`${t("search")}...`} />
      <CommandList>
        <CommandEmpty>{t("noData")}</CommandEmpty>
        <CommandGroup heading={t("navGroupMain")}>
          {items.map((item) => (
            <CommandItem
              key={item.url}
              value={item.title}
              onSelect={() => {
                setOpen(false);
                navigate(item.url);
              }}
            >
              <item.icon className="w-4 h-4" />
              {item.title}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export default function CommandSearch({ variant = "sidebar" }) {
  const { t } = useLanguage();
  const isSidebar = variant === "sidebar";

  return (
    <button
      type="button"
      onClick={openCommandSearch}
      className={
        isSidebar
          ? "flex w-full h-9 items-center gap-2 rounded-full border border-border bg-muted/50 px-3 text-[12px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors dark:border-white/15 dark:bg-black/40 group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:px-0"
          : "hidden md:flex h-8 items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-3 text-[12px] text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors min-w-[11.5rem] max-w-[16rem]"
      }
      aria-label={t("search")}
    >
      <Search className="w-3.5 h-3.5 shrink-0 opacity-70" />
      <span className={isSidebar ? "truncate group-data-[collapsible=icon]:hidden" : "truncate"}>
        {t("search")}...
      </span>
      <kbd
        className={
          isSidebar
            ? "ml-auto text-[10px] font-medium tracking-wide text-muted-foreground/80 border border-white/15 rounded px-1.5 py-0.5 group-data-[collapsible=icon]:hidden"
            : "ml-auto text-[10px] font-medium tracking-wide text-muted-foreground/80 border border-border/80 rounded px-1 py-0.5"
        }
      >
        Ctrl K
      </kbd>
    </button>
  );
}
