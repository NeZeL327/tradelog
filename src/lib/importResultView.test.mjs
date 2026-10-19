// Run: node --test src/lib/importResultView.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  importResultStatus,
  importResultTiles,
  polishUnitKind,
  splitImportError,
  summarizeImportedTrades,
} from "./importResultView.js";

test("success when trades were added", () => {
  assert.equal(importResultStatus({ imported: 24, skipped: 0 }), "success");
});

test("warning for duplicates, not an error", () => {
  assert.equal(importResultStatus({ imported: 0, skipped: 12 }), "warning");
  assert.equal(importResultStatus({ imported: 8, skipped: 3 }), "warning");
});

test("error for empty file or thrown message", () => {
  assert.equal(importResultStatus({ imported: 0, skipped: 0, empty: true }), "error");
  assert.equal(importResultStatus({ errorMessage: "Wybierz raport historii CSV, XML lub XLSX z MT4/MT5." }), "error");
});

test("tiles hide invented values", () => {
  assert.deepEqual(importResultTiles({ errorMessage: "fail" }), []);
  assert.deepEqual(importResultTiles({ imported: 24, skipped: 0 }), [
    { id: "imported", value: 24 },
    { id: "skipped", value: 0 },
  ]);
  assert.deepEqual(importResultTiles({ imported: 0, skipped: 5 }), [
    { id: "imported", value: 0 },
    { id: "skipped", value: 5 },
  ]);
  assert.deepEqual(importResultTiles({ imported: 2, errors: 0 }), [
    { id: "imported", value: 2 },
  ]);
  assert.deepEqual(importResultTiles({ imported: 2, errors: 1 }), [
    { id: "imported", value: 2 },
    { id: "errors", value: 1 },
  ]);
});

test("summarize uses only provided trades", () => {
  const summary = summarizeImportedTrades([
    { symbol: "EURUSD", date: "2026-10-13" },
    { symbol: "GBPUSD", date: "2026-10-19" },
    { symbol: "EURUSD", date: "2026-10-15" },
  ]);
  assert.deepEqual(summary.symbols, ["EURUSD", "GBPUSD"]);
  assert.equal(summary.dateFrom, "2026-10-13");
  assert.equal(summary.dateTo, "2026-10-19");
  assert.deepEqual(summarizeImportedTrades([]), { symbols: [], dateFrom: null, dateTo: null });
});

test("long parser dumps go to technical details", () => {
  const raw =
    "Odczytano 40 wierszy z XLSX, ale żadnego buy/sell. Sprawdź czy to historia pozycji. Przykład wierszy: Balance | Deposit";
  const split = splitImportError(raw);
  assert.equal(split.friendlyKey, "importResultEmptyHint");
  assert.match(split.technical, /Przykład wierszy/);
});

test("polish units", () => {
  assert.equal(polishUnitKind(1), "one");
  assert.equal(polishUnitKind(2), "few");
  assert.equal(polishUnitKind(5), "many");
  assert.equal(polishUnitKind(22), "few");
});
