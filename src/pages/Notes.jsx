import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/components/LanguageProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChevronDown, Download, FileText, Pencil, Pin, Plus, Search, Trash2, Upload } from "lucide-react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const userCollection = (userId, name) => collection(db, "users", String(userId), name);
const NAME_MAX_LENGTH = 20;

const clampName = (value) => String(value || "").slice(0, NAME_MAX_LENGTH);

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const toIsoString = (value) => {
  if (!value) return "";
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return String(value);
};

const stripHtml = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildEmptyNote = (sectionId, notebookId) => ({
  title: "",
  body: "",
  checklist: [],
  type: "note",
  notebookId,
  sectionId,
  parentId: null,
  order: Date.now(),
  pinned: false,
  tags: [],
  links: [],
  status: "active",
  priority: "medium",
  dueDate: "",
  reminderAt: "",
  reminderSentAt: "",
  pinnedToSidebar: false,
  visibilityScope: "all",
  visibleOnPages: [],
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
});

const normalizeNotesData = (raw, defaults) => {
  const base = Array.isArray(raw)
    ? { notes: raw, notebooks: defaults.notebooks, sections: defaults.sections }
    : {
        notes: Array.isArray(raw?.notes) ? raw.notes : [],
        notebooks: Array.isArray(raw?.notebooks) && raw.notebooks.length ? raw.notebooks : defaults.notebooks,
        sections: Array.isArray(raw?.sections) && raw.sections.length ? raw.sections : defaults.sections
      };

  const notebookId = base.notebooks[0]?.id || defaults.notebooks[0].id;
  const sectionId =
    base.sections.find((section) => section.notebookId === notebookId)?.id || defaults.sections[0].id;

  return {
    notes: base.notes.map((note) => ({
      ...note,
      id: note.id ?? createId(),
      title: clampName(note.title || ""),
      notebookId: note.notebookId || notebookId,
      sectionId: note.sectionId || sectionId,
      checklist: Array.isArray(note.checklist) ? note.checklist : [],
      tags: Array.isArray(note.tags) ? note.tags : [],
      links: Array.isArray(note.links) ? note.links : [],
      visibleOnPages: Array.isArray(note.visibleOnPages) ? note.visibleOnPages : [],
      pinnedToSidebar: Boolean(note.pinnedToSidebar),
      visibilityScope: note.visibilityScope === "selected" ? "selected" : "all"
    })),
    notebooks: base.notebooks,
    sections: base.sections.map((section) => ({
      ...section,
      name: clampName(section.name || "")
    }))
  };
};

