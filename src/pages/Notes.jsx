import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/components/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignRight,
  Link2, ImagePlus, Table2, Highlighter,
  Pin, PinOff, Trash2, Plus, Search, FolderOpen, FileText,
  ChevronRight, MoreHorizontal, Check, X, Download, Upload,
  Clock, BookOpen, Copy, Clipboard, Undo2, Redo2, Bell
} from "lucide-react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapUnderline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { TextAlign } from '@tiptap/extension-text-align';
import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
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
import { fromLocalDateTimeInput, requestNotificationPermission, toLocalDateTimeInput } from "@/lib/reminders";

const userCol = (userId, name) => collection(db, "users", String(userId), name);

const TITLE_MAX = 100;

const clamp = (v, max = TITLE_MAX) => String(v || "").slice(0, max);

const toIso = (v) => {
  if (!v) return "";
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  return String(v);
};

const stripHtml = (v) =>
  String(v || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return "przed chwilą";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min temu`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} godz. temu`;
    return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
};

const wordCount = (html) => {
  const text = stripHtml(html);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
};

const TEMPLATES = [
  {
    id: "premarket",
    label: "Plan Pre-Market",
    icon: "📋",
    body: `<h2>Plan Pre-Market – ${new Date().toLocaleDateString("pl-PL")}</h2>
<h3>Nastawienie rynku</h3>
<p>Trend ogólny: <strong>Bycze / Niedźwiedzie / Neutralne</strong></p>
<p>Kluczowe poziomy: </p>
<h3>Instrumenty na obserwacji</h3>
<ul><li></li><li></li><li></li></ul>
<h3>Zasady na dziś</h3>
<ul><li>Max strata dzienna: </li><li>Max liczba transakcji: </li><li>Nie tradować gdy: </li></ul>
<h3>Cel na dziś</h3>
<p></p>`
  },
  {
    id: "trade-recap",
    label: "Podsumowanie transakcji",
    icon: "📊",
    body: `<h2>Podsumowanie transakcji</h2>
<p><strong>Instrument:</strong> &nbsp;&nbsp;<strong>Data:</strong> ${new Date().toLocaleDateString("pl-PL")}</p>
<p><strong>Wejście:</strong> &nbsp;&nbsp;<strong>Wyjście:</strong> &nbsp;&nbsp;<strong>Wynik:</strong> </p>
<h3>Co zrobiłem dobrze</h3>
<ul><li></li></ul>
<h3>Co poszło nie tak</h3>
<ul><li></li></ul>
<h3>Lekcja na przyszłość</h3>
<p></p>
<h3>Emocje podczas transakcji</h3>
<p>Przed: &nbsp;&nbsp; W trakcie: &nbsp;&nbsp; Po: </p>`
  },
  {
    id: "daily-review",
    label: "Dzienny przegląd",
    icon: "🌙",
    body: `<h2>Dzienny przegląd – ${new Date().toLocaleDateString("pl-PL")}</h2>
<p><strong>Wynik dnia:</strong> &nbsp;&nbsp;<strong>Liczba transakcji:</strong> </p>
<h3>Najlepsza transakcja</h3>
<p></p>
<h3>Najgorsza transakcja</h3>
<p></p>
<h3>Emocje i psychologia</h3>
<p>Nastrój: ⭐⭐⭐⭐⭐ &nbsp;&nbsp; Dyscyplina: ⭐⭐⭐⭐⭐</p>
<p>Uwagi: </p>
<h3>Co poprawić jutro</h3>
<ul><li></li></ul>`
  },
  {
    id: "weekly-review",
    label: "Tygodniowy przegląd",
    icon: "📅",
    body: `<h2>Tygodniowy przegląd</h2>
<p><strong>Tydzień:</strong> &nbsp;&nbsp;<strong>Wynik tygodnia:</strong> </p>
<h3>Statystyki</h3>
<p>Win rate: &nbsp;&nbsp; Średni zysk: &nbsp;&nbsp; Średnia strata: </p>
<h3>Powtarzające się błędy</h3>
<ul><li></li></ul>
<h3>Co działało dobrze</h3>
<ul><li></li></ul>
<h3>Cele na przyszły tydzień</h3>
<ul><li></li><li></li></ul>`
  },
];

const buildEmptyNote = (sectionId, notebookId) => ({
  title: "",
  body: "",
  type: "note",
  notebookId,
  sectionId,
  order: Date.now(),
  pinned: false,
  tags: [],
  pinnedToSidebar: false,
  visibilityScope: "all",
  visibleOnPages: [],
  reminderAt: "",
  reminderSentAt: "",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
});

