/**
 * XLSX / Open XML reader for MetaTrader ReportHistory-*.xlsx
 * Row-centric cell parsing (MT often omits c@r) + ZIP / SpreadsheetML fallbacks.
 */

function readU16(view, offset) {
  return view.getUint16(offset, true);
}

function readU32(view, offset) {
  return view.getUint32(offset, true);
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Przeglądarka nie obsługuje odczytu plików XLSX");
  }
  const tryFormat = async (format) => {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };
  try {
    return await tryFormat("deflate-raw");
  } catch {
    return await tryFormat("deflate");
  }
}

function findEndOfCentralDirectory(view, length) {
  const min = Math.max(0, length - 22 - 0xffff);
  for (let i = length - 22; i >= min; i--) {
    if (readU32(view, i) === 0x06054b50) return i;
  }
  return -1;
}

export async function unzipArrayBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const eocd = findEndOfCentralDirectory(view, bytes.length);
  if (eocd < 0) throw new Error("Nieprawidłowy plik XLSX (brak struktury ZIP)");

  const entriesCount = readU16(view, eocd + 10);
  let cdOffset = readU32(view, eocd + 16);
  const files = {};
  const decoder = new TextDecoder("utf-8");

  for (let i = 0; i < entriesCount; i++) {
    if (readU32(view, cdOffset) !== 0x02014b50) break;

    const method = readU16(view, cdOffset + 10);
    const compSize = readU32(view, cdOffset + 20);
    const nameLen = readU16(view, cdOffset + 28);
    const extraLen = readU16(view, cdOffset + 30);
    const commentLen = readU16(view, cdOffset + 32);
    const localHeaderOffset = readU32(view, cdOffset + 42);
    const name = decoder.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen));

    if (readU32(view, localHeaderOffset) !== 0x04034b50) {
      cdOffset += 46 + nameLen + extraLen + commentLen;
      continue;
    }

    const localNameLen = readU16(view, localHeaderOffset + 26);
    const localExtraLen = readU16(view, localHeaderOffset + 28);
    const localCompSize = readU32(view, localHeaderOffset + 18);
    const flags = readU16(view, localHeaderOffset + 6);
    const size = localCompSize && !(flags & 0x8) ? localCompSize : compSize;
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressed = bytes.subarray(dataStart, dataStart + size);

    let data;
    if (size === 0 && !name.endsWith("/")) data = new Uint8Array(0);
    else if (method === 0) data = compressed;
    else if (method === 8) {
      try {
        data = await inflateRaw(compressed);
      } catch {
        cdOffset += 46 + nameLen + extraLen + commentLen;
        continue;
      }
    } else {
      cdOffset += 46 + nameLen + extraLen + commentLen;
      continue;
    }

    files[name.replace(/\\/g, "/")] = data;
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }

  return files;
}

function decodeXml(bytes) {
  if (!bytes || !bytes.length) return "";
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }
  let text = new TextDecoder("utf-8").decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

