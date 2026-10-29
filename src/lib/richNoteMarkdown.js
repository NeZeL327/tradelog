/**
 * Konwersja notatek transakcji: Markdown (format zapisu) <-> edytor Tiptap.
 * Notatki dalej zapisujemy jako zwykły string Markdown, żeby wszystkie
 * istniejące widoki (NoteMarkdownView, stripNoteMarkdown, eksport) działały.
 */
import { MarkdownSerializer, defaultMarkdownParser, defaultMarkdownSerializer } from "@tiptap/pm/markdown";
import { toMarkdownWithBreaks } from "@/lib/noteMarkdown";

const md = defaultMarkdownParser.tokenizer;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Markdown -> HTML dla edytora. Zwykły tekst (stare notatki) zachowuje łamanie linii. */
export function noteMarkdownToHtml(raw) {
  const source = String(raw ?? "");
  if (!source.trim()) return "";
  let html = md.render(toMarkdownWithBreaks(source));
  // <u> jest jedynym tagiem HTML, który dopuszczamy w notatkach (podkreślenie).
  html = html.replace(/&lt;u&gt;/g, "<u>").replace(/&lt;\/u&gt;/g, "</u>");
  return html;
}

const base = defaultMarkdownSerializer.nodes;

const serializer = new MarkdownSerializer(
  {
    doc: (state, node) => state.renderContent(node),
    paragraph: base.paragraph,
    text: base.text,
    blockquote: base.blockquote,
    heading: (state, node) => {
      state.write(`${"#".repeat(node.attrs.level || 3)} `);
      state.renderInline(node, false);
      state.closeBlock(node);
    },
    bulletList: (state, node) => state.renderList(node, "  ", () => "- "),
    orderedList: (state, node) => {
      const start = node.attrs.start ?? 1;
      state.renderList(node, "   ", (i) => `${start + i}. `);
    },
    listItem: (state, node) => state.renderContent(node),
    hardBreak: (state, node, parent, index) => {
      for (let i = index + 1; i < parent.childCount; i += 1) {
        if (parent.child(i).type !== node.type) {
          state.write("  \n");
          return;
        }
      }
    },
  },
  {
    bold: { open: "**", close: "**", mixable: true, expelEnclosingWhitespace: true },
    italic: { open: "*", close: "*", mixable: true, expelEnclosingWhitespace: true },
    underline: { open: "<u>", close: "</u>", mixable: true, expelEnclosingWhitespace: true },
    link: defaultMarkdownSerializer.marks.link,
  }
);

/** Dokument edytora -> Markdown. */
export function editorDocToMarkdown(doc) {
  if (!doc || doc.textContent.trim() === "") return "";
  return serializer.serialize(doc, { tightLists: true }).trim();
}

export { escapeHtml };
