import mammoth from "mammoth";
import * as XLSX from "xlsx";

/**
 * Turning uploaded files into something the model can read.
 *
 * Two routes. Text-bearing formats are extracted here on the server, so the
 * model sees clean prose instead of base64. PDFs and images go through as
 * native blocks, because the model reads those better than any extractor —
 * a scanned page or a screenshot of a whiteboard is genuinely visual.
 *
 * Spreadsheets matter more than they look: onboarding trackers live in Excel,
 * and a tracker tells you what is already done. That is the difference between
 * a journey that starts at zero and one that starts where the customer actually is.
 */

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_FILES = 8;
export const MAX_TOTAL_CHARS = 220_000;
export const MAX_CHARS_PER_FILE = 90_000;

const EXT = (name) => (String(name || "").match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();

const TEXTUAL = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "log", "vtt", "srt", "eml", "rtf", "html", "htm", "xml", "yaml", "yml",
]);
const IMAGES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
const SHEETS = new Set(["xlsx", "xls", "xlsm", "ods"]);

export function classifyFile(name) {
  const e = EXT(name);
  if (e === "pdf") return "pdf";
  if (e === "docx" || e === "doc") return "docx";
  if (SHEETS.has(e)) return "sheet";
  if (IMAGES[e]) return "image";
  if (TEXTUAL.has(e)) return "text";
  return null;
}

export const imageMediaType = (name) => IMAGES[EXT(name)] || "image/jpeg";

export const SUPPORTED_LABEL =
  "PDF, Word, Excel, PowerPoint notes, text, CSV, subtitles, email, and screenshots";

/** Subtitle and email formats carry noise that costs tokens and teaches nothing. */
function tidy(text, kind) {
  let t = String(text || "");
  if (kind === "vtt" || kind === "srt") {
    t = t
      .replace(/^WEBVTT.*$/gm, "")
      .replace(/^\d+$/gm, "")
      .replace(/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->.*$/gm, "");
  }
  if (kind === "html" || kind === "htm" || kind === "xml") {
    t = t.replace(/<script[\s\S]*?<\/script>/gi, "")
         .replace(/<style[\s\S]*?<\/style>/gi, "")
         .replace(/<[^>]+>/g, " ");
  }
  return t.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Flatten a workbook to text, one section per sheet. Empty rows and columns are
 * dropped — a tracker is usually a small island of data in a large grid, and the
 * blank space is pure noise.
 */
function readSheet(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const out = [];

  for (const name of wb.SheetNames.slice(0, 12)) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false, defval: "" });
    if (!rows.length) continue;

    const lines = rows
      .map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : String(c ?? "").trim())))
      .filter((r) => r.some(Boolean))
      .map((r) => {
        while (r.length && !r[r.length - 1]) r.pop();
        return r.join(" | ");
      })
      .slice(0, 400);

    if (lines.length) out.push("## Sheet: " + name + "\n" + lines.join("\n"));
  }
  return out.join("\n\n");
}

/**
 * Read one file into message content blocks.
 * Returns { blocks, text, note } — `text` is what gets stored in the corpus,
 * `note` explains anything a human should know about how it was read.
 */
export async function readFile({ name, kind, content }) {
  const k = kind || classifyFile(name);

  if (k === "pdf") {
    return {
      blocks: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: content } }],
      text: null,
      note: null,
    };
  }

  if (k === "image") {
    return {
      blocks: [{ type: "image", source: { type: "base64", media_type: imageMediaType(name), data: content } }],
      text: null,
      note: null,
    };
  }

  if (k === "docx") {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(content, "base64") });
    const text = tidy(value).slice(0, MAX_CHARS_PER_FILE);
    if (!text) throw new Error(name + " appears to be empty.");
    return { blocks: [{ type: "text", text: "### " + name + "\n\n" + text }], text, note: null };
  }

  if (k === "sheet") {
    const text = readSheet(Buffer.from(content, "base64")).slice(0, MAX_CHARS_PER_FILE);
    if (!text) throw new Error(name + " has no readable rows.");
    return {
      blocks: [{ type: "text", text: "### " + name + " (spreadsheet)\n\n" + text }],
      text,
      note: "Read as a grid — if this is a tracker, ticked rows become completed steps.",
    };
  }

  const text = tidy(content, EXT(name)).slice(0, MAX_CHARS_PER_FILE);
  if (!text) throw new Error(name + " is empty.");
  return { blocks: [{ type: "text", text: "### " + name + "\n\n" + text }], text, note: null };
}

/**
 * Read several files into one message. Order is preserved so the model can be
 * told what it is looking at, and the total is capped so one enormous file
 * cannot crowd out the others.
 */
export async function readFiles(files) {
  const list = (Array.isArray(files) ? files : []).slice(0, MAX_FILES);
  if (!list.length) throw new Error("Nothing to read.");

  const blocks = [];
  const manifest = [];
  const stored = [];
  let budget = MAX_TOTAL_CHARS;

  for (const f of list) {
    const k = f.kind || classifyFile(f.name);
    if (!k) {
      manifest.push({ name: f.name, ok: false, reason: "unsupported format" });
      continue;
    }
    try {
      const { blocks: b, text, note } = await readFile({ ...f, kind: k });

      if (text != null) {
        if (text.length > budget) {
          const trimmed = text.slice(0, Math.max(0, budget));
          if (!trimmed) {
            manifest.push({ name: f.name, ok: false, reason: "no room left after earlier files" });
            continue;
          }
          blocks.push({ type: "text", text: "### " + f.name + " (truncated)\n\n" + trimmed });
          stored.push({ name: f.name, kind: k, text: trimmed });
          budget = 0;
          manifest.push({ name: f.name, ok: true, kind: k, truncated: true, note });
          continue;
        }
        budget -= text.length;
        stored.push({ name: f.name, kind: k, text });
      }

      blocks.push(...b);
      manifest.push({ name: f.name, ok: true, kind: k, note });
    } catch (e) {
      manifest.push({ name: f.name, ok: false, reason: e.message || "could not be read" });
    }
  }

  if (!blocks.length) throw new Error("None of those files could be read.");

  const readable = manifest.filter((m) => m.ok);
  const header =
    readable.length > 1
      ? "You have been given " + readable.length + " documents about the same customer: " +
        readable.map((m) => m.name).join(", ") +
        ". Read all of them together. Where they disagree, later or more specific documents win, and a spreadsheet tracker is more reliable about what is already done than prose is.\n\n"
      : "";

  return { blocks, manifest, stored, header };
}
