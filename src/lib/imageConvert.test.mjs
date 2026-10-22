import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isTiff, isTiffHeader } from "./imageConvert.js";

function bytes(arr) {
  return Uint8Array.from(arr);
}

describe("isTiff / isTiffHeader", () => {
  it("detects II*\\0 and MM\\0*", () => {
    assert.equal(isTiffHeader(bytes([0x49, 0x49, 0x2a, 0x00])), true);
    assert.equal(isTiffHeader(bytes([0x4d, 0x4d, 0x00, 0x2a])), true);
    assert.equal(isTiffHeader(bytes([0xff, 0xd8, 0xff, 0xe0])), false);
  });

  it("detects empty type + .tiff URL/name (Safari/Mac)", () => {
    assert.equal(isTiff(new File([], "shot.TIFF", { type: "" })), true);
    assert.equal(isTiff(null, "https://x/o/users%2F1%2Ffile.tiff?alt=media"), true);
    assert.equal(isTiff(new Blob([], { type: "image/tiff" })), true);
    assert.equal(isTiff(new File([], "a.jpg", { type: "image/jpeg" })), false);
  });
});