export default function Notes() {
  const { user } = useAuth();
  const location = useLocation();
  const { t } = useLanguage();

  const titleInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const pendingUpdates = useRef(new Map());

  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const defaultNotebook = useMemo(() => ({ id: "default", name: "Notatki" }), []);
  const defaultSection = useMemo(() => ({ id: "general", notebookId: "default", name: "Ogólne" }), []);

  const [notes, setNotes] = useState([]);
  const [notebooks, setNotebooks] = useState([defaultNotebook]);
  const [sections, setSections] = useState([defaultSection]);
  const [selectedNotebookId] = useState("default");
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState({});
  const [savedAt, setSavedAt] = useState(null);

  // Inline folder rename
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const folderInputRef = useRef(null);

  // New folder input
  const [newFolderInput, setNewFolderInput] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  // Tag input for active note
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  // Word count
  const [words, setWords] = useState(0);

  // Tag filter
  const [activeTagFilter, setActiveTagFilter] = useState(null);

  // Firebase listeners
  useEffect(() => {
    if (!user?.id) return;

    const unsub1 = onSnapshot(query(userCol(user.id, "notebooks"), orderBy("createdAt", "asc")), (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toIso(d.data().createdAt) }));
      if (items.length === 0) {
        void setDoc(doc(db, "users", String(user.id), "notebooks", "default"), { name: "Notatki", createdAt: serverTimestamp() }, { merge: true });
        return;
      }
      setNotebooks(items);
    });

    const unsub2 = onSnapshot(query(userCol(user.id, "sections"), orderBy("createdAt", "asc")), (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toIso(d.data().createdAt) }));
      setSections(items.length ? items : []);
      if (items.length && !activeFolderId) {
        const first = items.find((s) => s.notebookId === selectedNotebookId) || items[0];
        setActiveFolderId(first.id);
        setExpandedFolders({ [first.id]: true });
      }
    });

    const unsub3 = onSnapshot(query(userCol(user.id, "notes"), orderBy("order", "asc")), (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, createdAt: toIso(data.createdAt), updatedAt: toIso(data.updatedAt) };
      });
      setNotes(items);
      if (!selectedNoteId && items.length) setSelectedNoteId(items[0].id);
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user?.id]);

  useEffect(() => () => {
    pendingUpdates.current.forEach(clearTimeout);
    pendingUpdates.current.clear();
  }, []);

  // URL param: open specific note
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("noteId");
    if (!id) return;
    const found = notes.find((n) => n.id === id);
    if (!found) return;
    setSelectedNoteId(found.id);
    if (found.sectionId) {
      setActiveFolderId(found.sectionId);
      setExpandedFolders((p) => ({ ...p, [found.sectionId]: true }));
    }
  }, [location.search, notes]);

  const folders = useMemo(
    () => sections.filter((s) => s.notebookId === selectedNotebookId || !s.notebookId),
    [sections, selectedNotebookId]
  );

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes
      .filter((n) => !q || String(n.title || "").toLowerCase().includes(q) || stripHtml(n.body).toLowerCase().includes(q))
      .filter((n) => !activeTagFilter || (n.tags || []).includes(activeTagFilter))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.order || 0) - (b.order || 0));
  }, [notes, searchQuery, activeTagFilter]);

  // All unique tags across notes
  const allTags = useMemo(() => {
    const set = new Set();
    notes.forEach((n) => (n.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [notes]);

  const notesByFolder = useMemo(() => {
    const map = new Map();
    folders.forEach((f) => map.set(f.id, []));
    filteredNotes.forEach((n) => {
      if (!map.has(n.sectionId)) map.set(n.sectionId, []);
      map.get(n.sectionId).push(n);
    });
    return map;
  }, [filteredNotes, folders]);

  const selectedNote = notes.find((n) => n.id === selectedNoteId) || null;

  // Word count sync — must be after selectedNote is defined
  useEffect(() => {
    setWords(wordCount(selectedNote?.body || ""));
  }, [selectedNoteId, selectedNote?.body]);

  // Sync title draft
  useEffect(() => {
    if (!selectedNote) { setTitleDraft(""); return; }
    if (document.activeElement !== titleInputRef.current) setTitleDraft(String(selectedNote.title || ""));
  }, [selectedNoteId, selectedNote?.title]);


  const queueUpdate = useCallback((id, patch) => {
    if (!user?.id) return;
    const key = String(id);
    clearTimeout(pendingUpdates.current.get(key));
    pendingUpdates.current.set(key, setTimeout(async () => {
      try {
        await updateDoc(doc(db, "users", String(user.id), "notes", key), { ...patch, updatedAt: serverTimestamp() });
        setSavedAt(new Date());
      } catch (e) {
        console.error("Note update error:", e);
      }
    }, 3000));
  }, [user?.id]);

  const updateNote = useCallback((id, patch) => {
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, ...patch } : n));
    queueUpdate(id, patch);
  }, [queueUpdate]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TiptapUnderline,
      Placeholder.configure({ placeholder: 'Zacznij pisać...' }),
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'tiptap-link' } }),
      Image.configure({ HTMLAttributes: { class: 'tiptap-image' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: '',
    editable: false,
  });

  // Sync Tiptap content when note changes
  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(selectedNote?.body || '', false);
    editor.setEditable(!!selectedNote);
   
  }, [selectedNoteId, editor]);

  // Attach update handler (fresh closure on every note/updateNote change)
  useEffect(() => {
    if (!editor) return;
    const onUpdate = ({ editor: ed }) => {
      if (!selectedNote) return;
      const html = ed.getHTML();
      updateNote(selectedNote.id, { body: html });
      setWords(wordCount(html));
    };
    editor.on('update', onUpdate);
    return () => editor.off('update', onUpdate);
  }, [editor, selectedNote, updateNote]);

  // Folder actions
  const handleCreateFolder = async () => {
    const name = clamp(newFolderInput.trim(), 60);
    if (!name || !user?.id) return;
    try {
      const ref = await addDoc(userCol(user.id, "sections"), {
        notebookId: selectedNotebookId,
        name,
        createdAt: serverTimestamp()
      });
      setNewFolderInput("");
      setShowNewFolderInput(false);
      setActiveFolderId(ref.id);
      setExpandedFolders((p) => ({ ...p, [ref.id]: true }));
    } catch (e) {
      console.error(e);
      toast.error("Nie udało się utworzyć folderu");
    }
  };

  const handleRenameFolder = async (folder) => {
    if (!user?.id || !folder?.id) return;
    const name = clamp(editingFolderName.trim(), 60);
    if (!name) { setEditingFolderId(null); return; }
    try {
      await updateDoc(doc(db, "users", String(user.id), "sections", String(folder.id)), { name });
      setEditingFolderId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteFolder = async (folder) => {
    if (!user?.id || !folder?.id) return;
    try {
      const next = folders.find((f) => f.id !== folder.id);
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", String(user.id), "sections", String(folder.id)));
      notes.filter((n) => n.sectionId === folder.id).forEach((n) => {
        const ref = doc(db, "users", String(user.id), "notes", String(n.id));
        next ? batch.update(ref, { sectionId: next.id }) : batch.delete(ref);
      });
      await batch.commit();
      if (activeFolderId === folder.id) setActiveFolderId(next?.id || null);
      toast.success("Folder usunięty");
    } catch (e) {
      console.error(e);
      toast.error("Nie udało się usunąć folderu");
    }
  };

  // Note actions
  const handleCreateNote = async (folderId) => {
    if (!user?.id || !folderId) return;
    try {
      const ref = await addDoc(userCol(user.id, "notes"), buildEmptyNote(folderId, selectedNotebookId));
      setActiveFolderId(folderId);
      setSelectedNoteId(ref.id);
      setExpandedFolders((p) => ({ ...p, [folderId]: true }));
      setTimeout(() => titleInputRef.current?.focus(), 50);
    } catch (e) {
      console.error(e);
      toast.error("Nie udało się utworzyć notatki");
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!user?.id || !noteId) return;
    const note = notes.find((n) => n.id === noteId);
    try {
      await deleteDoc(doc(db, "users", String(user.id), "notes", String(noteId)));
      if (selectedNoteId === noteId) {
        const folderNotes = notesByFolder.get(note?.sectionId || activeFolderId) || [];
        setSelectedNoteId(folderNotes.find((n) => n.id !== noteId)?.id || null);
      }
      toast.success("Notatka usunięta", {
        action: { label: "Cofnij", onClick: async () => {
          if (!note) return;
          const { id, ...data } = note;
          await setDoc(doc(db, "users", String(user.id), "notes", String(id)), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        }}
      });
    } catch (e) {
      console.error(e);
      toast.error("Nie udało się usunąć notatki");
    }
  };

  const handleDuplicateNote = async (note) => {
    if (!user?.id || !note) return;
    try {
      const { id, createdAt, updatedAt, ...data } = note;
      const ref = await addDoc(userCol(user.id, "notes"), {
        ...data,
        title: `${data.title || "Bez tytułu"} (kopia)`,
        order: Date.now(),
        pinned: false,
        pinnedToSidebar: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSelectedNoteId(ref.id);
      toast.success("Notatka zduplikowana");
    } catch (e) {
      console.error(e);
      toast.error("Nie udało się zduplikować");
    }
  };

  const handleMoveNote = async (noteId, targetFolderId) => {
    if (!user?.id || !noteId || !targetFolderId) return;
    try {
      await updateDoc(doc(db, "users", String(user.id), "notes", String(noteId)), {
        sectionId: targetFolderId,
        updatedAt: serverTimestamp(),
      });
      setExpandedFolders((p) => ({ ...p, [targetFolderId]: true }));
      toast.success("Przeniesiono do folderu");
    } catch (e) {
      console.error(e);
      toast.error("Nie udało się przenieść");
    }
  };

  const handleInsertTemplate = (template) => {
    if (!selectedNote || !editor) return;
    const current = editor.getHTML();
    const isEmpty = current === '<p></p>' || !current.trim();
    const newBody = isEmpty ? template.body : current + '<br>' + template.body;
    editor.commands.setContent(newBody, false);
    updateNote(selectedNote.id, { body: newBody });
    setWords(wordCount(newBody));
    toast.success(`Wstawiono szablon: ${template.label}`);
  };

  const handleAddTag = () => {
    if (!selectedNote || !tagInput.trim()) return;
    const tag = tagInput.trim().toLowerCase();
    if (selectedNote.tags?.includes(tag)) { setTagInput(""); setShowTagInput(false); return; }
    updateNote(selectedNote.id, { tags: [...(selectedNote.tags || []), tag] });
    setTagInput("");
    setShowTagInput(false);
  };

  const handleRemoveTag = (tag) => {
    if (!selectedNote) return;
    updateNote(selectedNote.id, { tags: (selectedNote.tags || []).filter((t) => t !== tag) });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ notes, notebooks, sections }, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `notes-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleImageUpload = async (file) => {
    if (!file || !user?.id) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) { toast.error('Dozwolone formaty: JPG, PNG, GIF, WEBP'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Plik jest za duży (max 5 MB)'); return; }
    setIsUploadingImage(true);
    try {
      const path = `notes-images/${user.id}/${Date.now()}-${file.name}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      editor?.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (e) {
      console.error(e);
      toast.error('Nie udało się wgrać obrazka');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSetLink = () => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      const href = url.startsWith('http') ? url : `https://${url}`;
      editor.chain().focus().setLink({ href }).run();
    }
    setLinkUrl('');
    setShowLinkInput(false);
  };


  const TAG_COLORS = ["blue", "emerald", "violet", "amber", "rose", "sky", "indigo"];
  const tagColor = (tag) => TAG_COLORS[Math.abs(tag.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % TAG_COLORS.length];
  const tagClass = {
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    emerald: "bg-profit/10 text-profit dark:bg-profit/10 dark:text-profit",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    rose: "bg-loss/10 text-loss dark:bg-loss/10 dark:text-loss",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  };

  return (
    <div className="h-[min(720px,calc(100vh-8rem))] flex flex-col overflow-hidden rounded-md border border-border bg-transparent dashboard-surface">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Notatki</h1>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 animate-pulse">⚠ W budowie — możliwe błędy</span>
          <Badge variant="secondary" className="text-xs">{notes.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5 h-8 text-xs">
            <Download className="h-3.5 w-3.5" />
            Eksport
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1.5 h-8 text-xs">
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file || !user?.id) return;
            const reader = new FileReader();
            reader.onload = async () => {
              try {
                const raw = JSON.parse(String(reader.result || ""));
                const importNotes = Array.isArray(raw?.notes) ? raw.notes : Array.isArray(raw) ? raw : [];
                const importSections = Array.isArray(raw?.sections) ? raw.sections : [];
                const importNotebooks = Array.isArray(raw?.notebooks) ? raw.notebooks : [];

                if (!importNotes.length && !importSections.length) {
                  toast.error("Plik nie zawiera notatek"); return;
                }

                const batch = writeBatch(db);

                importNotebooks.forEach(({ id, ...data }) => {
                  if (!id) return;
                  batch.set(doc(db, "users", String(user.id), "notebooks", String(id)), { ...data, createdAt: serverTimestamp() }, { merge: true });
                });
                importSections.forEach(({ id, ...data }) => {
                  if (!id) return;
                  batch.set(doc(db, "users", String(user.id), "sections", String(id)), { ...data, createdAt: serverTimestamp() }, { merge: true });
                });
                importNotes.forEach(({ id, createdAt: _c, updatedAt: _u, ...data }) => {
                  const ref = id ? doc(db, "users", String(user.id), "notes", String(id)) : doc(userCol(user.id, "notes"));
                  batch.set(ref, { ...data, order: data.order || Date.now(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
                });

                await batch.commit();
                toast.success(`Zaimportowano ${importNotes.length} notatek`);
              } catch (err) {
                console.error(err);
                toast.error("Nieprawidłowy plik JSON");
              }
            };
            reader.readAsText(file);
            e.target.value = "";
          }} />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT SIDEBAR ── */}
        <aside className="w-[260px] shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                className="pl-8 h-8 text-xs bg-muted/30 border-border"
                placeholder="Szukaj notatek..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <div className="px-3 py-2 border-b border-border flex flex-wrap gap-1">
              <button
                className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors", !activeTagFilter ? "bg-primary/15 text-primary" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300")}
                onClick={() => setActiveTagFilter(null)}
              >
                Wszystkie
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors", activeTagFilter === tag ? cn(tagClass[tagColor(tag)]) : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-muted")}
                  onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Folder list */}
          <div className="flex-1 overflow-y-auto py-2">
            {folders.map((folder) => {
              const isActive = folder.id === activeFolderId;
              const isExpanded = expandedFolders[folder.id] ?? isActive;
              const folderNotes = notesByFolder.get(folder.id) || [];
              const isEditing = editingFolderId === folder.id;

              return (
                <div key={folder.id}>
                  {/* Folder header */}
                  <div
                    className={cn(
                      "group flex items-center gap-1 px-2 py-1.5 mx-1 rounded-md cursor-pointer select-none",
                      isActive ? "bg-primary/10" : "hover:bg-muted/50"
                    )}
                    onClick={() => {
                      setActiveFolderId(folder.id);
                      setExpandedFolders((p) => ({ ...p, [folder.id]: !p[folder.id] }));
                    }}
                  >
                    <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform", isExpanded && "rotate-90")} />
                    <FolderOpen className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "text-slate-400")} />

                    {isEditing ? (
                      <input
                        ref={folderInputRef}
                        autoFocus
                        className="flex-1 bg-transparent text-xs font-medium outline-none text-slate-900 dark:text-slate-100 min-w-0"
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(clamp(e.target.value, 60))}
                        onBlur={() => handleRenameFolder(folder)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameFolder(folder);
                          if (e.key === "Escape") setEditingFolderId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className={cn("flex-1 text-xs font-medium truncate", isActive ? "text-primary" : "text-slate-700 dark:text-slate-300")}>
                        {folder.name || "Folder"}
                      </span>
                    )}

                    <span className="text-[10px] text-slate-400 mr-1">{folderNotes.length}</span>

                    {/* Folder actions */}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="p-0.5 rounded hover:bg-muted"
                        title="Nowa notatka"
                        onClick={() => handleCreateNote(folder.id)}
                      >
                        <Plus className="h-3 w-3 text-slate-500" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-0.5 rounded hover:bg-muted">
                            <MoreHorizontal className="h-3 w-3 text-slate-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-36 text-xs">
                          <DropdownMenuItem onClick={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name || ""); }}>
                            Zmień nazwę
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-loss dark:text-loss" onClick={() => handleDeleteFolder(folder)}>
                            Usuń folder
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Notes under folder */}
                  {isExpanded && (
                    <div className="ml-5 mr-1 mt-0.5 space-y-0.5 mb-1">
                      {folderNotes.length === 0 ? (
                        <button
                          className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground rounded hover:bg-muted/40 border border-dashed border-border"
                          onClick={() => handleCreateNote(folder.id)}
                        >
                          + Dodaj notatkę
                        </button>
                      ) : (
                        folderNotes.map((note) => {
                          const isSelected = note.id === selectedNoteId;
                          return (
                            <div
                              key={note.id}
                              className={cn(
                                "group flex items-start gap-1.5 px-2 py-1.5 rounded-md cursor-pointer",
                                isSelected
                                  ? "bg-primary/15"
                                  : "hover:bg-muted/40"
                              )}
                              onClick={() => { setActiveFolderId(folder.id); setSelectedNoteId(note.id); }}
                            >
                              <FileText className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", isSelected ? "text-primary" : "text-slate-400")} />
                              <div className="flex-1 min-w-0">
                                <div className={cn("text-xs font-medium truncate leading-tight", isSelected ? "text-primary" : "text-slate-700 dark:text-slate-300")}>
                                  {note.pinned && <Pin className="inline h-2.5 w-2.5 text-amber-500 mr-1" />}
                                  {note.title || "Bez tytułu"}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                  {stripHtml(note.body).slice(0, 35) || "Pusta notatka"}
                                </div>
                                <div className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">
                                  {fmtDate(note.updatedAt || note.createdAt)}
                                </div>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="p-0.5 rounded hover:bg-muted">
                                      <MoreHorizontal className="h-3 w-3 text-slate-400" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="w-44 text-xs">
                                    <DropdownMenuItem onClick={() => handleDuplicateNote(note)}>
                                      <Copy className="h-3.5 w-3.5 mr-2" />Duplikuj
                                    </DropdownMenuItem>
                                    <DropdownMenuSub>
                                      <DropdownMenuSubTrigger>
                                        <FolderOpen className="h-3.5 w-3.5 mr-2" />Przenieś do
                                      </DropdownMenuSubTrigger>
                                      <DropdownMenuSubContent className="w-40 text-xs">
                                        {folders.filter((f) => f.id !== note.sectionId).map((f) => (
                                          <DropdownMenuItem key={f.id} onClick={() => handleMoveNote(note.id, f.id)}>
                                            <FolderOpen className="h-3.5 w-3.5 mr-2 text-muted-foreground" />  
                                            {f.name}
                                          </DropdownMenuItem>
                                        ))}
                                        {folders.filter((f) => f.id !== note.sectionId).length === 0 && (
                                          <DropdownMenuItem disabled>Brak innych folderów</DropdownMenuItem>
                                        )}
                                      </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-loss dark:text-loss" onClick={() => handleDeleteNote(note.id)}>
                                      <Trash2 className="h-3.5 w-3.5 mr-2" />Usuń
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* New folder */}
            <div className="px-2 mt-2">
              {showNewFolderInput ? (
                <div className="flex gap-1">
                  <Input
                    autoFocus
                    className="h-7 text-xs"
                    placeholder="Nazwa folderu..."
                    value={newFolderInput}
                    maxLength={60}
                    onChange={(e) => setNewFolderInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateFolder();
                      if (e.key === "Escape") { setShowNewFolderInput(false); setNewFolderInput(""); }
                    }}
                  />
                  <Button size="icon" className="h-7 w-7 shrink-0" onClick={handleCreateFolder}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={() => { setShowNewFolderInput(false); setNewFolderInput(""); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <button
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground rounded-md hover:bg-muted/40 transition-colors"
                  onClick={() => setShowNewFolderInput(true)}
                >
                  <Plus className="h-3 w-3" />
                  Nowy folder
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* ── EDITOR PANEL ── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          {!selectedNote ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-medium text-slate-700 dark:text-slate-300 mb-1">Wybierz notatkę</h3>
              <p className="text-sm text-slate-400 max-w-xs">
                Kliknij notatkę z listy po lewej lub utwórz nową w wybranym folderze.
              </p>
              {activeFolderId && (
                <Button className="mt-4 gap-2" size="sm" onClick={() => handleCreateNote(activeFolderId)}>
                  <Plus className="h-4 w-4" />
                  Nowa notatka
                </Button>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Note header */}
              <div className="px-6 pt-5 pb-3 border-b border-border shrink-0">
                {/* Title */}
                <input
                  ref={titleInputRef}
                  className="w-full bg-transparent text-2xl font-bold text-foreground placeholder:text-muted-foreground outline-none mb-3"
                  placeholder="Tytuł notatki..."
                  value={titleDraft}
                  maxLength={TITLE_MAX}
                  onChange={(e) => {
                    const v = clamp(e.target.value);
                    setTitleDraft(v);
                    updateNote(selectedNote.id, { title: v });
                  }}
                />

                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Bell className="h-3.5 w-3.5" />
                    {t("notesReminder") || "Przypomnienie"}
                    <input
                      type="datetime-local"
                      className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                      value={toLocalDateTimeInput(selectedNote.reminderAt)}
                      onChange={async (e) => {
                        const reminderAt = fromLocalDateTimeInput(e.target.value);
                        if (reminderAt) {
                          const permission = await requestNotificationPermission();
                          if (permission !== "granted") {
                            toast.info(t("notesReminderPermission"));
                          } else {
                            toast.success(t("notesReminderSet"));
                          }
                        }
                        updateNote(selectedNote.id, { reminderAt, reminderSentAt: "" });
                      }}
                    />
                  </label>
                </div>

                {/* Tags row */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {(selectedNote.tags || []).map((tag) => (
                    <span
                      key={tag}
                      className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer", tagClass[tagColor(tag)])}
                      onClick={() => handleRemoveTag(tag)}
                      title="Kliknij aby usunąć"
                    >
                      {tag}
                      <X className="h-2.5 w-2.5" />
                    </span>
                  ))}
                  {showTagInput ? (
                    <div className="flex items-center gap-1">
                      <Input
                        autoFocus
                        className="h-6 w-24 text-xs px-2"
                        placeholder="tag..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value.toLowerCase().replace(/\s/g, ""))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddTag();
                          if (e.key === "Escape") { setShowTagInput(false); setTagInput(""); }
                        }}
                        onBlur={handleAddTag}
                      />
                    </div>
                  ) : (
                    <button
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-muted-foreground border border-dashed border-border hover:border-primary hover:text-primary transition-colors"
                      onClick={() => setShowTagInput(true)}
                    >
                      <Plus className="h-2.5 w-2.5" />
                      Dodaj tag
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-3">
                    <span className="text-xs text-slate-400">{words} {words === 1 ? "słowo" : words < 5 ? "słowa" : "słów"}</span>
                    {savedAt && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="h-3 w-3" />
                        Zapisano {savedAt.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    <button
                      className={cn("p-1.5 rounded-md transition-colors", selectedNote.pinnedToSidebar ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : "text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20")}
                      title={selectedNote.pinnedToSidebar ? "Odepnij z panelu bocznego" : "Przypnij do panelu bocznego"}
                      onClick={() => updateNote(selectedNote.id, { pinned: !selectedNote.pinnedToSidebar, pinnedToSidebar: !selectedNote.pinnedToSidebar, visibilityScope: "all", visibleOnPages: [] })}
                    >
                      {selectedNote.pinnedToSidebar ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </button>
                    <button
                      className="p-1.5 rounded-md text-slate-400 hover:text-loss hover:bg-loss/10 dark:hover:bg-red-900/20 transition-colors"
                      title="Usuń notatkę"
                      onClick={() => handleDeleteNote(selectedNote.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-0.5 bg-muted/30 rounded-lg p-1 border border-border">
                  {/* Format text */}
                  {[
                    { icon: Bold, title: "Pogrubienie (Ctrl+B)", action: () => editor?.chain().focus().toggleBold().run(), isActive: editor?.isActive('bold') },
                    { icon: Italic, title: "Kursywa (Ctrl+I)", action: () => editor?.chain().focus().toggleItalic().run(), isActive: editor?.isActive('italic') },
                    { icon: Underline, title: "Podkreślenie (Ctrl+U)", action: () => editor?.chain().focus().toggleUnderline().run(), isActive: editor?.isActive('underline') },
                    { icon: Strikethrough, title: "Przekreślenie", action: () => editor?.chain().focus().toggleStrike().run(), isActive: editor?.isActive('strike') },
                  ].map((item) => (
                    <button key={item.title} type="button" title={item.title}
                      className={cn("p-1.5 rounded transition-colors", item.isActive ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                      onMouseDown={(e) => e.preventDefault()} onClick={item.action}>
                      <item.icon className="h-3.5 w-3.5" />
                    </button>
                  ))}

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Headings */}
                  {[
                    { icon: Heading1, title: "Nagłówek 1", action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), isActive: editor?.isActive('heading', { level: 1 }) },
                    { icon: Heading2, title: "Nagłówek 2", action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), isActive: editor?.isActive('heading', { level: 2 }) },
                    { icon: Heading3, title: "Nagłówek 3", action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), isActive: editor?.isActive('heading', { level: 3 }) },
                  ].map((item) => (
                    <button key={item.title} type="button" title={item.title}
                      className={cn("p-1.5 rounded transition-colors", item.isActive ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                      onMouseDown={(e) => e.preventDefault()} onClick={item.action}>
                      <item.icon className="h-3.5 w-3.5" />
                    </button>
                  ))}

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Lists + Quote */}
                  {[
                    { icon: List, title: "Lista punktowana", action: () => editor?.chain().focus().toggleBulletList().run(), isActive: editor?.isActive('bulletList') },
                    { icon: ListOrdered, title: "Lista numerowana", action: () => editor?.chain().focus().toggleOrderedList().run(), isActive: editor?.isActive('orderedList') },
                    { icon: Quote, title: "Cytat", action: () => editor?.chain().focus().toggleBlockquote().run(), isActive: editor?.isActive('blockquote') },
                  ].map((item) => (
                    <button key={item.title} type="button" title={item.title}
                      className={cn("p-1.5 rounded transition-colors", item.isActive ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                      onMouseDown={(e) => e.preventDefault()} onClick={item.action}>
                      <item.icon className="h-3.5 w-3.5" />
                    </button>
                  ))}

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Text align */}
                  {[
                    { icon: AlignLeft, title: "Wyrównaj do lewej", action: () => editor?.chain().focus().setTextAlign('left').run(), isActive: editor?.isActive({ textAlign: 'left' }) },
                    { icon: AlignCenter, title: "Wyśrodkuj", action: () => editor?.chain().focus().setTextAlign('center').run(), isActive: editor?.isActive({ textAlign: 'center' }) },
                    { icon: AlignRight, title: "Wyrównaj do prawej", action: () => editor?.chain().focus().setTextAlign('right').run(), isActive: editor?.isActive({ textAlign: 'right' }) },
                  ].map((item) => (
                    <button key={item.title} type="button" title={item.title}
                      className={cn("p-1.5 rounded transition-colors", item.isActive ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                      onMouseDown={(e) => e.preventDefault()} onClick={item.action}>
                      <item.icon className="h-3.5 w-3.5" />
                    </button>
                  ))}

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Highlight color picker */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" title="Zaznacz kolorem"
                        className={cn("p-1.5 rounded transition-colors", editor?.isActive('highlight') ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                        onMouseDown={(e) => e.preventDefault()}>
                        <Highlighter className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="p-2 flex gap-1.5" style={{ minWidth: 0 }}>
                      {[
                        { color: '#fef08a', label: 'Żółty' },
                        { color: '#bbf7d0', label: 'Zielony' },
                        { color: '#fecaca', label: 'Czerwony' },
                        { color: '#bfdbfe', label: 'Niebieski' },
                      ].map(({ color, label }) => (
                        <button key={color} title={label} onMouseDown={(e) => e.preventDefault()}
                          onClick={() => editor?.chain().focus().toggleHighlight({ color }).run()}
                          className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }} />
                      ))}
                      <button title="Usuń highlight" onMouseDown={(e) => e.preventDefault()}
                        onClick={() => editor?.chain().focus().unsetHighlight().run()}
                        className="w-6 h-6 rounded border border-border bg-background hover:opacity-90 transition-opacity flex items-center justify-center">
                        <X className="h-3 w-3 text-slate-500" />
                      </button>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Link */}
                  <div className="relative flex items-center">
                    <button type="button" title="Wstaw link"
                      className={cn("p-1.5 rounded transition-colors", editor?.isActive('link') ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setLinkUrl(editor?.getAttributes('link').href || '');
                        setShowLinkInput((v) => !v);
                      }}>
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                    {showLinkInput && (
                      <div className="absolute top-8 left-0 z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-2 flex gap-1 min-w-[220px]">
                        <input
                          autoFocus
                          className="flex-1 text-xs px-2 py-1 rounded border border-border bg-transparent outline-none text-foreground"
                          placeholder="https://..."
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSetLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
                        />
                        <button className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90" onClick={handleSetLink}>OK</button>
                        <button className="px-2 py-1 text-xs rounded hover:bg-muted" onClick={() => setShowLinkInput(false)}><X className="h-3 w-3" /></button>
                      </div>
                    )}
                  </div>

                  {/* Image upload */}
                  <button type="button" title={isUploadingImage ? "Wgrywanie..." : "Wstaw obrazek"}
                    disabled={isUploadingImage}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => imageInputRef.current?.click()}>
                    <ImagePlus className="h-3.5 w-3.5" />
                  </button>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ''; }} />

                  {/* Table */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" title="Tabela"
                        className={cn("p-1.5 rounded transition-colors", editor?.isActive('table') ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                        onMouseDown={(e) => e.preventDefault()}>
                        <Table2 className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-44 text-xs">
                      <DropdownMenuItem onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                        Wstaw tabelę (3×3)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => editor?.chain().focus().addRowBefore().run()}>Dodaj wiersz przed</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => editor?.chain().focus().addRowAfter().run()}>Dodaj wiersz po</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => editor?.chain().focus().deleteRow().run()}>Usuń wiersz</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => editor?.chain().focus().addColumnBefore().run()}>Dodaj kolumnę przed</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => editor?.chain().focus().addColumnAfter().run()}>Dodaj kolumnę po</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => editor?.chain().focus().deleteColumn().run()}>Usuń kolumnę</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-loss dark:text-loss" onClick={() => editor?.chain().focus().deleteTable().run()}>Usuń tabelę</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Undo / Redo */}
                  {[
                    { icon: Undo2, title: "Cofnij (Ctrl+Z)", action: () => editor?.chain().focus().undo().run() },
                    { icon: Redo2, title: "Ponów (Ctrl+Y)", action: () => editor?.chain().focus().redo().run() },
                  ].map((item) => (
                    <button key={item.title} type="button" title={item.title}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      onMouseDown={(e) => e.preventDefault()} onClick={item.action}>
                      <item.icon className="h-3.5 w-3.5" />
                    </button>
                  ))}

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Templates dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" title="Wstaw szablon"
                        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-[11px] font-medium">
                        <Clipboard className="h-3.5 w-3.5" />
                        Szablon
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-52">
                      {TEMPLATES.map((tpl) => (
                        <DropdownMenuItem key={tpl.id} onClick={() => handleInsertTemplate(tpl)} className="gap-2">
                          <span>{tpl.icon}</span>
                          <span className="text-xs">{tpl.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Editor body */}
              <div className="flex-1 overflow-y-auto">
                <EditorContent editor={editor} className="tiptap-notes-editor" />
              </div>
            </div>
          )}
        </main>
      </div>

      <style>{`
        .tiptap-notes-editor { display: flex; flex: 1; flex-direction: column; }
        .tiptap-notes-editor .ProseMirror {
          flex: 1;
          min-height: calc(100vh - 20rem);
          padding: 1.25rem 1.5rem;
          font-size: 15px;
          line-height: 1.75;
          outline: none;
        }
        .tiptap-notes-editor .ProseMirror h1 { font-size: 1.5rem; font-weight: 700; margin: 1rem 0 0.5rem; }
        .tiptap-notes-editor .ProseMirror h2 { font-size: 1.25rem; font-weight: 600; margin: 0.75rem 0 0.5rem; }
        .tiptap-notes-editor .ProseMirror h3 { font-size: 1.1rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
        .tiptap-notes-editor .ProseMirror p { margin: 0.25rem 0; }
        .tiptap-notes-editor .ProseMirror ul { list-style: disc; padding-left: 1.25rem; margin: 0.5rem 0; }
        .tiptap-notes-editor .ProseMirror ol { list-style: decimal; padding-left: 1.25rem; margin: 0.5rem 0; }
        .tiptap-notes-editor .ProseMirror blockquote {
          border-left: 4px solid hsl(var(--primary));
          padding-left: 1rem;
          font-style: italic;
          color: #64748b;
          margin: 0.5rem 0;
        }
        .dark .tiptap-notes-editor .ProseMirror blockquote { color: hsl(var(--muted-foreground)); }
        .tiptap-notes-editor .ProseMirror strong { font-weight: 700; }
        .tiptap-notes-editor .ProseMirror em { font-style: italic; }
        .tiptap-notes-editor .ProseMirror u { text-decoration: underline; }
        .tiptap-notes-editor .ProseMirror s { text-decoration: line-through; }
        .tiptap-notes-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        /* Links */
        .tiptap-notes-editor .ProseMirror .tiptap-link {
          color: hsl(var(--primary));
          text-decoration: underline;
          cursor: pointer;
        }
        .dark .tiptap-notes-editor .ProseMirror .tiptap-link { color: hsl(var(--primary)); }
        /* Images */
        .tiptap-notes-editor .ProseMirror .tiptap-image {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 0.75rem 0;
          display: block;
        }
        .tiptap-notes-editor .ProseMirror img.tiptap-image.ProseMirror-selectednode {
          outline: 2px solid hsl(var(--primary));
        }
        /* Tables */
        .tiptap-notes-editor .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.75rem 0;
          font-size: 0.875rem;
          overflow: hidden;
        }
        .tiptap-notes-editor .ProseMirror table td,
        .tiptap-notes-editor .ProseMirror table th {
          border: 1px solid hsl(var(--border));
          padding: 0.4rem 0.75rem;
          min-width: 60px;
          vertical-align: top;
          word-break: break-word;
          overflow-wrap: break-word;
          white-space: normal;
          position: relative;
        }
        .tiptap-notes-editor .ProseMirror .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          background-color: hsl(var(--primary));
          cursor: col-resize;
          pointer-events: none;
        }
        .tiptap-notes-editor .ProseMirror.resize-cursor {
          cursor: col-resize;
        }
        .tiptap-notes-editor .ProseMirror table th {
          background: hsl(var(--muted) / 0.45);
          font-weight: 600;
          text-align: left;
        }
        .tiptap-notes-editor .ProseMirror table .selectedCell { background: hsl(var(--primary) / 0.12); }
      `}</style>
    </div>
  );
}
