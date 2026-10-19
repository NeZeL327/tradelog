// Run: node --test src/lib/tradePreviewStats.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "path";
import { build } from "esbuild";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis.window || { self: {}, top: {} };
globalThis.localStorage = globalThis.localStorage || {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const bundled = await build({
  entryPoints: [path.join(srcDir, "lib/tradePreviewStats.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  alias: { "@": srcDir },
  logLevel: "silent",
});
const helper = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const { getTradePhotoItems, getTradeScreenshots } = helper;

test("slots and extras match thumbnail helper 1:1", () => {
  const trade = {
    screenshot_1: "a.jpg",
    screenshot_2: "b.jpg",
    screenshot_3: "c.jpg",
    chart_screenshots: ["d.jpg", { url: "e.jpg", caption: "exit" }],
  };
  const urls = getTradeScreenshots(trade);
  const items = getTradePhotoItems(trade);
  assert.deepEqual(urls, ["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg"]);
  assert.deepEqual(items.map((item) => item.url), urls);
  assert.equal(items[4].caption, "exit");
  assert.equal(items[0].kind, "slot");
  assert.equal(items[3].kind, "extra");
});

test("empty trade has no shots", () => {
  assert.deepEqual(getTradeScreenshots({}), []);
  assert.deepEqual(getTradePhotoItems(null), []);
});

test("shared URL between slot and extras is listed once, slot first", () => {
  const trade = {
    screenshot_1: "same.jpg",
    chart_screenshots: ["same.jpg", "extra.jpg"],
  };
  assert.deepEqual(getTradeScreenshots(trade), ["same.jpg", "extra.jpg"]);
});
