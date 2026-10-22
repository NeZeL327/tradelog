import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ImageUploadError,
  imageUploadMessage,
  isImageFile,
  prepareImageFile,
  replaceExt,
  sniffKindFromBytes,
} from "./imageUpload.js";

function bytes(arr) {
  return Uint8Array.from(arr);
}

function fileFrom(arr, name, type) {
  return new File([bytes(arr)], name, { type });
}

describe("sniffKindFromBytes", () => {
  it("detects jpeg/png/gif/bmp/tiff/webp/heic/avif from magic", () => {
    assert.equal(sniffKindFromBytes(bytes([0xff, 0xd8, 0xff, 0xe0])), "jpeg");
    assert.equal(sniffKindFromBytes(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
    assert.equal(sniffKindFromBytes(bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])), "gif");
    assert.equal(sniffKindFromBytes(bytes([0x42, 0x4d, 0x00, 0x00])), "bmp");
    assert.equal(sniffKindFromBytes(bytes([0x49, 0x49, 0x2a, 0x00])), "tiff");
    assert.equal(sniffKindFromBytes(bytes([0x4d, 0x4d, 0x00, 0x2a])), "tiff");
    const webp = bytes([
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
    ]);
    assert.equal(sniffKindFromBytes(webp), "webp");
    const heic = bytes([
      0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
    ]);
    assert.equal(sniffKindFromBytes(heic), "heic");
    const mif1 = bytes([
      0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31,
    ]);
    assert.equal(sniffKindFromBytes(mif1), "heic");
    const avif = bytes([
      0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
    ]);
    assert.equal(sniffKindFromBytes(avif), "avif");
  });

  it("falls back to empty type + heic extension (Safari/Mac)", () => {
    assert.equal(sniffKindFromBytes(bytes([0, 0, 0, 0]), "", "IMG_1234.HEIC"), "heic");
    assert.equal(sniffKindFromBytes(bytes([0, 0, 0, 0]), "", "scan.tiff"), "tiff");
  });

  it("rejects pdf/text", () => {
    assert.equal(sniffKindFromBytes(bytes([0x25, 0x50, 0x44, 0x46]), "application/pdf", "a.pdf"), "");
    assert.equal(sniffKindFromBytes(bytes([0x61, 0x62, 0x63]), "text/plain", "a.txt"), "");
  });
});

describe("isImageFile / replaceExt", () => {
  it("accepts images by mime or extension including empty-type HEIC", () => {
    assert.equal(isImageFile(new File([], "a.jpg", { type: "image/jpeg" })), true);
    assert.equal(isImageFile(new File([], "photo.HEIC", { type: "" })), true);
    assert.equal(isImageFile(new File([], "scan.tif", { type: "" })), true);
    assert.equal(isImageFile(new File([], "notes.txt", { type: "text/plain" })), false);
  });

  it("replaces extension", () => {
    assert.equal(replaceExt("IMG_1.HEIC", "jpg"), "IMG_1.jpg");
    assert.equal(replaceExt("", "jpg"), "image.jpg");
  });
});

describe("prepareImageFile", () => {
  it("passes jpeg through unchanged", async () => {
    const jpeg = fileFrom([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3], "shot.jpg", "image/jpeg");
    const out = await prepareImageFile(jpeg);
    assert.equal(out, jpeg);
  });

  it("passes png/webp/gif/avif through", async () => {
    const png = fileFrom([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "a.png", "image/png");
    assert.equal(await prepareImageFile(png), png);
    const gif = fileFrom([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], "a.gif", "image/gif");
    assert.equal(await prepareImageFile(gif), gif);
  });

  it("rejects unsupported and oversized files", async () => {
    await assert.rejects(
      () => prepareImageFile(fileFrom([0x25, 0x50, 0x44, 0x46], "a.pdf", "application/pdf")),
      (err) => err instanceof ImageUploadError && err.code === "unsupported"
    );
    const huge = new File([new Uint8Array(1)], "a.jpg", { type: "image/jpeg" });
    Object.defineProperty(huge, "size", { value: 26 * 1024 * 1024 });
    await assert.rejects(
      () => prepareImageFile(huge),
      (err) => err instanceof ImageUploadError && err.code === "too_large"
    );
  });
});

describe("imageUploadMessage", () => {
  it("maps codes through t()", () => {
    const t = (k) => ({ imageUnsupported: "Nieobsługiwany format pliku." }[k]);
    assert.equal(imageUploadMessage(new ImageUploadError("unsupported"), t), "Nieobsługiwany format pliku.");
  });
});
