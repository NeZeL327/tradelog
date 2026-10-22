import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDayNotesCopy } from "./dayNotesCopy.js";

describe("buildDayNotesCopy", () => {
  it("joins header, full notes, score and tags", () => {
    const text = buildDayNotesCopy({
      title: "Podsumowanie dnia",
      dateLabel: "22 października 2026",
      countLabel: "4 transakcje",
      emptyNote: "Brak notatki",
      scoreLabel: "Wynik dnia",
      scoreValue: "0W · 4L",
      tags: [{ tag: "FOMO" }, { tag: "REVENGE TRADE" }],
      sections: [
        { symbol: "EURUSD", direction: "Short", time: "09:36:12", result: "-0.32%", notes: "Pierwsza\n\nDruga linia" },
        { symbol: "GBPUSD", direction: "Short", time: "09:05:05", result: "-0.24%", notes: "" },
      ],
    });
    assert.match(text, /Podsumowanie dnia\n22 października 2026\n4 transakcje/);
    assert.match(text, /EURUSD · Short · 09:36:12 · -0\.32%\nPierwsza\n\nDruga linia/);
    assert.match(text, /GBPUSD · Short · 09:05:05 · -0\.24%\nBrak notatki/);
    assert.match(text, /WYNIK DNIA: 0W · 4L/);
    assert.match(text, /FOMO · REVENGE TRADE/);
  });

  it("returns empty string when nothing is passed", () => {
    assert.equal(buildDayNotesCopy({}), "");
  });
});
