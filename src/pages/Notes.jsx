import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/components/LanguageProvider";
import { useSubscription } from "@/hooks/use-subscription";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Download,
  ListTodo,
  NotebookPen,
  Pencil,
  Pin,
  Plus,
  Search,
  StickyNote,
  Trash2,
  Upload
} from "lucide-react";
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
import { uploadUserFile } from "@/lib/localStorage";

const userCollection = (userId, name) => collection(db, "users", String(userId), name);

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
  return value;
};

const buildEmptyNote = (type = "note", notebookId = "", sectionId = "") => ({
  id: createId(),
  title: "",
  body: "",
  checklist: [],
  type,
  notebookId,
  sectionId,
  parentId: null,
  order: Date.now(),
  pinned: false,
  tags: [],
  links: [],
  attachments: [],
  status: "active",
  priority: "medium",
  dueDate: "",
  reminderAt: "",
  reminderSentAt: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

const buildChecklistItem = () => ({
  id: createId(),
  text: "",
  done: false,
  dueDate: "",
  priority: "medium",
  note: ""
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

  const notes = base.notes.map((note) => ({
    ...note,
    id: note.id ?? createId(),
    notebookId: note.notebookId || notebookId,
    sectionId: note.sectionId || sectionId,
    parentId: note.parentId ?? null,
    order: typeof note.order === "number" ? note.order : Date.now(),
    tags: Array.isArray(note.tags) ? note.tags : [],
    links: Array.isArray(note.links) ? note.links : [],
    attachments: Array.isArray(note.attachments) ? note.attachments : [],
    checklist: Array.isArray(note.checklist) ? note.checklist : [],
    reminderSentAt: note.reminderSentAt || ""
  }));

  return {
    notes,
    notebooks: base.notebooks,
    sections: base.sections
  };
};

export default function Notes() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isPremium } = useSubscription(user?.id);
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);
  const lastHtmlRef = useRef("");
  const selectionRef = useRef(null);
  const imageInputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const pendingNoteUpdates = useRef(new Map());

  const [notes, setNotes] = useState([]);
  const [notebooks, setNotebooks] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedNotebookId, setSelectedNotebookId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkUrlInput, setLinkUrlInput] = useState("");
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [showTablePanel, setShowTablePanel] = useState(false);
  const [showImagePanel, setShowImagePanel] = useState(false);
  const [tableRows, setTableRows] = useState("3");
  const [tableCols, setTableCols] = useState("3");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [sectionInput, setSectionInput] = useState("");

  const notebookColors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-indigo-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500"
  ];

  const defaultNotebook = useMemo(
    () => ({ id: "default", name: t("notesDefaultNotebook") }),
    [t]
  );
  const defaultSection = useMemo(
    () => ({ id: "general", notebookId: "default", name: t("notesDefaultSection") }),
    [t]
  );

  useEffect(() => {
    if (!user?.id) {
      setNotes([]);
      setNotebooks([defaultNotebook]);
      setSections([defaultSection]);
      setSelectedNotebookId(defaultNotebook.id);
      setSelectedSectionId(defaultSection.id);
      return undefined;
    }

    const notebooksRef = userCollection(user.id, "notebooks");
    const sectionsRef = userCollection(user.id, "sections");
    const notesRef = userCollection(user.id, "notes");

    const notebookQuery = query(notebooksRef, orderBy("createdAt", "asc"));
    const sectionQuery = query(sectionsRef, orderBy("createdAt", "asc"));
    const notesQuery = query(notesRef, orderBy("order", "asc"));

    const unsubscribeNotebooks = onSnapshot(notebookQuery, (snapshot) => {
      const items = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
        createdAt: toIsoString(item.data().createdAt)
      }));
      if (items.length === 0) {
        void setDoc(
          doc(db, "users", String(user.id), "notebooks", "default"),
          {
            name: defaultNotebook.name,
            createdAt: serverTimestamp()
          },
          { merge: true }
        ).catch((error) => {
          console.error('Default notebook error:', error);
        });
        return;
      }
      setNotebooks(items);
      if (!selectedNotebookId) {
        setSelectedNotebookId(items[0].id);
      }
    });

    const unsubscribeSections = onSnapshot(sectionQuery, (snapshot) => {
      const items = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
        createdAt: toIsoString(item.data().createdAt)
      }));
      if (items.length === 0) {
        void setDoc(
          doc(db, "users", String(user.id), "sections", "general"),
          {
            name: defaultSection.name,
            notebookId: "default",
            createdAt: serverTimestamp()
          },
          { merge: true }
        ).catch((error) => {
          console.error('Default section error:', error);
        });
        return;
      }
      setSections(items);
      if (!selectedSectionId) {
        const nextSectionId = items.find((section) => section.notebookId === selectedNotebookId)?.id || items[0].id;
        setSelectedSectionId(nextSectionId);
      }
    });

    const unsubscribeNotes = onSnapshot(notesQuery, (snapshot) => {
      const items = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          ...data,
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
          reminderSentAt: data.reminderSentAt || ""
        };
      });
      setNotes(items);
      if (!selectedId && items.length) {
        setSelectedId(items[0].id);
      }
    });

    return () => {
      unsubscribeNotebooks();
      unsubscribeSections();
      unsubscribeNotes();
    };
  }, [user?.id, defaultNotebook.name, defaultSection.name, selectedNotebookId, selectedSectionId]);

  useEffect(() => {
    setTagInput("");
    setLinkTitle("");
    setLinkUrl("");
    setLinkUrlInput("");
    setShowLinkPanel(false);
    setShowTablePanel(false);
    setShowImagePanel(false);
  }, [selectedId]);

  const selectedNote = notes.find((note) => note.id === selectedId) || null;
  const notebookSections = sections.filter((section) => section.notebookId === selectedNotebookId);
  const selectedSection = sections.find((section) => section.id === selectedSectionId) || null;

  useEffect(() => {
    if (!editorRef.current) return;
    const nextHtml = selectedNote?.body || "";
    if (document.activeElement === editorRef.current && lastHtmlRef.current === nextHtml) {
      return;
    }
    editorRef.current.innerHTML = nextHtml;
    lastHtmlRef.current = nextHtml;
  }, [selectedId, selectedNote?.body]);

  const notifyInfo = (message) => {
    if (!message) return;
    toast.info(message);
  };

  const ensureSelectedNote = () => {
    if (selectedNote) return true;
    notifyInfo(t("notesSelectFirst"));
    return false;
  };

  useEffect(() => {
    if (!selectedNotebookId && notebooks.length) {
      setSelectedNotebookId(notebooks[0].id);
      return;
    }
    if (selectedNotebookId && notebookSections.length && !selectedSectionId) {
      setSelectedSectionId(notebookSections[0].id);
      return;
    }
    if (selectedSectionId && notebookSections.every((section) => section.id !== selectedSectionId)) {
      setSelectedSectionId(notebookSections[0]?.id || null);
    }
  }, [notebooks, notebookSections, selectedNotebookId, selectedSectionId]);


  const stripHtml = (value) =>
    String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const isEmptyHtml = (value) => stripHtml(value).length === 0;

  const filteredNotes = useMemo(() => {
    const lowered = searchQuery.trim().toLowerCase();
    return notes
      .filter((note) => {
        if (selectedNotebookId && note.notebookId !== selectedNotebookId) {
          return false;
        }
        if (selectedSectionId && note.sectionId !== selectedSectionId) {
          return false;
        }
        if (!lowered) {
          return true;
        }
        const bodyText = stripHtml(note.body).toLowerCase();
        return (
          note.title.toLowerCase().includes(lowered) ||
          bodyText.includes(lowered) ||
          note.tags.some((tag) => tag.toLowerCase().includes(lowered)) ||
          note.checklist.some((item) => item.text.toLowerCase().includes(lowered))
        );
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }
        return (a.order || 0) - (b.order || 0);
      });
  }, [notes, searchQuery, selectedNotebookId, selectedSectionId]);

  const handleCreate = async (type) => {
    if (!user?.id) return;
    try {
      const notebookId = selectedNotebookId || defaultNotebook.id;
      const sectionId = selectedSectionId || defaultSection.id;
      if (!selectedNotebookId) {
        setSelectedNotebookId(notebookId);
      }
      if (!selectedSectionId) {
        setSelectedSectionId(sectionId);
      }
      const { id: _tempId, ...payload } = buildEmptyNote(type, notebookId, sectionId);
      const refDoc = await addDoc(userCollection(user.id, "notes"), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setSelectedId(refDoc.id);
      if (searchQuery) {
        setSearchQuery("");
      }
    } catch (error) {
      console.error('Create note error:', error);
      notifyInfo(t("notesSaveError"));
    }
  };

  const handleCreateSubpage = async (parentId) => {
    if (!user?.id) return;
    if (!parentId) {
      notifyInfo(t("notesSelectFirst"));
      return;
    }
    try {
      const notebookId = selectedNotebookId || defaultNotebook.id;
      const sectionId = selectedSectionId || defaultSection.id;
      const { id: _tempId, ...payload } = buildEmptyNote("note", notebookId, sectionId);
      const refDoc = await addDoc(userCollection(user.id, "notes"), {
        ...payload,
        parentId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setSelectedId(refDoc.id);
      if (searchQuery) {
        setSearchQuery("");
      }
    } catch (error) {
      console.error('Create subpage error:', error);
      notifyInfo(t("notesSaveError"));
    }
  };

  const queueNoteUpdate = (id, patch) => {
    if (!user?.id) return;
    const key = String(id);
    const existing = pendingNoteUpdates.current.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    const timeoutId = setTimeout(async () => {
      try {
        const refDoc = doc(db, "users", String(user.id), "notes", key);
        await updateDoc(refDoc, { ...patch, updatedAt: serverTimestamp() });
      } catch (error) {
        console.error('Note update error:', error);
      }
    }, 400);
    pendingNoteUpdates.current.set(key, timeoutId);
  };

  const updateNote = (id, patch) => {
    setNotes((prev) =>
      prev.map((note) =>
        note.id === id
          ? { ...note, ...patch, updatedAt: new Date().toISOString() }
          : note
      )
    );
    queueNoteUpdate(id, patch);
  };

  const handleDelete = async (id) => {
    if (!user?.id) return;
    try {
      await deleteDoc(doc(db, "users", String(user.id), "notes", String(id)));
      if (selectedId === id) {
        setSelectedId(notes.find((note) => note.id !== id)?.id || null);
      }
    } catch (error) {
      console.error('Delete note error:', error);
      notifyInfo(t("notesSaveError"));
    }
  };

  const handleChecklistAdd = () => {
    if (!ensureSelectedNote()) return;
    updateNote(selectedNote.id, {
      checklist: [...selectedNote.checklist, buildChecklistItem()]
    });
  };

  const handleChecklistUpdate = (itemId, patch) => {
    if (!selectedNote) return;
    updateNote(selectedNote.id, {
      checklist: selectedNote.checklist.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item
      )
    });
  };

  const handleChecklistRemove = (itemId) => {
    if (!selectedNote) return;
    updateNote(selectedNote.id, {
      checklist: selectedNote.checklist.filter((item) => item.id !== itemId)
    });
  };

  const handleChecklistMove = (itemId, direction) => {
    if (!selectedNote) return;
    const index = selectedNote.checklist.findIndex((item) => item.id === itemId);
    if (index < 0) return;
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= selectedNote.checklist.length) return;
    const reordered = [...selectedNote.checklist];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    updateNote(selectedNote.id, { checklist: reordered });
  };

  const handleTagAdd = () => {
    if (!ensureSelectedNote()) return;
    if (!tagInput.trim()) {
      notifyInfo(t("notesNeedTag"));
      return;
    }
    const nextTag = tagInput.trim();
    if (selectedNote.tags.includes(nextTag)) {
      setTagInput("");
      return;
    }
    updateNote(selectedNote.id, { tags: [...selectedNote.tags, nextTag] });
    setTagInput("");
  };

  const handleTagRemove = (tag) => {
    if (!selectedNote) return;
    updateNote(selectedNote.id, { tags: selectedNote.tags.filter((item) => item !== tag) });
  };

  const handleLinkAdd = () => {
    if (!ensureSelectedNote()) return;
    if (!linkUrl.trim()) {
      notifyInfo(t("notesNeedLink"));
      return;
    }
    const next = {
      id: createId(),
      title: linkTitle.trim() || linkUrl.trim(),
      url: linkUrl.trim()
    };
    updateNote(selectedNote.id, { links: [...selectedNote.links, next] });
    setLinkTitle("");
    setLinkUrl("");
  };

  const handleLinkRemove = (linkId) => {
    if (!selectedNote) return;
    updateNote(selectedNote.id, { links: selectedNote.links.filter((link) => link.id !== linkId) });
  };

  const handleAttachmentUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedNote) return;
    try {
      const url = await uploadUserFile(user?.id, file, 'notes-attachments');
      if (!url) return;
      const next = {
        id: createId(),
        name: file.name || 'attachment',
        url,
        uploadedAt: new Date().toISOString()
      };
      updateNote(selectedNote.id, { attachments: [...(selectedNote.attachments || []), next] });
    } catch (error) {
      console.error('Attachment upload error:', error);
      notifyInfo(t("notesAttachmentUploadError"));
    } finally {
      event.target.value = "";
    }
  };

  const handleAttachmentRemove = (attachmentId) => {
    if (!selectedNote) return;
    updateNote(selectedNote.id, {
      attachments: (selectedNote.attachments || []).filter((item) => item.id !== attachmentId)
    });
  };


  const handleAddSection = async () => {
    if (!user?.id) return;
    if (!selectedNotebookId) {
      notifyInfo(t("notesSelectNotebook"));
      return;
    }
    if (!sectionInput.trim()) {
      notifyInfo(t("notesNeedSectionName"));
      return;
    }
    try {
      const refDoc = await addDoc(userCollection(user.id, "sections"), {
        notebookId: selectedNotebookId,
        name: sectionInput.trim(),
        createdAt: serverTimestamp()
      });
      setSelectedSectionId(refDoc.id);
      setSectionInput("");
    } catch (error) {
      console.error('Add section error:', error);
      notifyInfo(t("notesSaveError"));
    }
  };


  const handleDeleteSection = async () => {
    if (!user?.id) return;
    if (!selectedSection) {
      notifyInfo(t("notesSelectSection"));
      return;
    }
    if (notebookSections.length <= 1) {
      notifyInfo(t("notesDeleteBlockedSection"));
      return;
    }
    try {
      const remainingSections = sections.filter((section) => section.id !== selectedSection.id);
      const fallbackSectionId = remainingSections.find((section) => section.notebookId === selectedNotebookId)?.id;
      setSelectedSectionId(fallbackSectionId || null);
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", String(user.id), "sections", String(selectedSection.id)));
      notes
        .filter((note) => note.sectionId === selectedSection.id)
        .forEach((note) => {
          const refDoc = doc(db, "users", String(user.id), "notes", String(note.id));
          batch.update(refDoc, { sectionId: fallbackSectionId || note.sectionId, updatedAt: serverTimestamp() });
        });
      await batch.commit();
    } catch (error) {
      console.error('Delete section error:', error);
      notifyInfo(t("notesSaveError"));
    }
  };

  const handleQuickAddSection = async () => {
    if (!user?.id) return;
    if (!selectedNotebookId) {
      notifyInfo(t("notesSelectNotebook"));
      return;
    }
    if (!sectionInput.trim()) {
      notifyInfo(t("notesNeedSectionName"));
      return;
    }
    try {
      const refDoc = await addDoc(userCollection(user.id, "sections"), {
        notebookId: selectedNotebookId,
        name: sectionInput.trim(),
        createdAt: serverTimestamp()
      });
      setSelectedSectionId(refDoc.id);
      setSectionInput("");
    } catch (error) {
      console.error('Quick add section error:', error);
      notifyInfo(t("notesSaveError"));
    }
  };

  const handleRenameSectionPrompt = async () => {
    if (!user?.id) return;
    if (!selectedSection) {
      notifyInfo(t("notesSelectSection"));
      return;
    }
    const name = window.prompt(t("notesRenameSectionPrompt"), selectedSection.name);
    if (!name || !name.trim()) return;
    try {
      await updateDoc(doc(db, "users", String(user.id), "sections", String(selectedSection.id)), {
        name: name.trim()
      });
    } catch (error) {
      console.error('Rename section error:', error);
      notifyInfo(t("notesSaveError"));
    }
  };

  const handleRenamePagePrompt = () => {
    if (!selectedNote) {
      notifyInfo(t("notesSelectFirst"));
      return;
    }
    const name = window.prompt(t("notesRenamePagePrompt"), selectedNote.title || "");
    if (!name || !name.trim()) return;
    updateNote(selectedNote.id, { title: name.trim() });
  };

  const [dragId, setDragId] = useState(null);

  const getSectionNotes = (items) =>
    items.filter(
      (note) => note.notebookId === selectedNotebookId && note.sectionId === selectedSectionId
    );

  const reorderSiblings = (items, draggedId, targetId) => {
    const dragged = items.find((note) => note.id === draggedId);
    const target = items.find((note) => note.id === targetId);
    if (!dragged || !target) return items;

    const nextParentId = target.parentId ?? null;
    const siblings = getSectionNotes(items).filter((note) => (note.parentId ?? null) === nextParentId);
    const withoutDragged = siblings.filter((note) => note.id !== draggedId);
    const targetIndex = withoutDragged.findIndex((note) => note.id === targetId);
    if (targetIndex < 0) return items;
    withoutDragged.splice(targetIndex, 0, { ...dragged, parentId: nextParentId });

    const orderMap = new Map();
    withoutDragged.forEach((note, index) => {
      orderMap.set(note.id, index + 1);
    });

    return items.map((note) => {
      if (!orderMap.has(note.id)) {
        return note;
      }
      return {
        ...note,
        parentId: note.id === draggedId ? nextParentId : note.parentId ?? null,
        order: orderMap.get(note.id)
      };
    });
  };

  const persistOrder = async (items) => {
    if (!user?.id || !items.length) return;
    try {
      const batch = writeBatch(db);
      items.forEach((note) => {
        const refDoc = doc(db, "users", String(user.id), "notes", String(note.id));
        batch.update(refDoc, {
          parentId: note.parentId ?? null,
          order: note.order || 0,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    } catch (error) {
      console.error('Persist order error:', error);
    }
  };

  const handleDropOnContainer = () => {
    if (!dragId) return;
    setNotes((prev) => {
      const dragged = prev.find((note) => note.id === dragId);
      if (!dragged) return prev;
      const topLevel = getSectionNotes(prev).filter((note) => !note.parentId);
      const maxOrder = topLevel.reduce((max, note) => Math.max(max, note.order || 0), 0);
      const next = prev.map((note) =>
        note.id === dragId
          ? { ...note, parentId: null, order: maxOrder + 1 }
          : note
      );
      const affected = getSectionNotes(next);
      persistOrder(affected);
      return next;
    });
    setDragId(null);
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
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (!user?.id) return;
        const raw = JSON.parse(String(reader.result || ""));
        const normalized = normalizeNotesData(raw, {
          notebooks: [defaultNotebook],
          sections: [defaultSection]
        });

        const batch = writeBatch(db);

        notes.forEach((note) => {
          batch.delete(doc(db, "users", String(user.id), "notes", String(note.id)));
        });
        notebooks.forEach((notebook) => {
          batch.delete(doc(db, "users", String(user.id), "notebooks", String(notebook.id)));
        });
        sections.forEach((section) => {
          batch.delete(doc(db, "users", String(user.id), "sections", String(section.id)));
        });

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
        setSelectedSectionId(
          normalized.sections.find((section) => section.notebookId === normalized.notebooks[0]?.id)?.id ||
            defaultSection.id
        );
        setSelectedId(normalized.notes[0]?.id || null);
      } catch (error) {
        notifyInfo(t("notesImportInvalid"));
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const formatDate = (value) => {
    if (!value) return "";
    return new Date(value).toLocaleDateString();
  };

  const ensureEditorSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();

    if (selectionRef.current) {
      selection?.removeAllRanges();
      selection?.addRange(selectionRef.current);
      editor.focus();
      return;
    }

    if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
      selectionRef.current = range;
    }
  };

  const applyEditorCommand = (command, value) => {
    if (!editorRef.current) return;
    ensureEditorSelection();
    const selection = window.getSelection();
    if (selectionRef.current && selection) {
      selection.removeAllRanges();
      selection.addRange(selectionRef.current);
    }
    editorRef.current.focus();
    document.execCommand("styleWithCSS", false, true);
    document.execCommand(command, false, value);
    if (selection && selection.rangeCount) {
      selectionRef.current = selection.getRangeAt(0);
    }
  };

  const applyInlineStyle = (styleObject) => {
    if (!editorRef.current) return;
    ensureEditorSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const span = document.createElement("span");
    Object.entries(styleObject).forEach(([key, value]) => {
      span.style[key] = value;
    });

    try {
      range.surroundContents(span);
    } catch (error) {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }

    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(newRange);
    selectionRef.current = newRange;
  };

  const applyFontName = (fontName) => {
    if (!fontName) return;
    applyInlineStyle({ fontFamily: fontName });
  };

  const applyFontSize = (sizePx) => {
    if (!sizePx) return;
    applyInlineStyle({ fontSize: `${sizePx}px` });
  };

  const applyHeading = (tag) => {
    if (!tag) return;
    applyEditorCommand("formatBlock", tag);
  };

  const applyListStyle = (style, ordered) => {
    if (!editorRef.current) return;
    ensureEditorSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    applyEditorCommand(ordered ? "insertOrderedList" : "insertUnorderedList");

    let node = selection.anchorNode;
    while (node && node.nodeName !== "UL" && node.nodeName !== "OL") {
      node = node.parentNode;
    }

    if (!node) {
      const range = selection.getRangeAt(0);
      const listTag = ordered ? "ol" : "ul";
      const list = document.createElement(listTag);
      list.style.listStyleType = style;
      const li = document.createElement("li");
      li.innerHTML = "<br />";
      list.appendChild(li);
      range.insertNode(list);
      range.setStart(li, 0);
      range.setEnd(li, 0);
      selection.removeAllRanges();
      selection.addRange(range);
      selectionRef.current = range;
      return;
    }

    if (node.style) {
      node.style.listStyleType = style;
    }
  };

  const saveSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    if (!editor.contains(selection.anchorNode)) return;
    selectionRef.current = selection.getRangeAt(0);
  };

  useEffect(() => {
    const handler = () => saveSelection();
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  const handleCreateLink = () => {
    if (!linkUrlInput.trim()) {
      notifyInfo(t("notesNeedLink"));
      return;
    }
    applyEditorCommand("createLink", linkUrlInput.trim());
    setLinkUrlInput("");
    setShowLinkPanel(false);
  };

  const handleInsertTable = () => {
    const rows = Number(tableRows);
    const cols = Number(tableCols);
    if (!rows || !cols || rows < 1 || cols < 1) return;
    let html = "<table style='width:100%; border-collapse:collapse;'>";
    for (let r = 0; r < rows; r += 1) {
      html += "<tr>";
      for (let c = 0; c < cols; c += 1) {
        html += "<td style='border:1px solid #cbd5f5; padding:6px;'>&nbsp;</td>";
      }
      html += "</tr>";
    }
    html += "</table><p></p>";
    applyEditorCommand("insertHTML", html);
    setShowTablePanel(false);
  };

  const handleInsertImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    const html = `<img src='${imageUrlInput.trim()}' style='max-width:100%; height:auto;' />`;
    applyEditorCommand("insertHTML", html);
    setImageUrlInput("");
    setShowImagePanel(false);
  };

  const handleInsertImageFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadUserFile(user?.id, file, 'notes-images');
      if (url) {
        const html = `<img src='${url}' style='max-width:100%; height:auto;' />`;
        applyEditorCommand("insertHTML", html);
      }
    } catch (error) {
      notifyInfo(t("notesImageUploadError"));
    }
    event.target.value = "";
  };

  const requirePremium = (action) => {
    if (isPremium) {
      action();
      return;
    }
    toast.info(t("billingUpgradeNeeded"));
    window.location.href = createPageUrl("Billing");
  };

  const requestNotificationPermission = () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission()
        .then((result) => {
          if (result !== "granted") {
            toast.info(t("notesReminderPermission"));
          }
        })
        .catch(() => {
          toast.info(t("notesReminderPermission"));
        });
    }
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const dueNotes = notes.filter((note) =>
        note.reminderAt &&
        !note.reminderSentAt &&
        note.status === "active" &&
        new Date(note.reminderAt).getTime() <= now
      );

      if (!dueNotes.length) return;
      if (Notification.permission !== "granted") {
        toast.info(t("notesReminderFallback"));
        setNotes((prev) =>
          prev.map((note) =>
            dueNotes.some((due) => due.id === note.id)
              ? { ...note, reminderSentAt: new Date().toISOString() }
              : note
          )
        );
        return;
      }

      dueNotes.forEach((note) => {
        const title = note.title || t("notesUntitled");
        const bodyText = stripHtml(note.body);
        const body = bodyText ? bodyText.slice(0, 140) : t("notesBodyPlaceholder");
        new Notification(title, { body });
      });

      setNotes((prev) =>
        prev.map((note) =>
          dueNotes.some((due) => due.id === note.id)
            ? { ...note, reminderSentAt: new Date().toISOString() }
            : note
        )
      );
    }, 30000);

    return () => clearInterval(interval);
  }, [notes, t]);

  const renderNoteCard = (note, depth = 0) => (
    <button
      key={note.id}
      onClick={() => setSelectedId(note.id)}
      draggable
      onDragStart={() => setDragId(note.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        setNotes((prev) => {
          const next = reorderSiblings(prev, dragId, note.id);
          const affected = getSectionNotes(next);
          persistOrder(affected);
          return next;
        });
        setDragId(null);
      }}
      className={cn(
        "w-full text-left rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 transition-all",
        depth > 0 && "ml-4 border-l-4 border-l-slate-200/70 pl-3 border-dashed",
        selectedId === note.id
          ? "bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border-blue-200 dark:border-blue-900"
          : "bg-white/70 dark:bg-slate-900/40 hover:border-blue-200"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
            {note.title || t("notesUntitled")}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {stripHtml(note.body) || t("notesNoPreview")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleCreateSubpage(note.id);
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={t("notesAddSubpage")}
          >
            <Plus className="h-3 w-3" />
          </button>
          {note.pinned && <Pin className="w-4 h-4 text-amber-500" />}
        </div>
      </div>
      <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
        {formatDate(note.updatedAt || note.createdAt)}
      </div>
    </button>
  );

  const renderLibraryContent = () => {
    if (filteredNotes.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {t("notesEmpty")}
        </div>
      );
    }
    if (searchQuery.trim()) {
      return <div className="space-y-2">{filteredNotes.map((note) => renderNoteCard(note, 0))}</div>;
    }
    const topLevel = filteredNotes.filter((note) => !note.parentId);
    const childMap = new Map();
    filteredNotes.forEach((note) => {
      if (!note.parentId) return;
      if (!childMap.has(note.parentId)) {
        childMap.set(note.parentId, []);
      }
      childMap.get(note.parentId).push(note);
    });

    const sortByOrder = (a, b) => (a.order || 0) - (b.order || 0);
    topLevel.sort(sortByOrder);
    childMap.forEach((items) => items.sort(sortByOrder));

    return (
      <div className="space-y-2" onDragOver={(event) => event.preventDefault()} onDrop={handleDropOnContainer}>
        {topLevel.map((note) => (
          <div key={note.id} className="space-y-2">
            {renderNoteCard(note, 0)}
            {(childMap.get(note.id) || []).map((child) => renderNoteCard(child, 1))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-[#0f0f16] dark:via-[#14141f] dark:to-[#1a1a2e] p-2 sm:p-3">
      <div className="max-w-none mx-0 px-2 sm:px-3 py-3 space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t("notesTitle")}</h1>
            <p className="text-slate-600 dark:text-slate-400">{t("notesSubtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => handleCreate("note")} className="gap-2">
              <StickyNote className="w-4 h-4" />
              {t("notesNew")}
              {t("notesExport")}
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="w-4 h-4" />
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
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <section className="flex-1 space-y-3">
            <Card className="bg-white/90 dark:bg-[#14141f] border border-slate-200 dark:border-[#2d2d40] shadow-lg">
              <CardContent className="p-3">
                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <span className="inline-flex h-3 w-3 rounded-sm bg-slate-400" />
                    {selectedNotebookId ? notebooks.find((notebook) => notebook.id === selectedNotebookId)?.name : t("notesDefaultNotebook")}
                  </div>
                  <div className="flex-1">
                    <Tabs value={selectedSectionId || ""} onValueChange={setSelectedSectionId}>
                      <TabsList className="flex flex-wrap gap-1 bg-transparent p-0">
                        {notebookSections.map((section, index) => (
                          <TabsTrigger
                            key={section.id}
                            value={section.id}
                            className={cn(
                              "rounded-t-lg rounded-b-none border border-b-0 border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900",
                              index % 5 === 0 && "border-t-4 border-t-rose-400",
                              index % 5 === 1 && "border-t-4 border-t-amber-400",
                              index % 5 === 2 && "border-t-4 border-t-emerald-400",
                              index % 5 === 3 && "border-t-4 border-t-blue-400",
                              index % 5 === 4 && "border-t-4 border-t-violet-400"
                            )}
                          >
                            {section.name}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={sectionInput}
                      onChange={(event) => setSectionInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          handleQuickAddSection();
                        }
                      }}
                      placeholder={t("notesNewSection")}
                      className="h-9 w-44"
                    />
                    <Button size="sm" variant="outline" onClick={handleQuickAddSection} className="gap-1">
                      <Plus className="w-4 h-4" />
                      {t("notesAddSection")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDeleteSection}
                      disabled={!selectedSection || notebookSections.length <= 1}
                      className="gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("notesDeleteSection")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
              <Card className="bg-white/90 dark:bg-[#14141f] border border-slate-200 dark:border-[#2d2d40] shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <NotebookPen className="w-4 h-4" />
                    {t("notesPages")}
                  </CardTitle>
                  <Badge variant="secondary">{filteredNotes.length}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <button
                    onClick={() => handleCreate("note")}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300">+</span>
                      {t("notesAddPage")}
                    </span>
                  </button>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder={t("notesSearch")}
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-[64vh] overflow-auto space-y-2">
                    {renderLibraryContent()}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/90 dark:bg-[#14141f] shadow-xl border border-slate-200 dark:border-[#2d2d40]">
                <CardHeader className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Pencil className="w-4 h-4" />
                      {t("notesEditor")}
                    </CardTitle>
                    {selectedNote && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateNote(selectedNote.id, { pinned: !selectedNote.pinned })}
                          className="gap-2"
                        >
                          <Pin className="w-4 h-4" />
                          {selectedNote.pinned ? t("notesUnpin") : t("notesPin")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(selectedNote.id)}
                          className="gap-2 text-rose-600 hover:text-rose-700"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t("notesDelete")}
                        </Button>
                      </div>
                    )}
                  </div>

                </CardHeader>
                <CardContent className="space-y-6">
                  {!selectedNote && (
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
                      {t("notesSelect")}
                    </div>
                  )}

                  {selectedNote && (
                    <>
                      <div className="flex items-end gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                        <Input
                          value={selectedNote.title}
                          onChange={(event) => updateNote(selectedNote.id, { title: event.target.value })}
                          placeholder={t("notesTitlePlaceholder")}
                          className="flex-1 text-2xl font-semibold bg-transparent border-0 rounded-none px-0 text-center focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(selectedNote.createdAt)}
                        </div>
                      </div>

                        <div className="rounded-md border border-slate-200 bg-white/70 px-3 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold">{t("notesAttachments")}</span>
                            <div className="flex items-center gap-2">
                              <input
                                ref={attachmentInputRef}
                                type="file"
                                className="hidden"
                                onChange={handleAttachmentUpload}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => attachmentInputRef.current?.click()}
                              >
                                {t("notesAddAttachment")}
                              </Button>
                            </div>
                          </div>
                          {selectedNote.attachments && selectedNote.attachments.length > 0 ? (
                            <div className="mt-2 space-y-2">
                              {selectedNote.attachments.map((item) => (
                                <div key={item.id} className="flex items-center justify-between gap-2">
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm text-blue-600 hover:underline dark:text-blue-300"
                                  >
                                    {item.name}
                                  </a>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleAttachmentRemove(item.id)}
                                    className="text-rose-500 hover:text-rose-600"
                                  >
                                    {t("notesRemoveAttachment")}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                              {t("notesAttachmentsEmpty")}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white/70 px-2 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <select
                            className="h-8 rounded border border-slate-200 bg-transparent px-2 text-sm dark:border-slate-700"
                              onChange={(event) => applyFontName(event.target.value)}
                            defaultValue="Calibri"
                            onFocus={saveSelection}
                          >
                            <option value="Calibri">Calibri</option>
                            <option value="Arial">Arial</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Verdana">Verdana</option>
                            <option value="Tahoma">Tahoma</option>
                          </select>
                          <select
                            className="h-8 rounded border border-slate-200 bg-transparent px-2 text-sm dark:border-slate-700"
                              onChange={(event) => applyFontSize(event.target.value)}
                              defaultValue="14"
                            onFocus={saveSelection}
                          >
                              <option value="12">12</option>
                              <option value="14">14</option>
                              <option value="16">16</option>
                              <option value="18">18</option>
                              <option value="22">22</option>
                              <option value="28">28</option>
                          </select>
                            <select
                              className="h-8 rounded border border-slate-200 bg-transparent px-2 text-sm dark:border-slate-700"
                              onChange={(event) => applyHeading(event.target.value)}
                              defaultValue="p"
                              onFocus={saveSelection}
                            >
                              <option value="p">Normal</option>
                              <option value="h1">Heading 1</option>
                              <option value="h2">Heading 2</option>
                              <option value="h3">Heading 3</option>
                            </select>
                        </div>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

                        <div className="flex items-center gap-1">
                          <button type="button" className="h-8 w-8 rounded border border-slate-200 font-bold dark:border-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand("bold")}>B</button>
                          <button type="button" className="h-8 w-8 rounded border border-slate-200 italic dark:border-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand("italic")}>I</button>
                          <button type="button" className="h-8 w-8 rounded border border-slate-200 underline dark:border-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand("underline")}>U</button>
                          <button type="button" className="h-8 w-8 rounded border border-slate-200 line-through dark:border-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand("strikeThrough")}>S</button>
                          <button type="button" className="h-8 w-8 rounded border border-slate-200 text-xs dark:border-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand("superscript")}>x^2</button>
                          <button type="button" className="h-8 w-8 rounded border border-slate-200 text-xs dark:border-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand("subscript")}>x_2</button>
                          <label className="flex items-center gap-1 text-xs">
                            <span className="text-slate-500 dark:text-slate-400">A</span>
                            <input
                              type="color"
                              className="h-8 w-8 rounded border border-slate-200 bg-transparent dark:border-slate-700"
                              onChange={(event) => applyInlineStyle({ color: event.target.value })}
                              onFocus={saveSelection}
                            />
                          </label>
                          <label className="flex items-center gap-1 text-xs">
                            <span className="text-slate-500 dark:text-slate-400">HL</span>
                            <input
                              type="color"
                              className="h-8 w-8 rounded border border-slate-200 bg-transparent dark:border-slate-700"
                              onChange={(event) => applyInlineStyle({ backgroundColor: event.target.value })}
                              onFocus={saveSelection}
                            />
                          </label>
                        </div>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

                        <div className="flex items-center gap-2">
                          <select
                            className="h-8 rounded border border-slate-200 bg-transparent px-2 text-sm dark:border-slate-700"
                            onChange={(event) => applyListStyle(event.target.value, false)}
                            defaultValue="disc"
                            onFocus={saveSelection}
                          >
                            <option value="disc">• Bullets</option>
                            <option value="circle">○ Circle</option>
                            <option value="square">■ Square</option>
                          </select>
                          <select
                            className="h-8 rounded border border-slate-200 bg-transparent px-2 text-sm dark:border-slate-700"
                            onChange={(event) => applyListStyle(event.target.value, true)}
                            defaultValue="decimal"
                            onFocus={saveSelection}
                          >
                            <option value="decimal">1. Number</option>
                            <option value="lower-alpha">a. Lower alpha</option>
                            <option value="upper-alpha">A. Upper alpha</option>
                            <option value="lower-roman">i. Lower roman</option>
                            <option value="upper-roman">I. Upper roman</option>
                          </select>
                          <button type="button" className="h-8 w-8 rounded border border-slate-200 dark:border-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand("outdent")}>←</button>
                          <button type="button" className="h-8 w-8 rounded border border-slate-200 dark:border-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand("indent")}>→</button>
                        </div>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

                        <div className="flex items-center gap-1">
                          <button type="button" className="h-8 w-8 rounded border border-slate-200 dark:border-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand("justifyLeft")}>L</button>
                          <button type="button" className="h-8 w-8 rounded border border-slate-200 dark:border-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand("justifyCenter")}>C</button>
                          <button type="button" className="h-8 w-8 rounded border border-slate-200 dark:border-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand("justifyRight")}>R</button>
                        </div>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="h-8 w-12 rounded border border-slate-200 text-xs dark:border-slate-700"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => setShowLinkPanel((prev) => !prev)}
                          >
                            Link
                          </button>
                          <button type="button" className="h-8 w-14 rounded border border-slate-200 text-xs dark:border-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand("unlink")}>Unlink</button>
                          <button type="button" className="h-8 w-12 rounded border border-slate-200 text-xs dark:border-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand("removeFormat")}>Clear</button>
                        </div>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="h-8 w-12 rounded border border-slate-200 text-xs dark:border-slate-700"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => requirePremium(() => setShowTablePanel((prev) => !prev))}
                          >
                            Table
                          </button>
                          <button
                            type="button"
                            className="h-8 w-12 rounded border border-slate-200 text-xs dark:border-slate-700"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => requirePremium(() => setShowImagePanel((prev) => !prev))}
                          >
                            Image
                          </button>
                          <button
                            type="button"
                            className="h-8 w-16 rounded border border-slate-200 text-xs dark:border-slate-700"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => requirePremium(() => imageInputRef.current?.click())}
                          >
                            Upload
                          </button>
                          <button type="button" className="h-8 w-12 rounded border border-slate-200 text-xs dark:border-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand("undo")}>Undo</button>
                          <button type="button" className="h-8 w-12 rounded border border-slate-200 text-xs dark:border-slate-700" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand("redo")}>Redo</button>
                        </div>
                      </div>
                      {showLinkPanel && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                          <Input
                            value={linkUrlInput}
                            onChange={(event) => setLinkUrlInput(event.target.value)}
                            placeholder={t("notesLinkUrl")}
                            className="h-8 w-64"
                            onFocus={saveSelection}
                          />
                          <Button size="sm" variant="outline" onClick={handleCreateLink}>
                            {t("notesAddLink")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setShowLinkPanel(false)}>
                            {t("cancel")}
                          </Button>
                        </div>
                      )}
                      {showTablePanel && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                          <Input
                            value={tableRows}
                            onChange={(event) => setTableRows(event.target.value)}
                            placeholder={t("notesTableRows")}
                            className="h-8 w-24"
                          />
                          <Input
                            value={tableCols}
                            onChange={(event) => setTableCols(event.target.value)}
                            placeholder={t("notesTableCols")}
                            className="h-8 w-24"
                          />
                          <Button size="sm" variant="outline" onClick={handleInsertTable}>
                            {t("notesAdd")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setShowTablePanel(false)}>
                            {t("cancel")}
                          </Button>
                        </div>
                      )}
                      {showImagePanel && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                          <Input
                            value={imageUrlInput}
                            onChange={(event) => setImageUrlInput(event.target.value)}
                            placeholder={t("notesImageUrl")}
                            className="h-8 w-64"
                          />
                          <Button size="sm" variant="outline" onClick={handleInsertImageUrl}>
                            {t("notesAdd")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setShowImagePanel(false)}>
                            {t("cancel")}
                          </Button>
                        </div>
                      )}
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleInsertImageFile}
                      />

                      <div className="relative min-h-[520px]">
                        <div
                          ref={editorRef}
                          contentEditable
                          suppressContentEditableWarning
                          className="min-h-[520px] max-w-[860px] mx-auto text-base leading-7 bg-transparent border-0 rounded-none px-0 pl-6 focus:outline-none whitespace-pre-wrap break-words"
                          onFocus={ensureEditorSelection}
                          onBlur={saveSelection}
                          onKeyUp={saveSelection}
                          onMouseDown={saveSelection}
                          onMouseUp={saveSelection}
                          onInput={(event) => {
                            const html = event.currentTarget.innerHTML;
                            lastHtmlRef.current = html;
                            updateNote(selectedNote.id, { body: html });
                            saveSelection();
                          }}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
