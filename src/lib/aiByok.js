/**
 * Bring-your-own-key AI — stored ONLY in localStorage (never synced to Firestore).
 * Calls OpenAI-compatible Chat Completions from the browser.
 */

const STORAGE_KEY = "aikeeptrade_ai_byok_v1";

export const AI_PROVIDERS = Object.freeze([
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
  },
]);

export function loadAiByokSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        provider: "openai",
        apiKey: "",
        model: "gpt-4o-mini",
        baseUrl: "",
      };
    }
    const parsed = JSON.parse(raw);
    return {
      provider: parsed.provider || "openai",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: parsed.model || "gpt-4o-mini",
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
    };
  } catch {
    return { provider: "openai", apiKey: "", model: "gpt-4o-mini", baseUrl: "" };
  }
}

export function saveAiByokSettings(partial) {
  const current = loadAiByokSettings();
  const next = {
    provider: partial.provider ?? current.provider,
    apiKey: partial.apiKey ?? current.apiKey,
    model: partial.model ?? current.model,
    baseUrl: partial.baseUrl ?? current.baseUrl,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearAiByokSettings() {
  localStorage.removeItem(STORAGE_KEY);
}

function resolveEndpoint(settings) {
  const custom = String(settings.baseUrl || "").trim().replace(/\/$/, "");
  if (custom) return `${custom}/chat/completions`;
  const provider = AI_PROVIDERS.find((p) => p.id === settings.provider) || AI_PROVIDERS[0];
  return `${provider.baseUrl}/chat/completions`;
}

/**
 * @param {object} safePayload from toAiSafePayload()
 * @param {object} [settings]
 * @returns {Promise<{ text: string, model: string }>}
 */
export async function generateProcessReviewAi(safePayload, settings) {
  const cfg = settings || loadAiByokSettings();
  const key = String(cfg.apiKey || "").trim();
  if (!key) {
    throw new Error("Brak klucza API. Wklej swój klucz (zostaje tylko w tej przeglądarce).");
  }
  if (!safePayload) {
    throw new Error("Brak danych do analizy.");
  }

  const model =
    String(cfg.model || "").trim() ||
    AI_PROVIDERS.find((p) => p.id === cfg.provider)?.defaultModel ||
    "gpt-4o-mini";

  const system = [
    "Jesteś trenerem dyscypliny tradingowej, nie strategiem setupów.",
    "Dostajesz TYLKO zagregowane tagi behawioralne (wejście/błędy/psychologia/sesja) i proste liczby.",
    "NIE odtwarzaj i NIE ujawniaj strategii użytkownika. Nie wymyślaj reguł ICT/SMC.",
    "Odpowiedz po polsku, bardzo czytelnie, w sekcjach Markdown:",
    "## Podsumowanie",
    "## Co poszło dobrze",
    "## Co poszło źle",
    "## Najczęstsze błędy",
    "## Psychologia",
    "## Jeden fokus na kolejny okres",
    "Każda sekcja: 2–5 krótkich punktów. Bez lania wody.",
  ].join("\n");

  const user = `Dane (bezpieczny wycinek tagów):\n${JSON.stringify(safePayload, null, 2)}`;

  const res = await fetch(resolveEndpoint(cfg), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const errBody = await res.json();
      detail = errBody?.error?.message || JSON.stringify(errBody);
    } catch {
      detail = await res.text();
    }
    throw new Error(`AI error (${res.status}): ${detail || res.statusText}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") {
    throw new Error("Pusta odpowiedź modelu.");
  }
  return { text: text.trim(), model };
}
