// Run: node --test src/lib/noteMarkdown.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyNoteEnter,
  applyNoteTab,
  clipboardPlainText,
  firstNoteLine,
  stripNoteMarkdown,
  toMarkdownWithBreaks,
  wrapInline,
} from "./noteMarkdown.js";

const OLD = `Moje „dlaczego :D

Zejście ceny do IPA MIT M15 na EUR.
Reakcja na to długą świecą engulfing.
-0.33 Cena dotarła do BE i wypełniła imbalance z M1.`;

test("old notes keep newlines and are not turned into lists", () => {
  assert.equal(stripNoteMarkdown(OLD), OLD);
  assert.equal(firstNoteLine(OLD), "Moje „dlaczego :D");
  const afterEnter = applyNoteEnter(OLD, OLD.indexOf("-0.33"), OLD.indexOf("-0.33"));
  assert.match(afterEnter.value, /-0\.33 Cena/);
  assert.ok(!afterEnter.value.includes("\n- \n"));
});

test("strip removes markers before snippet cut", () => {
  assert.equal(firstNoteLine("**bold** title\nmore"), "bold title");
  assert.equal(stripNoteMarkdown("- item one\n- item two"), "item one\nitem two");
});

test("wrap toggles bold around a selection", () => {
  const once = wrapInline("hello world", 6, 11, "**");
  assert.equal(once.value, "hello **world**");
  const twice = wrapInline(once.value, once.start, once.end, "**");
  assert.equal(twice.value, "hello world");
});

test("enter continues a list and empty item ends it", () => {
  const continued = applyNoteEnter("- apple", 7, 7);
  assert.equal(continued.value, "- apple\n- ");
  const ended = applyNoteEnter("- apple\n- ", 11, 11);
  assert.equal(ended.value, "- apple\n");
});

test("tab indents only real list items", () => {
  const indented = applyNoteTab("- apple", 3, 3, false);
  assert.equal(indented.value, "  - apple");
  assert.equal(applyNoteTab("-0.33 price", 3, 3, false), null);
});

test("hard breaks keep a single enter as a line break", () => {
  assert.equal(toMarkdownWithBreaks("a\nb\n\nc"), "a  \nb\n\nc");
});

test("paste uses plain text only", () => {
  assert.equal(clipboardPlainText("<b>Hi</b>\r\nthere"), "<b>Hi</b>\nthere");
  assert.equal(clipboardPlainText("", "<b>Hi</b><script>alert(1)</script>"), "Hi");
});
