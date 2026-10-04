/**
 * Manual MT5 history sync.
 * 1. Read the account region from MetaApi (never assume new-york).
 * 2. Pull closed-deal history from lastHistorySyncAt, in bounded pages.
 * 3. Build one journal trade per closed position.
 * 4. Insert only trades filterNewTrades does not already know.
 * 5. Move lastHistorySyncAt only after that range is fully read and saved.
 */
import * as functions from "firebase-functions/v1";
import { filterNewTrades, normalizeTicket } from "./tradeImportDedup.js";
import {
  assertMarginMode,
  classifyPosition,
  groupPositionDeals,
  uniqueDeals,
} from "./mt5Positions.js";

const PROVISIONING = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const FIRST_HISTORY_START = "2020-01-01T00:00:00.000Z";
const WINDOW_MS = 31 * 24 * 60 * 60 * 1000;
const MIN_RANGE_MS = 6 * 60 * 60 * 1000;
const MAX_WINDOWS = 4;
const PAGE_LIMIT = 1000;
const MAX_PAGES_PER_RANGE = 5;
// 6 x 25s = 150s. The function timeout stays 180s, leaving time to map, dedupe and write.
const MAX_META_REQUESTS_PER_SYNC = 6;
const LOOKUP_BUDGET = 25;

function httpsError(code, message) {
  return new functions.https.HttpsError(code, message);
}

function safeHttpMessage(status) {
  if (status === 401 || status === 403) return "MetaApi odrzuciło autoryzację serwera.";
  if (status === 404) return "MetaApi nie znalazło konta w jego regionie.";
  if (status === 429) return "MetaApi ograniczyło liczbę zapytań. Spróbuj ponownie za chwilę.";
  return "MetaApi zwróciło błąd odczytu historii.";
}

function clientHost(region) {
  const name = String(region || "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) return "";
  return `https://mt-client-api-v1.${name}.agiliumtrade.ai`;
}

function isConnected(account) {
  const link = account?.mtIntegration;
  return link?.status === "connected" && link?.platform === "mt5" && !!link?.metaApiAccountId;
}

function cursorIso(link) {
  const parsed = Date.parse(link?.lastHistorySyncAt || "");
  if (!Number.isFinite(parsed)) return FIRST_HISTORY_START;
  return new Date(parsed).toISOString();
}

function budgetError() {
  const err = new Error("meta-budget");
  err.code = "META_BUDGET";
  return err;
}

function isBudgetError(err) {
  return err?.code === "META_BUDGET";
}

async function metaGet(url, token, requestBudget) {
  if (!requestBudget || requestBudget.left <= 0) throw budgetError();
  requestBudget.left -= 1;

  let response;
  try {
    response = await fetch(url, {
      headers: { "auth-token": token, Accept: "application/json" },
      signal: AbortSignal.timeout(25000),
    });
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw httpsError("deadline-exceeded", "MetaApi nie odpowiedziało w czasie.");
    }
    throw httpsError("unavailable", "Nie udało się połączyć z MetaApi.");
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    console.error("MetaApi history request failed", { httpStatus: response.status });
    throw httpsError("failed-precondition", safeHttpMessage(response.status));
  }
  return payload;
}

function cleanTrade(trade) {
  const out = {};
  for (const [key, value] of Object.entries(trade)) {
    if (value === undefined) continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    out[key] = value;
  }
  out.account_id = String(trade.account_id);
  out.status = trade.status || "Closed";
  return out;
}

