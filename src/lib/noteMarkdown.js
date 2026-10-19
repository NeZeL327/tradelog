/** Trade-note markdown helpers. Notes stay a plain string. No I/O. */

const BULLET_RE = /^(\s*)([-*+])\s+(.*)$/;
const ORDERED_RE = /^(\s*)(\d+)\.\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+/;
const QUOTE_RE = /^(\s*)>\s?/;

export function normalizeNoteNewlines(raw) {
  return String(raw ?? "").replace(/\r\n/g, "\n");
}

export function stripNoteMarkdown(raw) {
  let text = normalizeNoteNewlines(raw);
  text = text.replace(/<u>([\s\S]*?)<\/u>/gi, "$1");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^(\s*)>\s?/gm, "$1");
  text = text.replace(/^(\s*)[-*+]\s+/gm, "$1");
  text = text.replace(/^(\s*)\d+\.\s+/gm, "$1");
  text = text.replace(/(\*\*|__)([\s\S]*?)\1/g, "$2");
  text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  return text;
}

export function firstNoteLine(raw) {
  const text = stripNoteMarkdown(raw).trim();
  if (!text) return "";
  return text.split("\n")[0];
}

export function clipboardPlainText(data, html = "") {
  const plain = normalizeNoteNewlines(data).replace(/\u00a0/g, " ");
  if (plain) return plain;
  if (!html) return "";
  return normalizeNoteNewlines(String(html))
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, " ");
}

/** Single newline → markdown hard break so old notes keep line wrapping. */
export function toMarkdownWithBreaks(raw) {
  return normalizeNoteNewlines(raw).replace(/([^\n])\n(?!\n)/g, "$1  \n");
}

export function lineBounds(value, index) {
  const start = value.lastIndexOf("\n", index - 1) + 1;
  const nl = value.indexOf("\n", index);
  const end = nl === -1 ? value.length : nl;
  return { start, end };
}

export function insertAt(value, start, end, chunk) {
  const next = value.slice(0, start) + chunk + value.slice(end);
  const caret = start + chunk.length;
  return { value: next, start: caret, end: caret };
}

function hasWrap(value, start, end, marker) {
  if (start === end) {
    const before = value.slice(Math.max(0, start - marker.length), start);
    const after = value.slice(end, end + marker.length);
    if (marker === "*" && (before === "**" || after === "**")) return false;
    return before === marker && after === marker;
  }
  const selected = value.slice(start, end);
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
    if (marker === "*" && selected.startsWith("**")) return false;
    return true;
  }
  const before = value.slice(Math.max(0, start - marker.length), start);
  const after = value.slice(end, end + marker.length);
  if (marker === "*" && (before.endsWith("**") || after.startsWith("**"))) return false;
  return before === marker && after === marker;
}

export function wrapInline(value, start, end, marker) {
  if (hasWrap(value, start, end, marker)) {
    if (start !== end && value.slice(start, end).startsWith(marker)) {
      const inner = value.slice(start + marker.length, end - marker.length);
      return {
        value: value.slice(0, start) + inner + value.slice(end),
        start,
        end: start + inner.length,
      };
    }
    return {
      value: value.slice(0, start - marker.length) + value.slice(start, end) + value.slice(end + marker.length),
      start: start - marker.length,
      end: end - marker.length,
    };
  }
  const selected = value.slice(start, end);
  return {
    value: value.slice(0, start) + marker + selected + marker + value.slice(end),
    start: start + marker.length,
    end: end + marker.length,
  };
}

function toggleLinePrefix(value, start, end, test, addPrefix, strip) {
  const bounds = lineBounds(value, start);
  const line = value.slice(bounds.start, bounds.end);
  const nextLine = test(line) ? strip(line) : addPrefix(line);
  const delta = nextLine.length - line.length;
  return {
    value: value.slice(0, bounds.start) + nextLine + value.slice(bounds.end),
    start: Math.max(bounds.start, start + delta),
    end: Math.max(bounds.start, end + delta),
  };
}

export function toggleHeading(value, start, end) {
  return toggleLinePrefix(
    value,
    start,
    end,
    (line) => HEADING_RE.test(line),
    (line) => `### ${line.replace(HEADING_RE, "")}`,
    (line) => line.replace(HEADING_RE, "")
  );
}

