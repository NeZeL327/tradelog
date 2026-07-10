import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, preventDialogDismissProps } from "@/components/ui/dialog";
import TradeFormNew from "@/components/TradeFormNew";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

export default function QuickAddTradeSidebar() {
  const { user } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("quickAddTradeSidebarCollapsed") === "1";
    } catch {
      return false;
    }
  });

  const handleCollapse = () => {
    setCollapsed((prev) => {
      const newValue = !prev;
      try {
        localStorage.setItem("quickAddTradeSidebarCollapsed", newValue ? "1" : "0");
      } catch {
        // Ignore localStorage errors
      }
      return newValue;
    });
  };

  if (!user?.id) return null;

  return (
    <>
      <div className="fixed right-3 top-20 z-40 pointer-events-none">
        <div
          className={cn(
            "pointer-events-auto rounded-xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur-sm dark:border-slate-700 dark:bg-card/95 transition-all",
            collapsed ? "w-12" : "w-12"
          )}
        >
          <div className="flex flex-col items-center gap-0 p-2">
            <Button
              onClick={() => setShowAddForm(true)}
              className="h-10 w-10 rounded-xl border border-emerald-200/50 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl dark:border-slate-500/60"
              title="Szybko dodaj trade"
            >
              <span className="text-sm font-black tracking-wide">T</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 mt-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              onClick={handleCollapse}
              aria-label="Toggle quick add trade"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", collapsed && "-rotate-90")} />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent
          className="max-w-6xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto gap-0 p-0 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          {...preventDialogDismissProps}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <div className="sticky top-0 z-10 bg-white dark:bg-card px-4 py-3 pr-12 border-b border-border">
            <DialogTitle>Dodaj nowy trade</DialogTitle>
          </div>
          <div className="p-4">
          <TradeFormNew 
            embedded
            onClose={() => setShowAddForm(false)}
            onSuccess={() => setShowAddForm(false)}
          />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