async function writeTrades(admin, uid, trades) {
  const db = admin.firestore();
  const col = db.collection("users").doc(uid).collection("trades");
  for (let i = 0; i < trades.length; i += 400) {
    const chunk = trades.slice(i, i + 400);
    const batch = db.batch();
    for (const trade of chunk) {
      batch.set(col.doc(), {
        ...cleanTrade(trade),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

async function loadExisting(admin, uid, accountId) {
  const snap = await admin
    .firestore()
    .collection("users")
    .doc(uid)
    .collection("trades")
    .where("account_id", "==", String(accountId))
    .get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((trade) => !trade.deleted_at);
}

async function loadTargets(admin, uid, requested) {
  const col = admin.firestore().collection("users").doc(uid).collection("accounts");
  if (requested === "all") {
    const snap = await col.get();
    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(isConnected);
  }
  if (!/^[\w-]{1,128}$/.test(requested)) {
    throw httpsError("invalid-argument", "Wybierz konto.");
  }
  const doc = await col.doc(requested).get();
  if (!doc.exists) throw httpsError("not-found", "Nie znaleziono konta.");
  const account = { id: doc.id, ...doc.data() };
  if (!isConnected(account)) {
    throw httpsError("failed-precondition", "To konto nie jest połączone z MT5.");
  }
  return [account];
}

function pagesForAttempt(requestBudget, startMs, rangeEnd) {
  if (!requestBudget || requestBudget.left <= 0) return 0;
  const canSplit = rangeEnd - startMs > MIN_RANGE_MS;
  // Keep one request for a smaller slice, so a full page does not consume the whole click.
  if (canSplit && requestBudget.left > 1) return 1;
  return Math.min(MAX_PAGES_PER_RANGE, requestBudget.left);
}

async function fetchRange(host, metaId, token, start, end, requestBudget, maxPages) {
  const deals = [];
  let offset = 0;
  let pages = 0;
  let complete = false;
  let budgetExhausted = false;
  while (pages < maxPages) {
    if (requestBudget.left <= 0) {
      budgetExhausted = true;
      break;
    }
    const url = `${host}/users/current/accounts/${encodeURIComponent(metaId)}/history-deals/time/${encodeURIComponent(start)}/${encodeURIComponent(end)}?offset=${offset}&limit=${PAGE_LIMIT}`;
    let page;
    try {
      page = await metaGet(url, token, requestBudget);
    } catch (err) {
      if (isBudgetError(err)) {
        budgetExhausted = true;
        break;
      }
      throw err;
    }
    if (!Array.isArray(page)) {
      throw httpsError("failed-precondition", "MetaApi zwróciło nieprawidłową historię.");
    }
    deals.push(...page);
    pages += 1;
    if (page.length < PAGE_LIMIT) {
      complete = true;
      break;
    }
    offset += PAGE_LIMIT;
  }
  return { deals: uniqueDeals(deals), complete, pages, budgetExhausted };
}

async function fetchBounded(host, metaId, token, startMs, endMs, requestBudget) {
  let rangeEnd = endMs;
  while (requestBudget.left > 0) {
    if (rangeEnd - startMs < 1000) {
      return { complete: true, deals: [], endMs: rangeEnd };
    }
    const result = await fetchRange(
      host,
      metaId,
      token,
      new Date(startMs).toISOString(),
      new Date(rangeEnd).toISOString(),
      requestBudget,
      pagesForAttempt(requestBudget, startMs, rangeEnd)
    );
    if (result.complete) return { complete: true, deals: result.deals, endMs: rangeEnd };
    if (result.budgetExhausted || requestBudget.left <= 0 || rangeEnd - startMs <= MIN_RANGE_MS) {
      return { complete: false, deals: [], endMs: startMs };
    }
    // The wide window did not fit in one page. Read the minimum slice with the requests still left.
    rangeEnd = startMs + MIN_RANGE_MS;
  }
  return { complete: false, deals: [], endMs: startMs };
}

async function fetchPositionDeals(host, metaId, token, positionId, requestBudget) {
  const url = `${host}/users/current/accounts/${encodeURIComponent(metaId)}/history-deals/position/${encodeURIComponent(positionId)}`;
  const payload = await metaGet(url, token, requestBudget);
  if (!Array.isArray(payload)) {
    throw httpsError("failed-precondition", "MetaApi zwróciło nieprawidłową historię pozycji.");
  }
  return payload;
}

function ticketSet(trades) {
  const tickets = new Set();
  for (const trade of trades || []) {
    const ticket = normalizeTicket(trade.external_ticket || trade.ticket_id || trade.ticket);
    if (ticket) tickets.add(ticket);
  }
  return tickets;
}

function latestDealTime(rows) {
  let latest = 0;
  for (const deal of rows) {
    const time = Date.parse(deal?.time || "");
    if (Number.isFinite(time) && time > latest) latest = time;
  }
  return latest;
}

async function tradesFromDeals(ctx) {
  const { groups, unmapped } = groupPositionDeals(ctx.deals);
  const resolved = new Map(ctx.resolvedTimes || []);
  const trades = [];
  const pendingIds = [];
  let lookupsLeft = ctx.lookupBudget.left;
  const known = ticketSet(ctx.known);

  for (const [positionId, rows] of groups) {
    const ticket = normalizeTicket(positionId);
    let verdict = classifyPosition(positionId, rows, ctx.accountId);
    if (verdict.status === "needs-history" && ticket && known.has(ticket)) continue;
    if (verdict.status !== "needs-history") {
      if (verdict.status === "trade") trades.push(verdict.trade);
      else if (verdict.status === "unmapped") unmapped.push({ positionId, reason: verdict.reason });
      continue;
    }

    const latest = latestDealTime(rows);
    const seenAt = resolved.get(positionId) || 0;
    if (seenAt && latest <= seenAt) continue;
    if (lookupsLeft <= 0 || ctx.requestBudget.left <= 0) {
      pendingIds.push(positionId);
      continue;
    }

    lookupsLeft -= 1;
    let full;
    try {
      full = await fetchPositionDeals(ctx.host, ctx.metaId, ctx.token, positionId, ctx.requestBudget);
    } catch (err) {
      if (!isBudgetError(err)) throw err;
      pendingIds.push(positionId);
      continue;
    }
    verdict = classifyPosition(positionId, uniqueDeals(full), ctx.accountId, { final: true });
    if (verdict.status === "trade") trades.push(verdict.trade);
    else if (verdict.status === "unmapped") unmapped.push({ positionId, reason: verdict.reason });
    if (verdict.status === "open" || verdict.status === "unmapped") {
      resolved.set(positionId, latest);
    }
  }

  ctx.lookupBudget.left = lookupsLeft;
  return { trades, unmapped, pendingIds, resolved };
}

function resolvedPayload(resolvedTimes) {
  const out = {};
  for (const [positionId, time] of resolvedTimes) {
    if (!time) continue;
    out[String(positionId)] = new Date(time).toISOString();
  }
  return out;
}

async function readMetaAccount(url, token, requestBudget) {
  try {
    return { value: await metaGet(url, token, requestBudget) };
  } catch (err) {
    if (isBudgetError(err)) return { budgetExhausted: true };
    throw err;
  }
}

async function syncOneAccount(admin, uid, account, token, requestBudget) {
  const link = account.mtIntegration;
  const metaId = String(link.metaApiAccountId);
  const provisioned = await readMetaAccount(
    `${PROVISIONING}/users/current/accounts/${encodeURIComponent(metaId)}`,
    token,
    requestBudget
  );
  if (provisioned.budgetExhausted) {
    return { fetched: 0, added: 0, existing: 0, unmapped: 0, partial: true };
  }
  const host = clientHost(provisioned.value?.region);
  if (!host) throw httpsError("failed-precondition", "Konto MetaApi nie ma rozpoznanego regionu.");

  const informed = await readMetaAccount(
    `${host}/users/current/accounts/${encodeURIComponent(metaId)}/account-information`,
    token,
    requestBudget
  );
  if (informed.budgetExhausted) {
    return { fetched: 0, added: 0, existing: 0, unmapped: 0, partial: true };
  }
  const marginError = assertMarginMode(informed.value?.marginMode);
  if (marginError) throw httpsError("failed-precondition", marginError);

  const totals = { fetched: 0, added: 0, existing: 0, unmapped: 0, partial: false };
  let known = await loadExisting(admin, uid, account.id);
  let cursorMs = Date.parse(cursorIso(link));
  const nowMs = Date.now();
  const lookupBudget = { left: LOOKUP_BUDGET };
  let windows = 0;
  const resolvedTimes = new Map();
  const savedResolved = link.resolvedPositionTimes;
  if (savedResolved && typeof savedResolved === "object") {
    for (const [positionId, iso] of Object.entries(savedResolved)) {
      const time = Date.parse(iso);
      if (Number.isFinite(time)) resolvedTimes.set(positionId, time);
    }
  }

  while (cursorMs < nowMs && windows < MAX_WINDOWS) {
    const windowEnd = Math.min(nowMs, cursorMs + WINDOW_MS);
    const range = await fetchBounded(host, metaId, token, cursorMs, windowEnd, requestBudget);
    if (!range.complete) {
      totals.partial = true;
      break;
    }

    totals.fetched += range.deals.length;
    const built = await tradesFromDeals({
      deals: range.deals,
      accountId: account.id,
      host,
      metaId,
      token,
      known,
      resolvedTimes,
      lookupBudget,
      requestBudget,
    });
    for (const [positionId, time] of built.resolved) resolvedTimes.set(positionId, time);
    totals.unmapped += built.unmapped.length;
    const filtered = filterNewTrades(built.trades, known, account.id);
    totals.existing += filtered.skipped;
    if (filtered.newTrades.length) {
      await writeTrades(admin, uid, filtered.newTrades);
      totals.added += filtered.newTrades.length;
      known = known.concat(filtered.newTrades);
    }

    const ref = admin.firestore().doc(`users/${uid}/accounts/${account.id}`);
    if (built.pendingIds.length) {
      await ref.update({ "mtIntegration.resolvedPositionTimes": resolvedPayload(resolvedTimes) });
      totals.partial = true;
      break;
    }

    await ref.update({
      "mtIntegration.lastHistorySyncAt": new Date(range.endMs).toISOString(),
      "mtIntegration.resolvedPositionTimes": admin.firestore.FieldValue.delete(),
    });
    cursorMs = range.endMs;
    resolvedTimes.clear();
    windows += 1;
    if (cursorMs < nowMs && (windows >= MAX_WINDOWS || requestBudget.left <= 0)) {
      totals.partial = true;
      break;
    }
  }

  return totals;
}

function accountFailureMessage(err) {
  const code = err?.code;
  const safeCode = code === "failed-precondition"
    || code === "deadline-exceeded"
    || code === "unavailable"
    || code === "not-found";
  if (safeCode && typeof err?.message === "string" && err.message.length < 240) {
    return err.message;
  }
  console.error("syncMt5 account failed", { code: code || "unknown" });
  return "Synchronizacja tego konta nie powiodła się.";
}

function present(totals, errors, outcomes) {
  const accountsOk = outcomes.ok;
  const accountsPartial = outcomes.partial;
  const accountsError = outcomes.error;
  const shared = {
    fetched: totals.fetched,
    existing: totals.existing,
    added: totals.added,
    unmapped: totals.unmapped,
    accountsOk,
    accountsPartial,
    accountsError,
  };

  if (!totals.accounts) {
    return {
      status: "error",
      title: "Synchronizacja nieudana",
      detail: "Brak podłączonych kont MT5.",
      partial: false,
      ...shared,
    };
  }

  let status = "success";
  if (accountsError > 0) status = "error";
  else if (accountsPartial > 0 || totals.partial) status = "partial";

  if (status === "error") {
    const reason = errors.map((item) => `${item.name}: ${item.message}`).join(" ");
    return {
      status,
      title: "Synchronizacja nieudana",
      detail: totals.added > 0 ? `Dodano ${totals.added}. ${reason}` : reason,
      partial: accountsPartial > 0 || !!totals.partial,
      ...shared,
    };
  }

  if (status === "partial") {
    return {
      status,
      title: "Synchronizacja częściowa",
      detail: "Zakres nie został jeszcze w pełni pobrany. Kliknij Synchronizuj ponownie, aby kontynuować.",
      partial: true,
      ...shared,
    };
  }

  let detail = totals.added > 0
    ? `+${totals.added} nowych transakcji`
    : "Brak nowych transakcji";
  if (totals.unmapped > 0) {
    detail += ` Pominięto ${totals.unmapped} pozycji bez jednoznacznego zapisu.`;
  }
  return {
    status: "success",
    title: "Synchronizacja zakończona",
    detail,
    partial: false,
    ...shared,
  };
}

export async function syncMt5Handler(data, context, { admin, token }) {
  if (!context.auth?.uid) {
    throw httpsError("unauthenticated", "Zaloguj się, aby synchronizować MT5.");
  }
  if (!token) throw httpsError("failed-precondition", "Brak konfiguracji serwera.");

  const requested = String(data?.accountId || "").trim();
  if (!requested) throw httpsError("invalid-argument", "Wybierz konto.");

  const targets = await loadTargets(admin, context.auth.uid, requested);
  const totals = {
    accounts: targets.length,
    fetched: 0,
    existing: 0,
    added: 0,
    partial: false,
    unmapped: 0,
  };
  const outcomes = { ok: 0, partial: 0, error: 0 };
  const errors = [];
  const requestBudget = { left: MAX_META_REQUESTS_PER_SYNC };

  for (const account of targets) {
    if (requestBudget.left <= 0) {
      outcomes.partial += 1;
      totals.partial = true;
      continue;
    }
    try {
      const result = await syncOneAccount(admin, context.auth.uid, account, token, requestBudget);
      totals.fetched += result.fetched;
      totals.existing += result.existing;
      totals.added += result.added;
      totals.unmapped += result.unmapped;
      if (result.partial) {
        outcomes.partial += 1;
        totals.partial = true;
      } else {
        outcomes.ok += 1;
      }
    } catch (err) {
      if (isBudgetError(err)) {
        outcomes.partial += 1;
        totals.partial = true;
        continue;
      }
      outcomes.error += 1;
      errors.push({
        name: account.name || "Konto",
        message: accountFailureMessage(err),
      });
    }
  }

  return present(totals, errors, outcomes);
}
