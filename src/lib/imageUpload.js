export const IMAGE_ACCEPT =
  "image/*,.heic,.heif,.tif,.tiff,.webp,.avif,.bmp,.gif,.png,.jpg,.jpeg";

const MAX_BYTES = 25 * 1024 * 1024;
const KEEP = new Set(["jpeg", "jpg", "png", "gif", "webp", "avif"]);
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1"]);
const AVIF_BRANDS = new Set(["avif", "avis"]);

export class ImageUploadError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "ImageUploadError";
    this.code = code;
  }
}

export function imageUploadMessage(err, t) {
  const key = {
    unsupported: "imageUnsupported",
    corrupt: "imageCorrupt",
    too_large: "imageTooLarge",
    heic: "imageHeicFailed",
    tiff: "imageTiffFailed",
  }[err?.code];
  if (key && typeof t === "function") return t(key);
  return err?.message || (typeof t === "function" ? t("imageUnsupported") : "Unsupported image");
}

export function replaceExt(name, ext) {
  const base = String(name || "image").replace(/\.[^.]+$/, "");
  return `${base || "image"}.${ext}`;
}

function extOf(name) {
  const m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

function bytesToAscii(bytes, start, end) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

export function sniffKindFromBytes(bytes, mime = "", name = "") {
  const type = String(mime || "").toLowerCase();
  const ext = extOf(name);
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) {
    return "tiff";
  }
  if (bytes.length >= 12 && bytesToAscii(bytes, 0, 4) === "RIFF" && bytesToAscii(bytes, 8, 12) === "WEBP") {
    return "webp";
  }
  if (bytes.length >= 12 && bytesToAscii(bytes, 4, 8) === "ftyp") {
    const brand = bytesToAscii(bytes, 8, 12).replace(/\0/g, " ").trim();
    if (HEIC_BRANDS.has(brand)) return "heic";
    if (AVIF_BRANDS.has(brand)) return "avif";
  }
  if (type.includes("heic") || type.includes("heif") || ext === "heic" || ext === "heif") return "heic";
  if (type.includes("tiff") || ext === "tif" || ext === "tiff") return "tiff";
  if (type === "image/avif" || ext === "avif") return "avif";
  if (type === "image/webp" || ext === "webp") return "webp";
  if (type === "image/gif" || ext === "gif") return "gif";
  if (type === "image/png" || ext === "png") return "png";
  if (type === "image/jpeg" || type === "image/jpg" || ext === "jpg" || ext === "jpeg") return "jpeg";
  if (type === "image/bmp" || type === "image/x-ms-bmp" || ext === "bmp") return "bmp";
  if (type.startsWith("image/")) return "image";
  return "";
}

export function isImageFile(file) {
  if (!file) return false;
  if (file.type?.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif|tif|tiff|avif)$/i.test(file.name || "");
}

async function readHead(file, n = 16) {
  const buf = await file.slice(0, n).arrayBuffer();
  return new Uint8Array(buf);
}

function blobToFile(blob, name, type) {
  return new File([blob], name, { type, lastModified: Date.now() });
}

function loadHtmlImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageUploadError("corrupt"));
    img.src = url;
  });
}

async function rasterToJpeg(file) {
  if (typeof document === "undefined") throw new ImageUploadError("unsupported");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadHtmlImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    if (!canvas.width || !canvas.height) throw new ImageUploadError("corrupt");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageUploadError("unsupported");
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (out) => (out ? resolve(out) : reject(new ImageUploadError("corrupt"))),
        "image/jpeg",
        0.9
      );
    });
    return blobToFile(blob, replaceExt(file.name, "jpg"), "image/jpeg");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareImageFile(file) {
  if (!file) throw new ImageUploadError("unsupported");
  if (file.size > MAX_BYTES) throw new ImageUploadError("too_large");
  const head = await readHead(file);
  const kind = sniffKindFromBytes(head, file.type, file.name);
  if (!kind) throw new ImageUploadError("unsupported");
  if (kind === "heic" || kind === "tiff") {
    try {
      const { ensureDisplayable } = await import("@/lib/imageConvert");
      return await ensureDisplayable(file);
    } catch (err) {
      throw new ImageUploadError(err?.code === "heic" ? "heic" : err?.code === "tiff" ? "tiff" : "corrupt");
    }
  }
  if (kind === "bmp") return rasterToJpeg(file);
  if (KEEP.has(kind) || kind === "image") return file;
  throw new ImageUploadError("unsupported");
}

export async function prepareImageForPreview(file) {
  const ready = await prepareImageFile(file);
  const previewUrl = URL.createObjectURL(ready);
  return { file: ready, previewUrl };
}

export function filesFromClipboard(clipboardData) {
  if (!clipboardData) return [];
  const out = [];
  const items = clipboardData.items ? [...clipboardData.items] : [];
  for (const item of items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) out.push(file);
  }
  if (out.length) return out;
  return clipboardData.files ? [...clipboardData.files] : [];
}

export function isTypingTarget(el) {
  if (!el) return false;
  const tag = String(el.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return Boolean(el.isContentEditable);
}
