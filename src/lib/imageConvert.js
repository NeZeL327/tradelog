const MAX_EDGE = 3000;
const CACHE_LIMIT = 50;

export class ConvertError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "ConvertError";
    this.code = code;
  }
}

export function isTiffHeader(bytes) {
  if (!bytes || bytes.length < 4) return false;
  const le = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00;
  const be = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a;
  return le || be;
}

export function isTiff(fileOrBlob, nameOrUrl = "") {
  const type = String(fileOrBlob?.type || "").toLowerCase();
  const name = String(nameOrUrl || fileOrBlob?.name || "");
  if (type.includes("tiff") || type === "image/tif") return true;
  if (/\.tiff?(?:$|[?#])/i.test(name)) return true;
  return false;
}

function extOf(name) {
  const m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)(?:$|[?#])/);
  return m ? m[1] : "";
}

function isHeicName(blob, name) {
  const type = String(blob?.type || "").toLowerCase();
  const ext = extOf(name || blob?.name);
  return type.includes("heic") || type.includes("heif") || ext === "heic" || ext === "heif";
}

function replaceExt(name, ext) {
  const base = String(name || "image").replace(/\.[^.?#]+(?:[?#].*)?$/, "");
  const clean = base.split("/").pop() || "image";
  return `${clean}.${ext}`;
}

function yieldUi() {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: 80 });
      return;
    }
    setTimeout(resolve, 0);
  });
}

function blobToFile(blob, name, type) {
  return new File([blob], name, { type, lastModified: Date.now() });
}

function pickPage(ifds) {
  const list = Array.isArray(ifds) ? ifds : [];
  return list.find((page) => page && (page.width || page.t256)) || list[0];
}

async function decodeTiff(blob) {
  await yieldUi();
  const buffer = await blob.arrayBuffer();
  await yieldUi();
  const mod = await import("utif2");
  const UTIF = mod.default?.decode ? mod.default : mod;
  if (!UTIF?.decode) throw new ConvertError("corrupt");
  const ifds = UTIF.decode(buffer);
  const page = pickPage(ifds);
  if (!page) throw new ConvertError("corrupt");
  UTIF.decodeImage(buffer, page);
  const rgba = UTIF.toRGBA8(page);
  return {
    rgba,
    width: Number(page.width || page.t256?.[0] || 0),
    height: Number(page.height || page.t257?.[0] || 0),
    orientation: Number(page.t274?.[0] || 1),
  };
}

function putRgba(ctx, rgba, width, height) {
  const image = ctx.createImageData(width, height);
  image.data.set(rgba.subarray(0, width * height * 4));
  ctx.putImageData(image, 0, 0);
}

function drawOriented(srcCanvas, ori) {
  if (!ori || ori === 1) return srcCanvas;
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const out = document.createElement("canvas");
  const swap = ori === 5 || ori === 6 || ori === 7 || ori === 8;
  out.width = swap ? h : w;
  out.height = swap ? w : h;
  const ctx = out.getContext("2d");
  if (!ctx) throw new ConvertError("unsupported");
  ctx.save();
  switch (ori) {
    case 2:
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      break;
    case 3:
      ctx.translate(w, h);
      ctx.rotate(Math.PI);
      break;
    case 4:
      ctx.translate(0, h);
      ctx.scale(1, -1);
      break;
    case 5:
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      break;
    case 6:
      ctx.translate(h, 0);
      ctx.rotate(0.5 * Math.PI);
      break;
    case 7:
      ctx.translate(h, w);
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      break;
    case 8:
      ctx.translate(0, w);
      ctx.rotate(-0.5 * Math.PI);
      break;
    default:
      break;
  }
  ctx.drawImage(srcCanvas, 0, 0);
  ctx.restore();
  return out;
}

function scaleCanvas(src, maxEdge) {
  const w = src.width;
  const h = src.height;
  if (!w || !h) throw new ConvertError("corrupt");
  const edge = Math.max(w, h);
  if (edge <= maxEdge) return src;
  const scale = maxEdge / edge;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(w * scale));
  out.height = Math.max(1, Math.round(h * scale));
  const ctx = out.getContext("2d");
  if (!ctx) throw new ConvertError("unsupported");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

function canvasToPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ConvertError("corrupt"))),
      "image/png"
    );
  });
}

export async function tiffToPng(blob) {
  if (typeof document === "undefined") throw new ConvertError("unsupported");
  try {
    const decoded = await decodeTiff(blob);
    await yieldUi();
    const width = decoded.width;
    const height = decoded.height;
    if (!width || !height || !decoded.rgba) throw new ConvertError("corrupt");
    const src = document.createElement("canvas");
    src.width = width;
    src.height = height;
    const ctx = src.getContext("2d");
    if (!ctx) throw new ConvertError("unsupported");
    putRgba(ctx, decoded.rgba, width, height);
    const oriented = drawOriented(src, decoded.orientation || 1);
    const fitted = scaleCanvas(oriented, MAX_EDGE);
    return canvasToPng(fitted);
  } catch (err) {
    if (err instanceof ConvertError) throw err;
    throw new ConvertError("tiff");
  }
}

async function heicToJpeg(blob, name) {
  try {
    const mod = await import("heic-to");
    const heicTo = mod.heicTo || mod.default?.heicTo;
    if (typeof heicTo !== "function") throw new Error("heic-to missing");
    const out = await heicTo({ blob, type: "image/jpeg", quality: 0.9 });
    return blobToFile(out, replaceExt(name || blob.name, "jpg"), "image/jpeg");
  } catch {
    throw new ConvertError("heic");
  }
}

export async function ensureDisplayable(input, nameOrUrl = "") {
  if (!input) throw new ConvertError("unsupported");
  const name = nameOrUrl || input.name || "image";
  const head = new Uint8Array(await input.slice(0, 16).arrayBuffer());
  if (isTiffHeader(head) || isTiff(input, name)) {
    const png = await tiffToPng(input);
    return blobToFile(png, replaceExt(name, "png"), "image/png");
  }
  if (isHeicName(input, name)) return heicToJpeg(input, name);
  return input instanceof File ? input : blobToFile(input, name, input.type || "image/png");
}

export async function loadSourceBlob(url) {
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new ConvertError("corrupt");
  return res.blob();
}

const displayCache = new Map();

function evictCache() {
  if (displayCache.size <= CACHE_LIMIT) return;
  for (const [key, item] of displayCache) {
    if (item.n > 0) continue;
    URL.revokeObjectURL(item.url);
    displayCache.delete(key);
    if (displayCache.size <= CACHE_LIMIT) return;
  }
}

export async function displayableObjectUrl(src) {
  const hit = displayCache.get(src);
  if (hit) {
    hit.n += 1;
    return hit.url;
  }
  const blob = await loadSourceBlob(src);
  const ready = await ensureDisplayable(blob, src);
  const url = URL.createObjectURL(ready);
  displayCache.set(src, { url, n: 1 });
  evictCache();
  return url;
}

export function releaseDisplayUrl(src) {
  const hit = displayCache.get(src);
  if (!hit) return;
  hit.n = Math.max(0, hit.n - 1);
}
