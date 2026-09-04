import { useEffect, useRef } from "react";
import { collection, onSnapshot, query, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/components/LanguageProvider";
import { isReminderDue, showReminderNotification } from "@/lib/reminders";

export default function ReminderWatcher() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const sentRef = useRef(new Set());

  useEffect(() => {
    if (!user?.id) return undefined;

    const fireDue = async (notes) => {
      for (const note of notes) {
        if (!isReminderDue(note) || sentRef.current.has(note.id)) continue;
        sentRef.current.add(note.id);
        const title = note.title || t("notesReminder") || "Przypomnienie";
        const body = t("notesReminderSent") || "Przypomnienie wysłane";
        showReminderNotification(title, body);
        toast.info(title, { description: body });
        try {
          await updateDoc(doc(db, "users", String(user.id), "notes", String(note.id)), {
            reminderSentAt: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          console.error("Reminder mark sent error:", err);
          sentRef.current.delete(note.id);
        }
      }
    };

    const notesQuery = query(collection(db, "users", String(user.id), "notes"));
    const unsubscribe = onSnapshot(notesQuery, (snapshot) => {
      const notes = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      void fireDue(notes);
    });

    return () => unsubscribe();
  }, [user?.id, t]);

  return null;
}
