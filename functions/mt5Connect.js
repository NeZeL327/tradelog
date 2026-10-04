// 1. Check the signed-in user owns the AiKeepTrade account.
// 2. Ask MetaApi to log that MT5 account in (password is not stored here).
// 3. Mark connected only when connectionStatus is CONNECTED.
import * as functions from "firebase-functions/v1";
import { randomBytes } from "node:crypto";

const PROVISIONING_BASE = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const STATUS_WAIT_MS = 90_000;
const STATUS_POLL_MS = 5_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const transactionId = () => randomBytes(16).toString("hex");

class MetaApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code || "METAAPI";
  }
}

const detailCode = (payload) => {
  const details = payload?.details;
  if (typeof details === "string") return details;
  if (details && typeof details.code === "string") return details.code;
  return "";
};

const suggestedServers = (payload) => {
  const groups = payload?.details?.serversByBrokers;
  if (!groups || typeof groups !== "object") return [];
  return Object.values(groups)
    .flat()
    .filter((name) => typeof name === "string" && name.trim())
    .slice(0, 5);
};

const safeMetaMessage = (payload, status) => {
  const code = detailCode(payload);
  if (status === 401 || status === 403) return "MetaApi odrzuciło autoryzację serwera.";
  if (code === "E_AUTH") return "Broker odrzucił login, hasło albo nazwę serwera.";
  if (code === "E_TRADING_ACCOUNT_DISABLED") return "Broker zgłasza, że konto MT5 jest wyłączone.";
  if (code === "E_PASSWORD_CHANGE_REQUIRED") return "Broker wymaga zmiany hasła MT5.";
  if (code === "ERR_OTP_REQUIRED") return "Konto wymaga jednorazowego hasła. Wyłącz OTP w aplikacji MT5.";
  if (code === "E_SERVER_TIMEZONE") return "MetaApi nie wykryło ustawień tego serwera. Sprawdź nazwę serwera.";
  if (code === "E_NO_SYMBOLS") return "Na koncie MT5 nie ma skonfigurowanych symboli.";
  if (code === "E_SRV_NOT_FOUND") {
    const names = suggestedServers(payload);
    return names.length
      ? `Nie znaleziono serwera. Podobne nazwy: ${names.join(", ")}.`
      : "Nie znaleziono serwera MT5. Sprawdź nazwę z terminala.";
  }
  if (code === "E_RESOURCE_SLOTS") return "Konto wymaga większej puli zasobów MetaApi.";
  if (status === 404) return "Konto MetaApi nie istnieje.";
  return "MetaApi nie połączyło terminala z brokerem.";
};

const retryDelayMs = (header) => {
  if (!header) return 10_000;
  const asNumber = Number(header);
  if (Number.isFinite(asNumber)) return Math.min(Math.max(asNumber, 1) * 1000, 60_000);
  const when = Date.parse(header);
  if (Number.isFinite(when)) return Math.min(Math.max(when - Date.now(), 1_000), 60_000);
  return 10_000;
};