export function toggleQuote(value, start, end) {
  return toggleLinePrefix(
    value,
    start,
    end,
    (line) => QUOTE_RE.test(line),
    (line) => `> ${line.replace(QUOTE_RE, "")}`,
    (line) => line.replace(QUOTE_RE, "")
  );
}

function mapSelectedLines(value, start, end, mapLine) {
  const from = lineBounds(value, start).start;
  const to = lineBounds(value, Math.max(start, end - (end > start ? 1 : 0))).end;
  const chunk = value.slice(from, to);
  const lines = chunk.split("\n").map(mapLine);
  const nextChunk = lines.join("\n");
  return {
    value: value.slice(0, from) + nextChunk + value.slice(to),
    start: from,
    end: from + nextChunk.length,
  };
}

export function toggleBulletList(value, start, end) {
  const sample = value.slice(lineBounds(value, start).start, lineBounds(value, start).end);
  const on = BULLET_RE.test(sample);
  return mapSelectedLines(value, start, end, (line) => {
    if (on) return line.replace(BULLET_RE, "$1$3");
    if (ORDERED_RE.test(line)) return line.replace(ORDERED_RE, "$1- $3");
    if (!line.trim()) return line;
    return `- ${line.replace(/^\s+/, "")}`;
  });
}

export function toggleNumberedList(value, start, end) {
  const sample = value.slice(lineBounds(value, start).start, lineBounds(value, start).end);
  const on = ORDERED_RE.test(sample);
  let n = 1;
  return mapSelectedLines(value, start, end, (line) => {
    if (on) return line.replace(ORDERED_RE, "$1$3");
    if (BULLET_RE.test(line)) return line.replace(BULLET_RE, `$1${n++}. $3`);
    if (!line.trim()) return line;
    return `${n++}. ${line.replace(/^\s+/, "")}`;
  });
}

export function clearNoteFormatting(value, start, end) {
  if (start === end) {
    const bounds = lineBounds(value, start);
    const cleaned = stripNoteMarkdown(value.slice(bounds.start, bounds.end));
    return {
      value: value.slice(0, bounds.start) + cleaned + value.slice(bounds.end),
      start: bounds.start,
      end: bounds.start + cleaned.length,
    };
  }
  const cleaned = stripNoteMarkdown(value.slice(start, end));
  return {
    value: value.slice(0, start) + cleaned + value.slice(end),
    start,
    end: start + cleaned.length,
  };
}

export function selectionFormats(value, start, end) {
  const line = value.slice(lineBounds(value, start).start, lineBounds(value, start).end);
  return {
    bold: hasWrap(value, start, end, "**"),
    italic: hasWrap(value, start, end, "*"),
    heading: HEADING_RE.test(line),
    quote: QUOTE_RE.test(line),
    bullet: BULLET_RE.test(line),
    numbered: ORDERED_RE.test(line),
  };
}

export function applyNoteEnter(value, start, end) {
  if (start !== end) return insertAt(value, start, end, "\n");
  const { start: lineStart } = lineBounds(value, start);
  const line = value.slice(lineStart, start);
  const ordered = line.match(ORDERED_RE);
  const bullet = line.match(BULLET_RE);
  const match = ordered || bullet;
  if (!match) return insertAt(value, start, end, "\n");

  const indent = match[1];
  const body = match[3];
  if (!String(body || "").trim()) {
    return {
      value: value.slice(0, lineStart) + value.slice(start),
      start: lineStart,
      end: lineStart,
    };
  }
  const nextMarker = ordered ? `${Number(ordered[2]) + 1}.` : match[2];
  return insertAt(value, start, end, `\n${indent}${nextMarker} `);
}

export function applyNoteTab(value, start, end, shift = false) {
  const { start: lineStart, end: lineEnd } = lineBounds(value, start);
  const line = value.slice(lineStart, lineEnd);
  if (!BULLET_RE.test(line) && !ORDERED_RE.test(line)) return null;
  if (shift) {
    if (!line.startsWith("  ")) return { value, start, end };
    return {
      value: value.slice(0, lineStart) + line.slice(2) + value.slice(lineEnd),
      start: Math.max(lineStart, start - 2),
      end: Math.max(lineStart, end - 2),
    };
  }
  return {
    value: value.slice(0, lineStart) + `  ${line}` + value.slice(lineEnd),
    start: start + 2,
    end: end + 2,
  };
}

export function safeMarkdownHref(href) {
  const url = String(href || "").trim();
  if (/^https?:\/\//i.test(url)) return url;
  return null;
}
