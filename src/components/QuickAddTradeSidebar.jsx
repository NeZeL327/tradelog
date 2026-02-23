import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
            "pointer-events-auto rounded-xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur-sm dark:border-slate-700 dark:bg-[#111827]/95 transition-all",
            collapsed ? "w-12" : "w-12"
          )}
        >
          <div className="flex flex-col items-center gap-0 p-2">
            <Button
              onClick={() => setShowAddForm(true)}
              className="h-10 w-10 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
              title="Szybko dodaj trade"
            >
              <Plus className="h-5 w-5" />
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dodaj nowy trade</DialogTitle>
          </DialogHeader>
          <TradeFormNew 
            onClose={() => setShowAddForm(false)}
            onSuccess={() => setShowAddForm(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
