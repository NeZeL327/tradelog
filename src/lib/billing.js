const baseUrl = import.meta.env.VITE_FUNCTIONS_BASE_URL;

const ensureBaseUrl = () => {
  if (!baseUrl) {
    throw new Error("VITE_FUNCTIONS_BASE_URL is not configured");
  }
  return baseUrl.replace(/\/$/, "");
};

export async function createCheckoutSession({ priceId, successUrl, cancelUrl, customerEmail, userId }) {
  const url = `${ensureBaseUrl()}/createCheckoutSession`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priceId, successUrl, cancelUrl, customerEmail, userId })
  });
  if (!response.ok) {
    throw new Error("Unable to create checkout session");
  }
  return response.json();
}

export async function createPortalSession({ returnUrl, userId }) {
  const url = `${ensureBaseUrl()}/createPortalSession`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnUrl, userId })
  });
  if (!response.ok) {
    throw new Error("Unable to create portal session");
  }
  return response.json();
}
