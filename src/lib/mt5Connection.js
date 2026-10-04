import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export async function connectMt5Account({ accountId, login, server, password }) {
  const call = httpsCallable(functions, "connectMt5", { timeout: 180000 });
  const result = await call({ accountId, login, server, password });
  return result.data;
}
