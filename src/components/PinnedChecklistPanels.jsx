import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { pagesConfig } from "@/pages.config";
import { CheckSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const getCurrentPageKey = (pathname) => {
  const { Pages, mainPage } = pagesConfig;
  const mainPageKey = mainPage ?? Object.keys(Pages)[0] ?? "Dashboard";

  if (!pathname || pathname === "/") {
    return mainPageKey;
  }

  const segment = pathname.replace(/^\//, "").split("/")[0];
  const matched = Object.keys(Pages).find((key) => key.toLowerCase() === segment.toLowerCase());
  return matched || segment || mainPageKey;
};

const withAlpha = (hex, alphaHex) => {
  if (typeof hex !== "string") return null;
  const value = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return null;
  return `${value}${alphaHex}`;
};

export default function PinnedChecklistPanels() {
  const { user } = useAuth();
  const location = useLocation();
  const [notes, setNotes] = useState([]);
  const [collapsedPanels, setCollapsedPanels] = useState({});

  const currentPageKey = useMemo(() => getCurrentPageKey(location.pathname), [location.pathname]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pinnedChecklistPanelsCollapsed");
      if (raw) {
        setCollapsedPanels(JSON.parse(raw));
      }
    } catch {
      setCollapsedPanels({});
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("pinnedChecklistPanelsCollapsed", JSON.stringify(collapsedPanels));
    } catch {
      return;
    }
  }, [collapsedPanels]);

  useEffect(() => {
    if (!user?.id) {
      setNotes([]);
      return undefined;
    }

    const notesRef = collection(db, "users", String(user.id), "notes");
    const unsubscribe = onSnapshot(query(notesRef, orderBy("order", "asc")), (snapshot) => {
      setNotes(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    return () => unsubscribe();
  }, [user?.id]);

  useEffect(() => {
    const handleOpenChecklistPanel = (event) => {
      const noteId = event?.detail?.noteId;
      if (!noteId) return;
      setCollapsedPanels((prev) => ({
        ...prev,
        [noteId]: false
      }));
    };

    if (typeof window !== "undefined") {
      window.addEventListener("pinned-checklist-panels:open", handleOpenChecklistPanel);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("pinned-checklist-panels:open", handleOpenChecklistPanel);
      }
    };
  }, []);

  const checklistPanels = useMemo(() => {
    return notes
      .filter((note) => note.type === "checklist" && note.pinnedToSidebar === true)
      .filter((note) => {
        const scope = note.visibilityScope || "all";
        if (scope === "all") return true;
        const pages = Array.isArray(note.visibleOnPages) ? note.visibleOnPages : [];
        return pages.includes(currentPageKey);
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [notes, currentPageKey]);

  const toggleChecklistItem = async (noteId, itemId, nextDone) => {
    if (!user?.id) return;
    const note = notes.find((entry) => entry.id === noteId);
    if (!note) return;

    const nextChecklist = (note.checklist || []).map((item) =>
      item.id === itemId ? { ...item, done: nextDone } : item
    );

    setNotes((prev) =>
      prev.map((entry) => (entry.id === noteId ? { ...entry, checklist: nextChecklist } : entry))
    );

    try {
      await updateDoc(doc(db, "users", String(user.id), "notes", String(noteId)), {
        checklist: nextChecklist,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Pinned checklist panel update error:", error);
    }
  };

  const togglePanel = (noteId) => {
    setCollapsedPanels((prev) => ({
      ...prev,
      [noteId]: !prev[noteId]
    }));
  };

  if (!user?.id || checklistPanels.length === 0) return null;

  return (
    <div className="space-y-3">
      {checklistPanels.map((note) => {
        const collapsed = Boolean(collapsedPanels[note.id]);
        const tasks = Array.isArray(note.checklist) ? note.checklist : [];
        const doneCount = tasks.filter((task) => Boolean(task.done)).length;
        const containerBg = withAlpha(note.sidebarColor, "2b");
        const contentBg = withAlpha(note.sidebarColor, "1a");
        const buttonBg = withAlpha(note.sidebarColor, "d9");
        const borderColor = withAlpha(note.sidebarColor, "80") || undefined;

        return (
          <div
            key={note.id}
            className={cn("pointer-events-auto relative w-[320px]", collapsed && "h-16")}
          >
            {!collapsed && (
              <div
                className="mr-14 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl backdrop-blur-sm dark:border-slate-600 dark:bg-slate-700 transition-[transform,box-shadow,opacity] duration-300"
                style={{ borderColor }}
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700" style={{ backgroundColor: containerBg || undefined }}>
                  <div className="flex min-w-0 items-center gap-2 px-1">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/40 text-[13px] font-black text-white shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${buttonBg || note.sidebarColor || "#60a5fa"} 0%, ${note.sidebarColor || "#3b82f6"} 100%)`
                      }}
                    >
                      C
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{note.title || "Checklista"}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-300">{doneCount}/{tasks.length} zadań</div>
                    </div>
                  </div>
                </div>
                <div className="p-3" style={{ backgroundColor: contentBg || undefined }}>
                  {tasks.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Brak punktów w checkliście
                    </div>
                  ) : (
                    <div className="max-h-[28vh] overflow-auto space-y-2 pr-1">
                      {tasks.map((item) => (
                        <label
                          key={item.id}
                          className="flex min-h-[58px] items-center gap-3 rounded-md border border-slate-200 bg-white/85 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(item.done)}
                            onChange={(event) => toggleChecklistItem(note.id, item.id, event.target.checked)}
                          />
                          <span className={cn("flex-1 break-words leading-5", item.done && "line-through opacity-60")}>{item.text || "(bez nazwy)"}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-3 h-10 w-10 rounded-xl border border-white/30 text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              style={{
                background: `linear-gradient(135deg, ${buttonBg || note.sidebarColor || "#60a5fa"} 0%, ${note.sidebarColor || "#3b82f6"} 100%)`
              }}
              onClick={() => togglePanel(note.id)}
              aria-label={collapsed ? "Rozwiń checklistę" : "Zwiń checklistę"}
            >
              {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        );
      })}
    </div>
  );
}