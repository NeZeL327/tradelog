import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, BookOpen, Calendar, Menu, Plus } from "lucide-react";
import { createPageUrl } from "@/utils";
import { useLanguage } from "@/components/LanguageProvider";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function normalizePath(p) {
  if (!p) return "";
  return (p.split("?")[0].replace(/\/+$/, "") || "/").toLowerCase();
}

export default function MobileTabBar() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();
  const path = normalizePath(location.pathname);

  const items = [
    { id: "dash", to: createPageUrl("Dashboard"), icon: LayoutDashboard, label: t("dashboard") },
    { id: "journal", to: createPageUrl("Journal"), icon: BookOpen, label: t("journal") },
    { id: "add", to: null, icon: Plus, label: t("addTrade") },
    { id: "cal", to: createPageUrl("Calendar"), icon: Calendar, label: t("calendar") },
    { id: "more", to: null, icon: Menu, label: t("navMore") || "Więcej" },
  ];

  const onAdd = () => {
    navigate(`${createPageUrl("Journal")}?add=1`);
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/80 bg-[hsl(var(--app-shell))]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Nawigacja dziennika"
    >
      <div className="grid grid-cols-5 h-14">
        {items.map((item) => {
          const active = item.to && path === normalizePath(item.to);
          const isAdd = item.id === "add";
          const className = cn(
            "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
            active ? "text-primary" : "text-muted-foreground"
          );

          if (isAdd) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={onAdd}
                className="flex flex-col items-center justify-center -mt-3"
                aria-label={item.label}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Plus className="w-6 h-6" strokeWidth={2.5} />
                </span>
              </button>
            );
          }

          if (item.id === "more") {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setOpenMobile(true)}
                className={className}
              >
                <item.icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <Link key={item.id} to={item.to} className={className}>
              <item.icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
