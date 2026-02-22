import { auth } from "@/lib/firebase";

const baseUrl = import.meta.env.VITE_FUNCTIONS_BASE_URL;

const ensureBaseUrl = () => {
  if (!baseUrl) {
    throw new Error("VITE_FUNCTIONS_BASE_URL is not configured");
  }
  return baseUrl.replace(/\/$/, "");
};

const getAuthHeaders = async () => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const idToken = await currentUser.getIdToken();
      return { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` };
    } catch (err) {
      console.warn("Failed to retrieve auth token:", err?.message);
      // fall through to unauthenticated headers
    }
  }
  return { "Content-Type": "application/json" };
};

export async function createCheckoutSession({ priceId, successUrl, cancelUrl, customerEmail, userId, trialDays }) {
  const url = `${ensureBaseUrl()}/createCheckoutSession`;
  const headers = await getAuthHeaders();
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ priceId, successUrl, cancelUrl, customerEmail, userId, trialDays })
  });
  if (!response.ok) {
    throw new Error("Unable to create checkout session");
  }
  return response.json();
}

export async function createPortalSession({ returnUrl, userId }) {
  const url = `${ensureBaseUrl()}/createPortalSession`;
  const headers = await getAuthHeaders();
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ returnUrl, userId })
  });
  if (!response.ok) {
    throw new Error("Unable to create portal session");
  }
  return response.json();
}
