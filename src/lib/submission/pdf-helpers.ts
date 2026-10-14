import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";

// Shared drawing helpers for the SAHPA/CAA submission pack (batch 61).
// All coordinates are in PDF points measured from the TOP-LEFT of the page
// (what you see on screen), converted to pdf-lib's bottom-left origin here.

export type Cell = { x0: number; x1: number; y0: number; y1: number };

export const INK = rgb(0.05, 0.1, 0.45); // dark blue "pen" so filled-in data is distinguishable from the printed form
export const NOTE_GREY = rgb(0.35, 0.35, 0.35);

export type Fonts = { regular: PDFFont; bold: PDFFont };

export async function loadFonts(doc: PDFDocument): Promise<Fonts> {
  return {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
}

// Standard PDF fonts only cover WinAnsi (Latin-1 plus a few). Strip anything
// outside it so a name like "Śliwa" prints as "Sliwa" instead of crashing.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split(""));
export function safeText(input: string | null | undefined): string {
  if (!input) return "";
  let out = "";
  for (const ch of input.replace(/[\r\n\t]+/g, " ")) {
    const code = ch.codePointAt(0)!;
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255) || WIN_ANSI_EXTRA.has(ch)) {
      out += ch;
      continue;
    }
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    out += base.length === 1 && base.charCodeAt(0) < 256 && base.charCodeAt(0) >= 32 ? base : "?";
  }
  return out.replace(/ {2,}/g, " ").trim();
}

/** dd/mm/yyyy in South African time -- how the paper forms are filled in. */
export function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function fitSize(font: PDFFont, text: string, maxWidth: number, maxSize: number, minSize = 5): number {
  let size = maxSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.25;
  return size;
}

/** Draws text inside a cell: left aligned (or centred), vertically centred,
 * shrunk to fit the cell width (never wrapped). */
export function cellText(
  page: PDFPage,
  fonts: Fonts,
  textIn: string | null | undefined,
  cell: Cell,
  opts: { size?: number; minSize?: number; align?: "left" | "center"; bold?: boolean; pad?: number; dy?: number } = {}
) {
  const text = safeText(textIn);
  if (!text) return;
  const font = opts.bold ? fonts.bold : fonts.regular;
  const pad = opts.pad ?? 3;
  const maxW = cell.x1 - cell.x0 - pad * 2;
  const size = fitSize(font, text, maxW, opts.size ?? 9, opts.minSize ?? 5);
  const w = font.widthOfTextAtSize(text, size);
  const x = opts.align === "center" ? cell.x0 + (cell.x1 - cell.x0 - w) / 2 : cell.x0 + pad;
  // baseline: vertically centre the x-height band
  const yTop = cell.y0 + (cell.y1 - cell.y0) / 2 + size * 0.35 + (opts.dy ?? 0);
  page.drawText(text, { x, y: page.getHeight() - yTop, size, font, color: INK });
}

/** Wraps text over up to `maxLines` lines inside a cell (used for long
 * addresses / "details of application"). Shrinks the font until it fits. */
export function cellParagraph(
  page: PDFPage,
  fonts: Fonts,
  textIn: string | null | undefined,
  cell: Cell,
  opts: { size?: number; minSize?: number; maxLines?: number; pad?: number } = {}
) {
  const text = safeText(textIn);
  if (!text) return;
  const font = fonts.regular;
  const pad = opts.pad ?? 3;
  const maxW = cell.x1 - cell.x0 - pad * 2;
  const maxLines = opts.maxLines ?? 2;
  let size = opts.size ?? 8;
  const minSize = opts.minSize ?? 5;
  let lines: string[] = [];
  for (;;) {
    lines = wrap(font, text, maxW, size);
    if (lines.length <= maxLines || size <= minSize) break;
    size -= 0.25;
  }
  lines = lines.slice(0, maxLines);
  const lineH = size * 1.15;
  const blockH = lineH * lines.length;
  let yTop = cell.y0 + (cell.y1 - cell.y0 - blockH) / 2 + size * 0.85;
  for (const ln of lines) {
    page.drawText(ln, { x: cell.x0 + pad, y: page.getHeight() - yTop, size, font, color: INK });
    yTop += lineH;
  }
}

function wrap(font: PDFFont, text: string, maxW: number, size: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(next, size) <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** A tick: bold X centred in the cell. */
export function tick(page: PDFPage, fonts: Fonts, cell: Cell, size = 11) {
  const w = fonts.bold.widthOfTextAtSize("X", size);
  const cx = (cell.x0 + cell.x1) / 2;
  const cy = (cell.y0 + cell.y1) / 2;
  page.drawText("X", { x: cx - w / 2, y: page.getHeight() - (cy + size * 0.36), size, font: fonts.bold, color: INK });
}

/** Circles a printed word (skill-test grades) with an ellipse. */
export function circleCell(page: PDFPage, cell: Cell) {
  const cx = (cell.x0 + cell.x1) / 2;
  const cy = (cell.y0 + cell.y1) / 2;
  page.drawEllipse({
    x: cx,
    y: page.getHeight() - cy,
    xScale: (cell.x1 - cell.x0) / 2 - 1.5,
    yScale: (cell.y1 - cell.y0) / 2 - 1,
    borderColor: INK,
    borderWidth: 1.1,
  });
}

/** Normalises any uploaded signature/photo (png/jpg/webp/heic-converted jpg)
 * to a size-limited PNG that pdf-lib can embed. */
export async function signatureToPng(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes)
    .rotate()
    .resize({ width: 700, height: 300, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

/**
 * Places a signature image in a box, plus the small "Digitally signed" note
 * underneath. The note is ALWAYS drawn with a signature (Riaan, 14 Oct 2026:
 * "added to form with small note, digitally signed").
 */
export async function placeSignature(
  doc: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  pngBytes: Buffer,
  box: Cell,
  note: string
) {
  const img = await doc.embedPng(pngBytes);
  const boxW = box.x1 - box.x0;
  const boxH = box.y1 - box.y0;
  const noteSize = Math.min(5.5, Math.max(4, boxH * 0.28));
  const reserve = noteSize + 2;
  const availH = Math.max(6, boxH - reserve - 2);
  const availW = boxW - 6;
  const scale = Math.min(availW / img.width, availH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = box.x0 + (boxW - w) / 2;
  const yTopOfImg = box.y0 + 1 + (availH - h) / 2;
  page.drawImage(img, { x, y: page.getHeight() - (yTopOfImg + h), width: w, height: h });
  const text = safeText(note);
  const size = fitSize(fonts.regular, text, boxW - 4, noteSize, 3.5);
  const tw = fonts.regular.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: box.x0 + (boxW - tw) / 2,
    y: page.getHeight() - (box.y1 - 1.5),
    size,
    font: fonts.regular,
    color: NOTE_GREY,
  });
}

export function drawFooterNote(page: PDFPage, fonts: Fonts, text: string, y = 14) {
  const t = safeText(text);
  page.drawText(t, { x: 40, y, size: 6.5, font: fonts.regular, color: NOTE_GREY });
}
