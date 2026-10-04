import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { emptyDayPlan, planDocId, todayIso } from "@/lib/dayPlanModel";

const plansCol = (userId) => collection(db, "users", String(userId), "day_plans");
const templatesCol = (userId) => collection(db, "users", String(userId), "day_plan_templates");

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined) continue;
      out[key] = stripUndefined(nested);
    }
    return out;
  }
  return value;
}

export async function getDayPlan(userId, accountId, date) {
  if (!userId || !accountId || !date) return null;
  const id = planDocId(accountId, date);
  const snap = await getDoc(doc(db, "users", String(userId), "day_plans", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function ensureDayPlan(userId, accountId, date, language = "pl") {
  const existing = await getDayPlan(userId, accountId, date);
  if (existing) return existing;
  const blank = emptyDayPlan({ accountId, date, language });
  return blank;
}

export async function saveDayPlan(userId, plan) {
  if (!userId) throw new Error("Użytkownik nie jest zalogowany");
  const accountId = String(plan?.account_id || "");
  const date = String(plan?.date || todayIso());
  if (!accountId) throw new Error("Wybierz konto");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Nieprawidłowa data");

  const id = planDocId(accountId, date);
  const refDoc = doc(db, "users", String(userId), "day_plans", id);
  const payload = stripUndefined({
    ...plan,
    id,
    account_id: accountId,
    date,
    updatedAt: serverTimestamp(),
  });
  delete payload.createdAt;

  const existing = await getDoc(refDoc);
  if (existing.exists()) {
    await updateDoc(refDoc, payload);
  } else {
    await setDoc(refDoc, { ...payload, createdAt: serverTimestamp() });
  }
  const snap = await getDoc(refDoc);
  return { id: snap.id, ...snap.data() };
}

export async function deleteDayPlan(userId, accountId, date) {
  if (!userId || !accountId || !date) return false;
  const id = planDocId(accountId, date);
  await deleteDoc(doc(db, "users", String(userId), "day_plans", id));
  return true;
}

export async function listDayPlans(userId, { accountId, status, from, to } = {}) {
  if (!userId) return [];
  let rows = [];
  try {
    const snap = await getDocs(query(plansCol(userId), orderBy("date", "desc")));
    rows = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch {
    const snap = await getDocs(plansCol(userId));
    rows = snap.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }
  if (accountId) rows = rows.filter((row) => String(row.account_id) === String(accountId));
  if (status) rows = rows.filter((row) => row.status === status);
  if (from) rows = rows.filter((row) => String(row.date) >= String(from));
  if (to) rows = rows.filter((row) => String(row.date) <= String(to));
  return rows;
}

export async function listDayPlanTemplates(userId) {
  if (!userId) return [];
  try {
    const snap = await getDocs(query(templatesCol(userId), orderBy("updatedAt", "desc")));
    return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch {
    const snap = await getDocs(templatesCol(userId));
    return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  }
}

export async function createDayPlanTemplate(userId, templateData) {
  if (!userId) throw new Error("Użytkownik nie jest zalogowany");
  const payload = stripUndefined({
    ...templateData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const refDoc = await addDoc(templatesCol(userId), payload);
  return { id: refDoc.id, ...templateData };
}

export async function updateDayPlanTemplate(userId, templateId, templateData) {
  if (!userId) throw new Error("Użytkownik nie jest zalogowany");
  const refDoc = doc(db, "users", String(userId), "day_plan_templates", String(templateId));
  await updateDoc(refDoc, stripUndefined({ ...templateData, updatedAt: serverTimestamp() }));
  const snap = await getDoc(refDoc);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function deleteDayPlanTemplate(userId, templateId) {
  if (!userId) throw new Error("Użytkownik nie jest zalogowany");
  await deleteDoc(doc(db, "users", String(userId), "day_plan_templates", String(templateId)));
  return true;
}

export async function duplicateDayPlanTemplate(userId, template) {
  const copy = {
    ...template,
    name: `${template.name || "Szablon"} (kopia)`,
  };
  delete copy.id;
  delete copy.createdAt;
  delete copy.updatedAt;
  return createDayPlanTemplate(userId, copy);
}

export const HEADER_ACCOUNT_STORAGE_KEY = (userId) => `mt_sync_account_${userId || "guest"}`;
