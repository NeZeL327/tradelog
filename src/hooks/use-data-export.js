import { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

const USER_COLLECTIONS = [
  "trades",
  "accounts",
  "strategies",
  "goals",
  "notes",
  "notebooks",
  "sections",
  "trips",
  "expenses",
];

const serializeDoc = (doc) => {
  const data = {};
  for (const [key, val] of Object.entries(doc)) {
    if (val && typeof val.toDate === "function") {
      data[key] = val.toDate().toISOString();
    } else {
      data[key] = val;
    }
  }
  return data;
};

export function useDataExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportAllData = async (userId) => {
    if (!userId) { toast.error("Brak zalogowanego użytkownika"); return; }

    setIsExporting(true);
    try {
      const backup = {
        exportedAt: new Date().toISOString(),
        userId: String(userId),
        version: "1.0",
        collections: {},
      };

      await Promise.all(
        USER_COLLECTIONS.map(async (name) => {
          try {
            const snap = await getDocs(collection(db, "users", String(userId), name));
            backup.collections[name] = snap.docs.map((d) => ({
              id: d.id,
              ...serializeDoc(d.data()),
            }));
          } catch {
            backup.collections[name] = [];
          }
        })
      );

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), {
        href: url,
        download: `aikeeptrade-backup-${new Date().toISOString().slice(0, 10)}.json`,
      });
      a.click();
      URL.revokeObjectURL(url);

      const totalRecords = Object.values(backup.collections).reduce((sum, arr) => sum + arr.length, 0);
      toast.success(`Pobrano kopię zapasową (${totalRecords} rekordów)`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Nie udało się pobrać kopii zapasowej");
    } finally {
      setIsExporting(false);
    }
  };

  return { exportAllData, isExporting };
}