export default function Notes() {
  const { user } = useAuth();
  const location = useLocation();
  const { t } = useLanguage();

  const editorRef = useRef(null);
  const titleInputRef = useRef(null);
  const lastHtmlRef = useRef("");
  const fileInputRef = useRef(null);
  const pendingNoteUpdates = useRef(new Map());

  const defaultNotebook = useMemo(() => ({ id: "default", name: t("notesDefaultNotebook") }), [t]);
  const defaultSection = useMemo(
    () => ({ id: "general", notebookId: "default", name: t("notesDefaultSection") }),
    [t]
  );

  const [notes, setNotes] = useState([]);
  const [notebooks, setNotebooks] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState("default");
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionInput, setSectionInput] = useState("");
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    if (!user?.id) {
      setNotes([]);
      setNotebooks([defaultNotebook]);
      setSections([defaultSection]);
      setSelectedNotebookId(defaultNotebook.id);
      setActiveSectionId(defaultSection.id);
      setSelectedNoteId(null);
      return undefined;
    }

    const notebooksRef = userCollection(user.id, "notebooks");
    const sectionsRef = userCollection(user.id, "sections");
    const notesRef = userCollection(user.id, "notes");

    const unsubscribeNotebooks = onSnapshot(query(notebooksRef, orderBy("createdAt", "asc")), (snapshot) => {
      const items = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
        createdAt: toIsoString(item.data().createdAt)
      }));

      if (items.length === 0) {
        void setDoc(
          doc(db, "users", String(user.id), "notebooks", "default"),
          { name: defaultNotebook.name, createdAt: serverTimestamp() },
          { merge: true }
        );
        return;
      }

      setNotebooks(items);
      if (!items.some((item) => item.id === selectedNotebookId)) {
        setSelectedNotebookId(items[0].id);
      }
    });

    const unsubscribeSections = onSnapshot(query(sectionsRef, orderBy("createdAt", "asc")), (snapshot) => {
      const items = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
        createdAt: toIsoString(item.data().createdAt)
      }));

      if (items.length === 0) {
        setSections([]);
        setActiveSectionId(null);
        return;
      }

      setSections(items);
      if (!items.some((item) => item.id === activeSectionId)) {
        const firstInNotebook = items.find((item) => item.notebookId === selectedNotebookId);
        setActiveSectionId(firstInNotebook?.id || items[0].id);
      }
    });

    const unsubscribeNotes = onSnapshot(query(notesRef, orderBy("order", "asc")), (snapshot) => {
      const items = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          ...data,
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt)
        };
      });
      setNotes(items);

      if (!selectedNoteId && items.length) {
        setSelectedNoteId(items[0].id);
      }
    });

    return () => {
      unsubscribeNotebooks();
      unsubscribeSections();
      unsubscribeNotes();
    };
  }, [
    user?.id,
    defaultNotebook.name,
    defaultSection.name,
    selectedNotebookId,
    activeSectionId,
    selectedNoteId
  ]);

  useEffect(() => {
    return () => {
      pendingNoteUpdates.current.forEach((timeoutId) => clearTimeout(timeoutId));
      pendingNoteUpdates.current.clear();
    };
  }, []);

  const notebookSections = useMemo(
    () => sections.filter((section) => section.notebookId === selectedNotebookId),
    [sections, selectedNotebookId]
  );

  useEffect(() => {
    if (!selectedNotebookId) return;
    if (notebookSections.length === 0) return;

    if (!notebookSections.some((section) => section.id === activeSectionId)) {
      setActiveSectionId(notebookSections[0].id);
    }
  }, [selectedNotebookId, notebookSections, activeSectionId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const requestedId = params.get("noteId");
    if (!requestedId) return;
    const found = notes.find((note) => String(note.id) === String(requestedId));
    if (!found) return;

    setSelectedNoteId(found.id);
    if (found.sectionId) {
      setActiveSectionId(found.sectionId);
      setExpandedSections((prev) => ({ ...prev, [found.sectionId]: true }));
    }
  }, [location.search, notes]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes
      .filter((note) => note.notebookId === selectedNotebookId)
      .filter((note) => {
        if (!q) return true;
        const body = stripHtml(note.body).toLowerCase();
        return (
          String(note.title || "").toLowerCase().includes(q) ||
          body.includes(q) ||
          (note.checklist || []).some((item) => String(item.text || "").toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (a.order || 0) - (b.order || 0);
      });
  }, [notes, selectedNotebookId, searchQuery]);

  const notesBySection = useMemo(() => {
    const map = new Map();
    notebookSections.forEach((section) => map.set(section.id, []));
    filteredNotes.forEach((note) => {
      if (!map.has(note.sectionId)) {
        map.set(note.sectionId, []);
      }
      map.get(note.sectionId).push(note);
    });
    return map;
  }, [filteredNotes, notebookSections]);

  const selectedNote = notes.find((note) => note.id === selectedNoteId) || null;

  useEffect(() => {
    if (!selectedNote) {
      setTitleDraft("");
      return;
    }
    const nextTitle = String(selectedNote.title || "");
    if (document.activeElement !== titleInputRef.current) {
      setTitleDraft(nextTitle);
    }
  }, [selectedNoteId, selectedNote?.title]);

  useEffect(() => {
    if (!activeSectionId) return;
    const sectionNotes = notesBySection.get(activeSectionId) || [];
    if (selectedNote && selectedNote.sectionId === activeSectionId) return;
    setSelectedNoteId(sectionNotes[0]?.id || null);
  }, [activeSectionId, notesBySection, selectedNote]);

  useEffect(() => {
    if (!editorRef.current) return;
    const nextHtml = selectedNote?.body || "";
    editorRef.current.innerHTML = nextHtml;
    lastHtmlRef.current = nextHtml;
  }, [selectedNoteId]);

  const queueNoteUpdate = (id, patch) => {
    if (!user?.id) return;
    const key = String(id);
    const existing = pendingNoteUpdates.current.get(key);
    if (existing) clearTimeout(existing);

    const timeoutId = setTimeout(async () => {
      try {
        await updateDoc(doc(db, "users", String(user.id), "notes", key), {
          ...patch,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error("Note update error:", error);
      }
    }, 300);

    pendingNoteUpdates.current.set(key, timeoutId);
  };

  const updateNote = (id, patch) => {
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note))
    );
    queueNoteUpdate(id, patch);
  };

  const handleCreateSection = async () => {
    if (!user?.id) return;
    const name = clampName(sectionInput).trim();
    if (!name) {
      toast.info(t("notesNeedSectionName"));
      return;
    }

    try {
      const refDoc = await addDoc(userCollection(user.id, "sections"), {
        notebookId: selectedNotebookId,
        name,
        pinnedToSidebar: false,
        createdAt: serverTimestamp()
      });
      setSectionInput("");
      setActiveSectionId(refDoc.id);
      setExpandedSections((prev) => ({ ...prev, [refDoc.id]: true }));
    } catch (error) {
      console.error("Create section error:", error);
      toast.info(t("notesSaveError"));
    }
  };

  const handleDeleteSection = async (targetSectionId = activeSectionId) => {
    if (!user?.id || !targetSectionId) return;

    try {
      const nextSectionId = notebookSections.find((section) => section.id !== targetSectionId)?.id || null;
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", String(user.id), "sections", String(targetSectionId)));

      notes
        .filter((note) => note.sectionId === targetSectionId)
        .forEach((note) => {
          const noteRef = doc(db, "users", String(user.id), "notes", String(note.id));
          if (nextSectionId) {
            batch.update(noteRef, {
              sectionId: nextSectionId,
              updatedAt: serverTimestamp()
            });
          } else {
            batch.delete(noteRef);
          }
        });

      await batch.commit();
      setActiveSectionId(nextSectionId);
    } catch (error) {
      console.error("Delete section error:", error);
      toast.info(t("notesSaveError"));
    }
  };

  const handleDeleteSectionItem = async (section) => {
    if (!section?.id) return;
    const sectionLabel = String(section.name || "").trim() || "te sekcje";
    const confirmed = window.confirm(`Czy na pewno chcesz usunac sekcje \"${sectionLabel}\"?`);
    if (!confirmed) return;
    await handleDeleteSection(section.id);
  };

  const handleCreatePage = async (sectionId) => {
    if (!user?.id || !sectionId) return;
    try {
      const refDoc = await addDoc(userCollection(user.id, "notes"), buildEmptyNote(sectionId, selectedNotebookId));
      setActiveSectionId(sectionId);
      setSelectedNoteId(refDoc.id);
      setExpandedSections((prev) => ({ ...prev, [sectionId]: true }));
    } catch (error) {
      console.error("Create page error:", error);
      toast.info(t("notesSaveError"));
    }
  };

  const handleRenameSection = async (section) => {
    if (!user?.id || !section?.id) return;
    const currentName = String(section.name || "").trim();
    const nextName = window.prompt("Podaj nowa nazwe sekcji", currentName || "Sekcja bez nazwy");
    if (!nextName || !nextName.trim()) return;
    try {
      await updateDoc(doc(db, "users", String(user.id), "sections", String(section.id)), {
        name: clampName(nextName).trim(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Rename section error:", error);
      toast.info(t("notesSaveError"));
    }
  };

  const handleRenamePage = async (note) => {
    if (!note?.id) return;
    const currentTitle = String(note.title || "").trim();
    const nextTitle = window.prompt("Podaj nowa nazwe strony", currentTitle || t("notesUntitled"));
    if (!nextTitle || !nextTitle.trim()) return;
    updateNote(note.id, { title: clampName(nextTitle).trim() });
  };

  const handleDeletePage = async (noteId) => {
    if (!user?.id || !noteId) return;
    try {
      await deleteDoc(doc(db, "users", String(user.id), "notes", String(noteId)));
      if (selectedNoteId === noteId) {
        const currentNotes = notesBySection.get(activeSectionId) || [];
        const next = currentNotes.find((note) => note.id !== noteId);
        setSelectedNoteId(next?.id || null);
      }
    } catch (error) {
      console.error("Delete page error:", error);
      toast.info(t("notesSaveError"));
    }
  };

  const handleDeletePageWithConfirm = async (note) => {
    if (!note?.id) return;
    const noteLabel = String(note.title || "").trim() || t("notesUntitled");
    const confirmed = window.confirm(`Czy na pewno chcesz usunac strone \"${noteLabel}\"?`);
    if (!confirmed) return;
    await handleDeletePage(note.id);
  };

  const handleExport = () => {
    const payload = { notes, notebooks, sections };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `notes-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const raw = JSON.parse(String(reader.result || ""));
        const normalized = normalizeNotesData(raw, {
          notebooks: [defaultNotebook],
          sections: [defaultSection]
        });

        const batch = writeBatch(db);
        notes.forEach((note) => batch.delete(doc(db, "users", String(user.id), "notes", String(note.id))));
        notebooks.forEach((notebook) => batch.delete(doc(db, "users", String(user.id), "notebooks", String(notebook.id))));
        sections.forEach((section) => batch.delete(doc(db, "users", String(user.id), "sections", String(section.id))));

        normalized.notebooks.forEach((notebook) => {
          const { id, ...payload } = notebook;
          batch.set(doc(db, "users", String(user.id), "notebooks", String(id)), {
            ...payload,
            createdAt: payload.createdAt || serverTimestamp()
          });
        });

        normalized.sections.forEach((section) => {
          const { id, ...payload } = section;
          batch.set(doc(db, "users", String(user.id), "sections", String(id)), {
            ...payload,
            createdAt: payload.createdAt || serverTimestamp()
          });
        });

        normalized.notes.forEach((note) => {
          const { id, ...payload } = note;
          batch.set(doc(db, "users", String(user.id), "notes", String(id)), {
            ...payload,
            createdAt: payload.createdAt || serverTimestamp(),
            updatedAt: payload.updatedAt || serverTimestamp()
          });
        });

        await batch.commit();
        setSelectedNotebookId(normalized.notebooks[0]?.id || defaultNotebook.id);
        const firstSectionId = normalized.sections[0]?.id || defaultSection.id;
        setActiveSectionId(firstSectionId);
        setExpandedSections({ [firstSectionId]: true });
        setSelectedNoteId(normalized.notes[0]?.id || null);
      } catch {
        toast.info(t("notesImportInvalid"));
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  };

  const runEditorCommand = (command, value) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
  };

  const toolbar = [
    { label: "B", command: "bold" },
    { label: "I", command: "italic" },
    { label: "U", command: "underline" },
    { label: "H1", command: "formatBlock", value: "h1" },
    { label: "H2", command: "formatBlock", value: "h2" },
    { label: "UL", command: "insertUnorderedList" },
    { label: "OL", command: "insertOrderedList" }
  ];

  const toggleSection = (sectionId) => {
    setActiveSectionId(sectionId);
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-3 sm:p-4">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">{t("notesTitle")}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sekcje po lewej jak menu. Strony sekcji rozwijaja sie pod spodem.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => handleCreatePage(activeSectionId)} disabled={!activeSectionId} className="gap-2">
              <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              {t("notesNew")}
            </Button>
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              {t("notesExport")}
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" />
              {t("notesImport")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleImport}
            />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
          <Card className="h-fit border-slate-200 dark:border-slate-800">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Sekcje</CardTitle>
                <Badge variant="secondary">{notebookSections.length}</Badge>
              </div>

              <div className="flex gap-2">
                <Input
                  value={sectionInput}
                  maxLength={NAME_MAX_LENGTH}
                  onChange={(event) => setSectionInput(clampName(event.target.value))}
                  placeholder={t("notesNewSection")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleCreateSection();
                    }
                  }}
                />
                <Button size="icon" variant="outline" onClick={handleCreateSection}>
                  <Plus className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  className="pl-9"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("notesSearch")}
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-3 max-h-[70vh] overflow-auto">
              {notebookSections.length === 0 && (
                <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  {t("notesEmpty")}
                </div>
              )}

              {notebookSections.map((section) => {
                const isExpanded = expandedSections[section.id] ?? section.id === activeSectionId;
                const isActive = section.id === activeSectionId;
                const sectionNotes = notesBySection.get(section.id) || [];
                const sectionLabel = String(section.name || "").trim() || "Sekcja bez nazwy";

                return (
                  <div key={section.id} className="space-y-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-1 rounded-md border px-2 py-1.5 text-left text-sm transition-colors",
                          isActive
                            ? "border-blue-500 bg-white text-slate-900 dark:border-blue-400 dark:bg-slate-900 dark:text-slate-100"
                            : "border-slate-200 bg-white text-slate-700 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        )}
                        onClick={() => toggleSection(section.id)}
                      >
                        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !isExpanded && "-rotate-90")} />
                        <span className="min-w-0 flex-1 whitespace-normal break-words font-medium leading-tight">{sectionLabel}</span>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 p-0"
                        onClick={() => void handleRenameSection(section)}
                        title="Zmien nazwe sekcji"
                      >
                        <Pencil className="h-2.5 w-2.5 text-violet-600 dark:text-violet-400" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 p-0"
                        onClick={() => void handleDeleteSectionItem(section)}
                        title="Usun sekcje"
                      >
                        <Trash2 className="h-2.5 w-2.5 text-red-600 dark:text-red-400" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 p-0"
                        onClick={() => handleCreatePage(section.id)}
                        title={t("notesAddPage")}
                      >
                        <Plus className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="space-y-1 pl-4">
                        {sectionNotes.length === 0 ? (
                          <button
                            type="button"
                            className="w-full rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-left text-xs text-slate-500 dark:border-slate-600"
                            onClick={() => handleCreatePage(section.id)}
                          >
                            {t("notesAddPage")}
                          </button>
                        ) : (
                          sectionNotes.map((note) => (
                            <div key={note.id} className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveSectionId(section.id);
                                  setSelectedNoteId(note.id);
                                }}
                                className={cn(
                                  "flex-1 rounded-md border px-2 py-1.5 text-left text-sm transition-colors",
                                  selectedNoteId === note.id
                                    ? "border-blue-500 bg-white text-slate-900 dark:border-blue-400 dark:bg-slate-900 dark:text-slate-100"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                )}
                              >
                                <div className="truncate">{note.title || t("notesUntitled")}</div>
                              </button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => void handleRenamePage(note)}
                                title="Zmien nazwe strony"
                              >
                                <Pencil className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => void handleDeletePageWithConfirm(note)}
                                title="Usun strone"
                              >
                                <Trash2 className="h-3 w-3 text-red-600 dark:text-red-400" />
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 min-h-[calc(100vh-230px)] flex flex-col">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notatka
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col">
              {!selectedNote && (
                <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-slate-500 flex-1">
                  {t("notesSelect")}
                </div>
              )}

              {selectedNote && (
                <>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <Input
                      ref={titleInputRef}
                      value={titleDraft}
                      maxLength={NAME_MAX_LENGTH}
                      onChange={(event) => {
                        const nextTitle = clampName(event.target.value);
                        setTitleDraft(nextTitle);
                        updateNote(selectedNote.id, { title: nextTitle });
                      }}
                      placeholder={t("notesTitlePlaceholder")}
                      className="text-lg font-semibold"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant={selectedNote.pinnedToSidebar ? "default" : "outline"}
                        onClick={() => {
                          const nextPinned = !selectedNote.pinnedToSidebar;
                          updateNote(selectedNote.id, {
                            pinned: nextPinned,
                            pinnedToSidebar: nextPinned,
                            visibilityScope: "all",
                            visibleOnPages: []
                          });
                        }}
                        title={selectedNote.pinnedToSidebar ? "Odepnij z panelu" : "Przypnij do panelu"}
                      >
                        <Pin className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" onClick={() => handleDeletePage(selectedNote.id)}>
                        <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
                    {toolbar.map((item) => (
                      <Button
                        key={item.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => runEditorCommand(item.command, item.value)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 flex-1 min-h-[calc(100vh-430px)]">
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      className="h-full min-h-[calc(100vh-430px)] px-4 py-4 text-[15px] leading-7 focus:outline-none"
                      onInput={(event) => {
                        const html = event.currentTarget.innerHTML;
                        lastHtmlRef.current = html;
                        updateNote(selectedNote.id, { body: html });
                      }}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
