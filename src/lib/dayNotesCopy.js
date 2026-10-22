import { stripNoteMarkdown } from "./noteMarkdown.js";

export function buildDayNotesCopy({
  title,
  dateLabel,
  countLabel,
  sections = [],
  emptyNote,
  scoreLabel,
  scoreValue,
  tags = [],
}) {
  const blocks = [];
  const head = [title, dateLabel, countLabel].filter(Boolean);
  if (head.length) blocks.push(head.join("\n"));

  sections.forEach((row) => {
    const meta = [row.symbol, row.direction, row.time, row.result].filter(Boolean).join(" · ");
    const body = String(row.notes || "").trim()
      ? stripNoteMarkdown(row.notes).trim()
      : String(emptyNote || "");
    blocks.push([meta, body].filter(Boolean).join("\n"));
  });

  const foot = [];
  if (scoreValue) foot.push(`${String(scoreLabel || "").toUpperCase()}: ${scoreValue}`);
  if (tags.length) {
    const names = tags.map((entry) => entry?.tag).filter(Boolean);
    if (names.length) foot.push(names.join(" · "));
  }
  if (foot.length) blocks.push(foot.join("\n"));
  return blocks.join("\n\n").trim();
}