function sanitizeXml(xml) {
  return String(xml || "")
    .replace(/^\uFEFF/, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function byLocalName(root, localName) {
  if (!root) return [];
  if (typeof root.getElementsByTagNameNS === "function") {
    const all = root.getElementsByTagNameNS("*", localName);
    if (all.length) return Array.from(all);
  }
  return Array.from(root.getElementsByTagName(localName));
}

function decodeXmlEntities(s) {
  return String(s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const clean = sanitizeXml(xml);
  const doc = new DOMParser().parseFromString(clean, "application/xml");
  if (doc.querySelector("parsererror")) return parseSharedStringsRegex(clean);
  return byLocalName(doc, "si").map((si) => {
    const texts = byLocalName(si, "t");
    if (texts.length) return texts.map((t) => t.textContent || "").join("");
    return si.textContent || "";
  });
}

function parseSharedStringsRegex(xml) {
  const out = [];
  const siRe = /<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/gi;
  let m;
  while ((m = siRe.exec(xml))) {
    const chunk = m[1];
    const parts = [];
    const tRe = /<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/gi;
    let tm;
    while ((tm = tRe.exec(chunk))) parts.push(decodeXmlEntities(tm[1]));
    out.push(parts.length ? parts.join("") : decodeXmlEntities(chunk.replace(/<[^>]+>/g, "")));
  }
  return out;
}

function colLettersToIndex(letters) {
  let n = 0;
  const s = String(letters || "").toUpperCase();
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return Math.max(0, n - 1);
}

function cellRefParts(ref) {
  const m = String(ref || "").match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return null;
  return { col: colLettersToIndex(m[1]), row: Number(m[2]) - 1 };
}

function excelSerialToDateTime(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n < 30000 || n > 60000) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}:${ss}`;
}

function coerceCellValue(raw, type, sharedStrings) {
  if (type === "s") return sharedStrings[Number(raw || 0)] ?? "";
  if (raw == null) return "";
  const s = String(raw);
  if (type !== "s" && /^\d+(\.\d+)?$/.test(s)) {
    const asDate = excelSerialToDateTime(s);
    if (asDate) return asDate;
  }
  return s;
}

function readCellValue(cellEl, sharedStrings) {
  const type = cellEl.getAttribute("t") || "";
  const vNode = byLocalName(cellEl, "v")[0];
  const isNode = byLocalName(cellEl, "is")[0];

  if (type === "s" && vNode) {
    return coerceCellValue(vNode.textContent || "", "s", sharedStrings);
  }
  if (isNode) {
    const t = byLocalName(isNode, "t")[0];
    return t?.textContent || isNode.textContent || "";
  }
  if (vNode) return coerceCellValue(vNode.textContent || "", type, sharedStrings);
  return "";
}

/**
 * MT/Excel worksheets: walk <row> then <c>. Support missing c@r (column = order).
 */
function parseSheetRowsDom(xml, sharedStrings) {
  const doc = new DOMParser().parseFromString(sanitizeXml(xml), "application/xml");
  if (doc.querySelector("parsererror")) return null;

  const matrix = [];
  const rowNodes = byLocalName(doc, "row");

  if (rowNodes.length) {
    for (const rowEl of rowNodes) {
      const cells = byLocalName(rowEl, "c");
      const line = [];
      let nextCol = 0;

      for (const cell of cells) {
        const ref = cell.getAttribute("r") || "";
        const parts = cellRefParts(ref);
        const col = parts ? parts.col : nextCol;
        while (line.length < col) line.push("");
        line[col] = readCellValue(cell, sharedStrings);
        nextCol = col + 1;
      }

      if (line.some((x) => String(x).trim() !== "")) matrix.push(line);
    }
    return matrix;
  }

  // Fallback: only <c r="A1"> without row wrappers
  const rowsMap = new Map();
  for (const cell of byLocalName(doc, "c")) {
    const parts = cellRefParts(cell.getAttribute("r") || "");
    if (!parts) continue;
    if (!rowsMap.has(parts.row)) rowsMap.set(parts.row, []);
    rowsMap.get(parts.row)[parts.col] = readCellValue(cell, sharedStrings);
  }
  const maxRow = rowsMap.size ? Math.max(...rowsMap.keys()) : -1;
  for (let r = 0; r <= maxRow; r++) {
    const row = rowsMap.get(r) || [];
    const normalized = [];
    for (let c = 0; c < row.length; c++) normalized[c] = row[c] ?? "";
    if (normalized.some((x) => String(x).trim() !== "")) matrix.push(normalized);
  }
  return matrix;
}

function parseSheetRowsRegex(xml, sharedStrings) {
  const matrix = [];
  const rowRe = /<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/gi;
  let rowMatch;
  let matchedRows = false;

  while ((rowMatch = rowRe.exec(xml))) {
    matchedRows = true;
    const body = rowMatch[1] || "";
    const line = [];
    let nextCol = 0;
    const cellRe = /<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/gi;
    let cm;
    while ((cm = cellRe.exec(body))) {
      const attrs = cm[1] || "";
      const cellBody = cm[2] || "";
      const refMatch = attrs.match(/\br="([^"]+)"/i);
      const typeMatch = attrs.match(/\bt="([^"]+)"/i);
      const parts = cellRefParts(refMatch?.[1] || "");
      const col = parts ? parts.col : nextCol;
      const type = typeMatch?.[1] || "";

      let raw = "";
      const vMatch = cellBody.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/i);
      const tMatch = cellBody.match(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/i);
      if (vMatch) raw = decodeXmlEntities(vMatch[1]);
      else if (tMatch) raw = decodeXmlEntities(tMatch[1]);

      const value =
        type === "inlineStr" || (!vMatch && tMatch)
          ? raw
          : coerceCellValue(raw, type, sharedStrings);

      while (line.length < col) line.push("");
      line[col] = value;
      nextCol = col + 1;
    }
    if (line.some((x) => String(x).trim() !== "")) matrix.push(line);
  }

  if (matchedRows) return matrix;

  // No <row> — scan all cells with refs
  const rowsMap = new Map();
  const cellRe = /<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/gi;
  let m;
  while ((m = cellRe.exec(xml))) {
    const attrs = m[1] || "";
    const body = m[2] || "";
    const refMatch = attrs.match(/\br="([^"]+)"/i);
    const parts = cellRefParts(refMatch?.[1] || "");
    if (!parts) continue;
    const typeMatch = attrs.match(/\bt="([^"]+)"/i);
    const type = typeMatch?.[1] || "";
    let raw = "";
    const vMatch = body.match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/i);
    const tMatch = body.match(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/i);
    if (vMatch) raw = decodeXmlEntities(vMatch[1]);
    else if (tMatch) raw = decodeXmlEntities(tMatch[1]);
    if (!rowsMap.has(parts.row)) rowsMap.set(parts.row, []);
    rowsMap.get(parts.row)[parts.col] = coerceCellValue(raw, type, sharedStrings);
  }
  const maxRow = rowsMap.size ? Math.max(...rowsMap.keys()) : -1;
  for (let r = 0; r <= maxRow; r++) {
    const row = rowsMap.get(r) || [];
    const normalized = [];
    for (let c = 0; c < row.length; c++) normalized[c] = row[c] ?? "";
    if (normalized.some((x) => String(x).trim() !== "")) matrix.push(normalized);
  }
  return matrix;
}

function parseSheetRows(xml, sharedStrings) {
  const clean = sanitizeXml(xml);
  const fromDom = parseSheetRowsDom(clean, sharedStrings);
  if (fromDom && fromDom.length) return fromDom;

  const fromRegex = parseSheetRowsRegex(clean, sharedStrings);
  if (fromRegex.length) return fromRegex;

  if (fromDom && !fromDom.length) throw new Error("Arkusz XLSX jest pusty");
  throw new Error("Nie udało się odczytać arkusza XLSX — spróbuj zapisać raport MT jako CSV");
}

function escapeCsvCell(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsvText(rows) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function pickBestSheetPath(files) {
  const sheetPaths = Object.keys(files)
    .filter((p) => /xl\/worksheets\/[^/]+\.xml$/i.test(p) && !p.includes("_rels"))
    .sort((a, b) => {
      const na = Number((a.match(/sheet(\d+)/i) || [])[1] || 999);
      const nb = Number((b.match(/sheet(\d+)/i) || [])[1] || 999);
      return na - nb;
    });

  // Prefer sheet with most <c> / <row> content
  let best = sheetPaths[0] || null;
  let bestScore = -1;
  for (const path of sheetPaths) {
    const xml = decodeXml(files[path] || []);
    const score = (xml.match(/<(?:\w+:)?c\b/gi) || []).length + (xml.match(/<(?:\w+:)?row\b/gi) || []).length * 10;
    if (score > bestScore) {
      bestScore = score;
      best = path;
    }
  }
  return best;
}

function parseSpreadsheetMlFlat(xml) {
  const doc = new DOMParser().parseFromString(sanitizeXml(xml), "application/xml");
  const rows = byLocalName(doc, "Row");
  if (!rows.length) return parseHtmlOrXmlTables(xml);

  const matrix = [];
  for (const row of rows) {
    const cells = byLocalName(row, "Cell");
    const line = [];
    let col = 0;
    for (const cell of cells) {
      const ssIndex = cell.getAttribute("ss:Index") || cell.getAttribute("Index");
      if (ssIndex) {
        const idx = Number(ssIndex) - 1;
        while (col < idx) {
          line.push("");
          col++;
        }
      }
      const data = byLocalName(cell, "Data")[0];
      let val = data?.textContent || cell.textContent || "";
      if (data) {
        const type = data.getAttribute("ss:Type") || data.getAttribute("Type") || "";
        if (type === "DateTime" && val) {
          val = val.replace("T", " ").replace(/-/g, ".").slice(0, 19);
        }
      }
      line.push(val);
      col++;
    }
    if (line.some((x) => String(x).trim())) matrix.push(line);
  }
  return matrix;
}

function parseHtmlOrXmlTables(text) {
  const doc = new DOMParser().parseFromString(sanitizeXml(text), "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  if (!tables.length) return [];
  let best = tables[0];
  let bestRows = 0;
  for (const t of tables) {
    const n = t.querySelectorAll("tr").length;
    if (n > bestRows) {
      best = t;
      bestRows = n;
    }
  }
  return Array.from(best.querySelectorAll("tr"))
    .map((tr) => Array.from(tr.querySelectorAll("th,td")).map((td) => (td.textContent || "").trim()))
    .filter((row) => row.some((c) => c));
}

function isZipFile(bytes) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export async function xlsxArrayBufferToCsvText(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);

  if (!isZipFile(bytes)) {
    const text = decodeXml(bytes).trim();
    if (!text) throw new Error("Plik jest pusty");

    let rows = [];
    if (/<Workbook[\s>]/i.test(text) || /<Worksheet[\s>]/i.test(text)) {
      rows = parseSpreadsheetMlFlat(text);
    } else if (/<html[\s>]/i.test(text) || /<table[\s>]/i.test(text)) {
      rows = parseHtmlOrXmlTables(text);
    } else if (text.includes(",") || text.includes(";")) {
      return text;
    }

    if (!rows.length) {
      throw new Error(
        "Plik nie jest poprawnym Excel XLSX. W MT zapisz ponownie jako „Open XML (*.xlsx)” lub CSV."
      );
    }
    return rowsToCsvText(rows);
  }

  const files = await unzipArrayBuffer(arrayBuffer);
  const sheetPath = pickBestSheetPath(files);
  if (!sheetPath) {
    const xmlEntry = Object.keys(files).find((p) => p.toLowerCase().endsWith(".xml"));
    if (xmlEntry) {
      const xml = decodeXml(files[xmlEntry]);
      const rows = parseSpreadsheetMlFlat(xml);
      if (rows.length) return rowsToCsvText(rows);
    }
    throw new Error("Plik XLSX nie zawiera arkusza — zapisz raport MT jako Excel 2007 (*.xlsx) lub CSV");
  }

  const shared = parseSharedStrings(
    files["xl/sharedStrings.xml"] ? decodeXml(files["xl/sharedStrings.xml"]) : ""
  );
  const sheetXml = decodeXml(files[sheetPath]);
  if (!sheetXml || sheetXml.length < 20) {
    throw new Error("Arkusz XLSX jest uszkodzony (pusty po rozpakowaniu)");
  }

  const rows = parseSheetRows(sheetXml, shared);
  if (!rows.length) throw new Error("Arkusz XLSX jest pusty");

  return rowsToCsvText(rows);
}

export function isXlsxFileName(fileName = "") {
  const n = String(fileName || "").toLowerCase();
  return n.endsWith(".xlsx") || n.endsWith(".xlsm");
}
