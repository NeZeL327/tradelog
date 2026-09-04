import { loadLocalUserSettings } from "@/lib/userSettings";

const pad = (n) => String(n).padStart(2, "0");

export function toLocalDateTimeInput(iso) {
  if (!iso) return "";
  const d = typeof iso?.toDate === "function" ? iso.toDate() : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalDateTimeInput(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function isNotificationsEnabled() {
  try {
    return loadLocalUserSettings().notifications_enabled !== false;
  } catch {
    return true;
  }
}

export async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function isReminderDue(note, now = Date.now()) {
  if (!note?.reminderAt || note.reminderSentAt) return false;
  const raw = note.reminderAt;
  const at = typeof raw?.toDate === "function" ? raw.toDate().getTime() : new Date(raw).getTime();
  if (Number.isNaN(at)) return false;
  return at <= now;
}

export function showReminderNotification(title, body) {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission !== "granted") return false;
  if (!isNotificationsEnabled()) return false;
  try {
    new Notification(title || "Przypomnienie", {
      body: body || "",
      tag: `aikeeptrade-reminder-${title || "note"}`,
    });
    return true;
  } catch {
    return false;
  }
}
