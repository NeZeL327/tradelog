import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { pagesConfig } from "@/pages.config";
import { ChevronDown, ChevronLeft, ChevronRight, CheckSquare, FolderTree, Plus } from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
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

const createChecklistItem = (text) => ({
  id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
  text: String(text || "").trim(),
  done: false,
  dueDate: "",
  priority: "medium",
  note: ""
});

const stripHtml = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export default function PinnedNotesSidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("pinnedNotesSidebarCollapsed") === "1";
    } catch {
      return false;
    }
  });
  const [notes, setNotes] = useState([]);
  const [sections, setSections] = useState([]);
  const [newItemText, setNewItemText] = useState("");
  const [createForAllPages, setCreateForAllPages] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState({});
  const [expandedSections, setExpandedSections] = useState({});

  const currentPageKey = useMemo(() => getCurrentPageKey(location.pathname), [location.pathname]);

  useEffect(() => {
    if (!user?.id) {
      setNotes([]);
      setSections([]);
      return undefined;
    }

    const notesRef = collection(db, "users", String(user.id), "notes");
    const sectionsRef = collection(db, "users", String(user.id), "sections");
    const notesQuery = query(notesRef, orderBy("order", "asc"));
    const sectionsQuery = query(sectionsRef, orderBy("createdAt", "asc"));

    const unsubscribeNotes = onSnapshot(notesQuery, (snapshot) => {
      const items = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));
      setNotes(items);
    });

    const unsubscribeSections = onSnapshot(sectionsQuery, (snapshot) => {
      const items = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
        pinnedToSidebar: Boolean(item.data().pinnedToSidebar)
      }));
      setSections(items);
    });

    return () => {
      unsubscribeNotes();
      unsubscribeSections();
    };
  }, [user?.id]);

  useEffect(() => {
    try {
      localStorage.setItem("pinnedNotesSidebarCollapsed", collapsed ? "1" : "0");
    } catch {
      return;
    }
  }, [collapsed]);

  const visibleNotes = useMemo(() => {
    return notes
      .filter((note) => note.pinnedToSidebar === true)
      .filter((note) => {
        const scope = note.visibilityScope || "all";
        if (scope === "all") return true;
        const pages = Array.isArray(note.visibleOnPages) ? note.visibleOnPages : [];
        return pages.includes(currentPageKey);
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (a.order || 0) - (b.order || 0);
      });
  }, [notes, currentPageKey]);

  const pinnedSections = useMemo(
    () => sections.filter((section) => section.pinnedToSidebar === true),
    [sections]
  );

  useEffect(() => {
    setExpandedNotes((prev) => {
      const sectionNoteIds = new Set(
        notes
          .filter((note) => pinnedSections.some((section) => section.id === note.sectionId))
          .map((note) => note.id)
      );
      const allowedIds = new Set([...visibleNotes.map((note) => note.id), ...sectionNoteIds]);
      const next = {};
      Object.entries(prev).forEach(([id, value]) => {
        if (allowedIds.has(id) && value) {
          next[id] = true;
        }
      });
      return next;
    });
  }, [visibleNotes, notes, pinnedSections]);

  useEffect(() => {
    setExpandedSections((prev) => {
      const allowed = new Set(pinnedSections.map((section) => section.id));
      const next = {};
      Object.entries(prev).forEach(([id, value]) => {
        if (allowed.has(id) && value) next[id] = true;
      });
      return next;
    });
  }, [pinnedSections]);

  const toggleChecklistItem = async (noteId, itemId, nextDone) => {
    if (!user?.id) return;
    const note = visibleNotes.find((entry) => entry.id === noteId);
    if (!note) return;

    const nextChecklist = (note.checklist || []).map((item) =>
      item.id === itemId ? { ...item, done: nextDone } : item
    );

    setNotes((prev) =>
      prev.map((entry) =>
        entry.id === noteId ? { ...entry, checklist: nextChecklist } : entry
      )
    );

    try {
      const refDoc = doc(db, "users", String(user.id), "notes", String(noteId));
      await updateDoc(refDoc, {
        checklist: nextChecklist,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Pinned sidebar checklist update error:", error);
    }
  };

  const handleQuickCreateChecklist = async () => {
    if (!user?.id || !newItemText.trim()) return;

    const now = new Date().toISOString();
    const item = createChecklistItem(newItemText);
    const payload = {
      title: "Checklist",
      body: "",
      checklist: [item],
      type: "checklist",
      notebookId: "default",
      sectionId: "general",
      parentId: null,
      order: Date.now(),
      pinned: true,
      pinnedToSidebar: true,
      visibilityScope: createForAllPages ? "all" : "selected",
      visibleOnPages: createForAllPages ? [] : [currentPageKey],
      tags: [],
      links: [],
      status: "active",
      priority: "medium",
      dueDate: "",
      reminderAt: "",
      reminderSentAt: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAtClient: now,
      updatedAtClient: now
    };

    try {
      await addDoc(collection(db, "users", String(user.id), "notes"), payload);
      setNewItemText("");
    } catch (error) {
      console.error("Pinned sidebar create checklist error:", error);
    }
  };

  const toggleExpanded = (noteId) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [noteId]: !prev[noteId]
    }));
  };

  const toggleSectionExpanded = (sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const openNoteInEditor = (noteId) => {
    if (!noteId) return;
    navigate(`/Notes?noteId=${encodeURIComponent(String(noteId))}`);
  };

  const getSectionNotes = (sectionId) => {
    const sectionNotes = notes
      .filter((note) => note.sectionId === sectionId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const byParent = new Map();
    sectionNotes.forEach((note) => {
      const parentKey = note.parentId || "__root__";
      if (!byParent.has(parentKey)) byParent.set(parentKey, []);
      byParent.get(parentKey).push(note);
    });

    return {
      topLevel: byParent.get("__root__") || [],
      byParent
    };
  };

  const renderNoteItem = (note, byParent, depth = 0) => {
    const children = byParent.get(note.id) || [];
    const isExpanded = Boolean(expandedNotes[note.id]);

    return (
      <div key={note.id} className="space-y-1">
        <div className={cn("rounded-md border border-slate-200 bg-slate-50/70 p-2 dark:border-slate-700 dark:bg-slate-900/50", depth > 0 && "ml-3")}> 
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => toggleExpanded(note.id)}
            >
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{note.title || "Notatka"}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{stripHtml(note.body) || "Kliknij, aby rozwinąć"}</div>
            </button>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => openNoteInEditor(note.id)}>
              Otwórz
            </Button>
            <button
              type="button"
              className="inline-flex items-center justify-center"
              onClick={() => toggleExpanded(note.id)}
              aria-label={isExpanded ? "Zwiń notatkę" : "Rozwiń notatkę"}
            >
              <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", isExpanded && "rotate-180")} />
            </button>
          </div>
          {isExpanded && (
            <div className="mt-2 rounded-md border border-slate-200 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-950/50">
              {(note.checklist || []).length > 0 ? (
                <div className="space-y-1">
                  {(note.checklist || []).map((item) => (
                    <label key={item.id} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={Boolean(item.done)}
                        onChange={(event) => toggleChecklistItem(note.id, item.id, event.target.checked)}
                      />
                      <span className={cn("break-words", item.done && "line-through opacity-60")}>{item.text || "(bez nazwy)"}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 break-words whitespace-pre-wrap">{stripHtml(note.body) || "Pusta notatka"}</p>
              )}
            </div>
          )}
        </div>

        {children.length > 0 && (
          <div className="space-y-1">
            {children.map((child) => renderNoteItem(child, byParent, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!user?.id) return null;

  return (
    <div className="fixed right-3 top-24 z-40 pointer-events-none">
      <div
        className={cn(
          "pointer-events-auto rounded-xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur-sm dark:border-slate-700 dark:bg-[#111827]/95 transition-all",
          collapsed ? "w-12" : "w-[320px]"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-2 py-2 dark:border-slate-700">
          {!collapsed && (
            <div className="flex items-center gap-2 px-1">
              <CheckSquare className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Szybkie notatki</span>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? "Rozwiń panel notatek" : "Zwiń panel notatek"}
          >
            {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {!collapsed && (
          <div className="p-3 space-y-3">
            <div className="space-y-2">
              <Input
                value={newItemText}
                onChange={(event) => setNewItemText(event.target.value)}
                placeholder="Dodaj checklistę..."
                className="h-9"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleQuickCreateChecklist();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={createForAllPages}
                    onChange={(event) => setCreateForAllPages(event.target.checked)}
                  />
                  Wszystkie strony
                </label>
                <Button type="button" size="sm" className="h-8 gap-1" onClick={handleQuickCreateChecklist}>
                  <Plus className="h-4 w-4" />
                  Dodaj
                </Button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-auto space-y-2 pr-1">
              {visibleNotes.length === 0 && pinnedSections.length === 0 && (
                <div className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Brak przypiętych notatek ani sekcji
                </div>
              )}

              {visibleNotes.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Przypięte notatki strony</div>
                  {visibleNotes.map((note) => (
                    <div key={note.id}>{renderNoteItem(note, new Map(), 0)}</div>
                  ))}
                </div>
              )}

              {pinnedSections.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Przypięte sekcje</div>
                  {pinnedSections.map((section) => {
                    const { topLevel, byParent } = getSectionNotes(section.id);
                    const sectionExpanded = Boolean(expandedSections[section.id]);
                    return (
                      <div key={section.id} className="rounded-md border border-slate-200 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-900/50">
                        <button
                          type="button"
                          className="w-full flex items-center justify-between gap-2 text-left"
                          onClick={() => toggleSectionExpanded(section.id)}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <FolderTree className="h-4 w-4 text-slate-500" />
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{section.name || "Sekcja"}</span>
                          </div>
                          <ChevronDown className={cn("h-4 w-4 text-slate-500 transition-transform", sectionExpanded && "rotate-180")} />
                        </button>

                        {sectionExpanded && (
                          <div className="mt-2 space-y-1">
                            {topLevel.length === 0 ? (
                              <div className="text-xs text-slate-500 dark:text-slate-400 px-1 py-1">Brak notatek w tej sekcji</div>
                            ) : (
                              topLevel.map((note) => renderNoteItem(note, byParent, 0))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
