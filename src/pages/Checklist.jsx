import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/components/LanguageProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CheckSquare, ChevronDown, Pin, Plus, Trash2 } from "lucide-react";

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const createChecklistItem = (text = "") => ({
  id: createId(),
  text,
  done: false,
  dueDate: "",
  priority: "medium",
  note: ""
});

export default function Checklist() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [items, setItems] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [expandedCards, setExpandedCards] = useState({});
  const [draftByCard, setDraftByCard] = useState({});

  useEffect(() => {
    if (!user?.id) {
      setItems([]);
      return undefined;
    }

    const notesRef = collection(db, "users", String(user.id), "notes");
    const unsubscribe = onSnapshot(query(notesRef, orderBy("order", "asc")), (snapshot) => {
      const next = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .filter((note) => note.type === "checklist")
        .sort((a, b) => (b.order || 0) - (a.order || 0));

      setItems(next);
    });

    return () => unsubscribe();
  }, [user?.id]);

  const totalTasks = useMemo(
    () => items.reduce((acc, note) => acc + (Array.isArray(note.checklist) ? note.checklist.length : 0), 0),
    [items]
  );

  const completedTasks = useMemo(
    () =>
      items.reduce(
        (acc, note) =>
          acc +
          (Array.isArray(note.checklist) ? note.checklist.filter((task) => Boolean(task.done)).length : 0),
        0
      ),
    [items]
  );

  const createCard = async () => {
    if (!user?.id) return;
    const title = newTitle.trim() || t("notesNewChecklist") || "Nowa checklista";

    try {
      const refDoc = await addDoc(collection(db, "users", String(user.id), "notes"), {
        title,
        body: "",
        checklist: [],
        type: "checklist",
        notebookId: "default",
        sectionId: "general",
        parentId: null,
        order: Date.now(),
        pinned: false,
        pinnedToSidebar: false,
        visibilityScope: "all",
        visibleOnPages: [],
        tags: [],
        links: [],
        status: "active",
        priority: "medium",
        dueDate: "",
        reminderAt: "",
        reminderSentAt: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setNewTitle("");
      setExpandedCards((prev) => ({ ...prev, [refDoc.id]: true }));
    } catch (error) {
      console.error("Create checklist card error:", error);
      toast.info(t("notesSaveError"));
    }
  };

  const updateCard = async (cardId, patch) => {
    if (!user?.id || !cardId) return;

    setItems((prev) => prev.map((item) => (item.id === cardId ? { ...item, ...patch } : item)));

    try {
      await updateDoc(doc(db, "users", String(user.id), "notes", String(cardId)), {
        ...patch,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Update checklist card error:", error);
      toast.info(t("notesSaveError"));
    }
  };

  const deleteCard = async (cardId) => {
    if (!user?.id || !cardId) return;
    try {
      await deleteDoc(doc(db, "users", String(user.id), "notes", String(cardId)));
    } catch (error) {
      console.error("Delete checklist card error:", error);
      toast.info(t("notesSaveError"));
    }
  };

  const addTask = (cardId) => {
    const text = (draftByCard[cardId] || "").trim();
    if (!text) return;

    const card = items.find((item) => item.id === cardId);
    if (!card) return;

    const nextChecklist = [...(card.checklist || []), createChecklistItem(text)];
    setDraftByCard((prev) => ({ ...prev, [cardId]: "" }));
    void updateCard(cardId, { checklist: nextChecklist });
  };

  const toggleTask = (cardId, taskId, done) => {
    const card = items.find((item) => item.id === cardId);
    if (!card) return;

    const nextChecklist = (card.checklist || []).map((task) =>
      task.id === taskId ? { ...task, done } : task
    );

    void updateCard(cardId, { checklist: nextChecklist });
  };

  const removeTask = (cardId, taskId) => {
    const card = items.find((item) => item.id === cardId);
    if (!card) return;

    const nextChecklist = (card.checklist || []).filter((task) => task.id !== taskId);
    void updateCard(cardId, { checklist: nextChecklist });
  };

  const togglePinCard = (card) => {
    const nextPinned = !Boolean(card.pinnedToSidebar);
    void updateCard(card.id, {
      pinned: nextPinned,
      pinnedToSidebar: nextPinned
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-4 sm:p-6">
      <div className="max-w-none mx-0 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">{t("notesChecklists") || "Checklisty"}</h1>
            <p className="text-slate-600 dark:text-slate-400">Tworz boxy checklist i przypinaj pojedynczo do prawego panelu.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{items.length} box</Badge>
            <Badge variant="secondary">{completedTasks}/{totalTasks} zadan</Badge>
          </div>
        </div>

        <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Nazwa nowego boxa checklisty"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    createCard();
                  }
                }}
              />
              <Button onClick={createCard} className="gap-2">
                <Plus className="h-4 w-4" />
                Dodaj box
              </Button>
            </div>
          </CardContent>
        </Card>

        {items.length === 0 && (
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardContent className="py-12 text-center text-slate-500">
              <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              Brak checklist. Dodaj pierwszy box.
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((card) => {
            const isExpanded = expandedCards[card.id] ?? true;
            const tasks = Array.isArray(card.checklist) ? card.checklist : [];
            const doneCount = tasks.filter((task) => Boolean(task.done)).length;

            return (
              <Card key={card.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input
                        value={card.title || ""}
                        onChange={(event) => void updateCard(card.id, { title: event.target.value })}
                        className="font-semibold"
                        placeholder="Tytul boxa"
                      />
                      <div className="text-xs text-slate-500">{doneCount}/{tasks.length} zadan wykonanych</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant={card.pinnedToSidebar ? "default" : "outline"} onClick={() => togglePinCard(card)}>
                        <Pin className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setExpandedCards((prev) => ({ ...prev, [card.id]: !isExpanded }))}>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", !isExpanded && "-rotate-90")} />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => deleteCard(card.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={draftByCard[card.id] || ""}
                        onChange={(event) => setDraftByCard((prev) => ({ ...prev, [card.id]: event.target.value }))}
                        placeholder="Dodaj punkt checklisty"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            addTask(card.id);
                          }
                        }}
                      />
                      <Button size="sm" onClick={() => addTask(card.id)}>Dodaj</Button>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-auto">
                      {tasks.length === 0 && <div className="text-sm text-slate-500">Brak punktow.</div>}
                      {tasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={Boolean(task.done)}
                            onChange={(event) => toggleTask(card.id, task.id, event.target.checked)}
                          />
                          <Input
                            value={task.text || ""}
                            onChange={(event) => {
                              const nextChecklist = tasks.map((item) =>
                                item.id === task.id ? { ...item, text: event.target.value } : item
                              );
                              void updateCard(card.id, { checklist: nextChecklist });
                            }}
                            className={cn(task.done && "line-through opacity-70")}
                          />
                          <Button size="icon" variant="ghost" onClick={() => removeTask(card.id, task.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
