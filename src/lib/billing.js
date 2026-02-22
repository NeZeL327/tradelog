import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

const baseUrl = import.meta.env.VITE_FUNCTIONS_BASE_URL;

const ensureBaseUrl = () => {
  if (!baseUrl) {
    throw new Error("VITE_FUNCTIONS_BASE_URL is not configured");
  }
  return baseUrl.replace(/\/$/, "");
};

export async function createCheckoutSession({ priceId, successUrl, cancelUrl, customerEmail, userId }) {
  const createCheckoutSessionFn = httpsCallable(functions, "createCheckoutSession");
  const response = await createCheckoutSessionFn({ priceId, successUrl, cancelUrl, customerEmail, userId });
  return response.data;
}

export async function createPortalSession({ returnUrl, userId }) {
  const createPortalSessionFn = httpsCallable(functions, "createPortalSession");
  const response = await createPortalSessionFn({ returnUrl, userId });
  return response.data;
}

export async function syncCheckoutSession({ sessionId, userId }) {
  const syncCheckoutSessionFn = httpsCallable(functions, "syncCheckoutSession");
  const response = await syncCheckoutSessionFn({ sessionId, userId });
  return response.data;
}

export async function cancelSubscription({ userId }) {
  const cancelSubscriptionFn = httpsCallable(functions, "cancelSubscription");
  const response = await cancelSubscriptionFn({ userId });
  return response.data;
}