async function metaRequest(token, path, { method = "GET", body, transaction } = {}) {
  const headers = {
    Accept: "application/json",
    "auth-token": token,
  };
  if (body) headers["Content-Type"] = "application/json";
  if (transaction) headers["transaction-id"] = transaction;

  const response = await fetch(`${PROVISIONING_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (response.status === 401 || response.status === 403) {
    console.error("MetaApi auth rejected", {
      httpStatus: response.status,
      endpoint: `${method} ${path}`,
      error: payload?.error ?? null,
      message: typeof payload?.message === "string" ? payload.message : null,
      details: payload?.details ?? null,
    });
  }

  return {
    status: response.status,
    payload,
    retryAfter: response.headers.get("retry-after"),
  };
}

function throwIfFailed(result) {
  if (result.status >= 200 && result.status < 300) return;
  if (result.status === 202) return;
  const code = detailCode(result.payload);
  throw new MetaApiError(safeMetaMessage(result.payload, result.status), code || `HTTP_${result.status}`);
}

async function createTradingAccount(token, body) {
  let slotsRetried = false;
  let transaction = transactionId();
  let payloadBody = body;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await metaRequest(token, "/users/current/accounts", {
      method: "POST",
      body: payloadBody,
      transaction,
    });

    if (result.status === 201 && result.payload?.id) return result.payload;

    if (result.status === 202) {
      await sleep(retryDelayMs(result.retryAfter));
      continue;
    }

    const code = detailCode(result.payload);
    const slots = Number(result.payload?.details?.recommendedResourceSlots);
    if (code === "E_RESOURCE_SLOTS" && !slotsRetried && Number.isFinite(slots) && slots >= 1 && slots <= 8) {
      slotsRetried = true;
      payloadBody = { ...payloadBody, resourceSlots: slots };
      transaction = transactionId();
      continue;
    }

    throwIfFailed(result);
    throw new MetaApiError(safeMetaMessage(result.payload, result.status), code || "CREATE_FAILED");
  }

  throw new MetaApiError("MetaApi nadal przygotowuje konto. Spróbuj ponownie za minutę.", "TIMEOUT");
}

async function readAccount(token, metaApiAccountId) {
  const result = await metaRequest(token, `/users/current/accounts/${metaApiAccountId}`);
  throwIfFailed(result);
  return result.payload;
}

async function readReplicas(token, metaApiAccountId) {
  const result = await metaRequest(token, `/users/current/accounts/${metaApiAccountId}/replicas`);
  if (result.status === 404) return [];
  throwIfFailed(result);
  return Array.isArray(result.payload) ? result.payload : [];
}

function brokerConnected(account, replicas) {
  if (account?.connectionStatus === "CONNECTED") return true;
  return replicas.some((replica) => replica?.connectionStatus === "CONNECTED");
}

function brokerRejected(account, replicas) {
  const rows = [account, ...replicas];
  if (rows.some((row) => row?.state === "DEPLOY_FAILED")) return true;
  if (brokerConnected(account, replicas)) return false;
  return rows.some(
    (row) => row?.connectionStatus === "DISCONNECTED_FROM_BROKER" && row?.state === "DEPLOYED"
  );
}

async function waitForBroker(token, metaApiAccountId, login) {
  const deadline = Date.now() + STATUS_WAIT_MS;
  while (Date.now() < deadline) {
    const account = await readAccount(token, metaApiAccountId);
    const replicas = await readReplicas(token, metaApiAccountId);
    if (brokerConnected(account, replicas)) {
      if (String(account?.login || "") !== login) {
        throw new MetaApiError("Terminal połączył się z innym numerem konta MT5.", "LOGIN_MISMATCH");
      }
      return account;
    }
    if (brokerRejected(account, replicas)) {
      throw new MetaApiError("Terminal MT5 nie połączył się z brokerem.", "DISCONNECTED_FROM_BROKER");
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(STATUS_POLL_MS, remaining));
  }
  throw new MetaApiError("Połączenie z brokerem nie zostało potwierdzone na czas.", "TIMEOUT");
}

async function ensureDeployed(token, metaApiAccountId, { redeploy }) {
  if (!redeploy) {
    const current = await readAccount(token, metaApiAccountId);
    if (current?.state === "DEPLOYED") return;
  }
  const action = redeploy ? "redeploy" : "deploy";
  const result = await metaRequest(token, `/users/current/accounts/${metaApiAccountId}/${action}`, {
    method: "POST",
  });
  throwIfFailed(result);
}

function integrationPayload(admin, fields) {
  return {
    mtIntegration: {
      platform: "mt5",
      status: fields.status,
      mt5Login: fields.mt5Login,
      server: fields.server,
      metaApiAccountId: fields.metaApiAccountId || null,
      connectedAt: fields.connected ? admin.firestore.FieldValue.serverTimestamp() : null,
      lastConnectionCheck: admin.firestore.FieldValue.serverTimestamp(),
      lastError: fields.lastError || null,
    },
  };
}

export async function connectMt5Handler(data, context, { admin, token }) {
  if (!context?.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Musisz być zalogowany.");
  }

  const uid = context.auth.uid;
  const accountId = String(data?.accountId || "").trim();
  const login = String(data?.login || "").trim();
  const server = String(data?.server || "").trim();
  const password = String(data?.password || "");

  if (!accountId) {
    throw new functions.https.HttpsError("invalid-argument", "Brak konta AiKeepTrade.");
  }
  if (!/^\d{3,20}$/.test(login)) {
    throw new functions.https.HttpsError("invalid-argument", "Login MT5 musi składać się z cyfr.");
  }
  if (!server || server.length > 128) {
    throw new functions.https.HttpsError("invalid-argument", "Podaj nazwę serwera MT5.");
  }
  if (password.trim().length < 4 || password.length > 128) {
    throw new functions.https.HttpsError("invalid-argument", "Podaj hasło inwestora MT5.");
  }
  if (!token) {
    throw new functions.https.HttpsError("failed-precondition", "Integracja MT5 nie jest skonfigurowana na serwerze.");
  }

  const ref = admin.firestore().doc(`users/${uid}/accounts/${accountId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "Nie znaleziono tego konta.");
  }

  const account = snap.data() || {};
  const existingMetaId = String(account.mtIntegration?.metaApiAccountId || "").trim();
  const accountName = String(account.name || "AiKeepTrade").slice(0, 64);

  await ref.set(integrationPayload(admin, {
    status: "pending",
    mt5Login: login,
    server,
    metaApiAccountId: existingMetaId,
    connected: false,
    lastError: null,
  }), { merge: true });

  let metaApiAccountId = existingMetaId;

  try {
    if (metaApiAccountId) {
      const updated = await metaRequest(token, `/users/current/accounts/${metaApiAccountId}`, {
        method: "PUT",
        body: {
          password,
          name: accountName,
          server,
          magic: 0,
          manualTrades: true,
        },
      });
      if (updated.status === 404) {
        metaApiAccountId = "";
      } else {
        throwIfFailed(updated);
        await ensureDeployed(token, metaApiAccountId, { redeploy: true });
      }
    }

    if (!metaApiAccountId) {
      const created = await createTradingAccount(token, {
        login,
        password,
        name: accountName,
        server,
        platform: "mt5",
        magic: 0,
        type: "cloud-g1",
        reliability: "regular",
        metadata: { aikeepAccountId: accountId },
      });
      metaApiAccountId = created.id;
      if (created.state !== "DEPLOYED") {
        await ensureDeployed(token, metaApiAccountId, { redeploy: false });
      }
    }

    const live = await waitForBroker(token, metaApiAccountId, login);
    const confirmedServer = String(live?.server || server);

    await ref.set(integrationPayload(admin, {
      status: "connected",
      mt5Login: String(live?.login || login),
      server: confirmedServer,
      metaApiAccountId,
      connected: true,
      lastError: null,
    }), { merge: true });

    return {
      status: "connected",
      platform: "mt5",
      mt5Login: String(live?.login || login),
      server: confirmedServer,
      metaApiAccountId,
    };
  } catch (error) {
    const message = error instanceof MetaApiError
      ? error.message
      : "Nie udało się połączyć z MT5.";
    console.error("connectMt5 failed", {
      code: error?.code || "UNKNOWN",
      accountId,
    });
    try {
      await ref.set(integrationPayload(admin, {
        status: "error",
        mt5Login: login,
        server,
        metaApiAccountId,
        connected: false,
        lastError: message,
      }), { merge: true });
    } catch (writeError) {
      console.error("connectMt5 status write failed", { code: writeError?.code || "WRITE" });
    }
    throw new functions.https.HttpsError("failed-precondition", message);
  }
}
