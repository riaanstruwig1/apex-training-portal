import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts, type RGB } from "pdf-lib";
import sharp from "sharp";
import type { AttemptView, ExamDetail } from "@/lib/exams";
import { effectiveMarks } from "@/lib/exam-marks";
import { fmtDate, placeSignature, safeText, signatureToPng } from "./pdf-helpers";

// 28 Oct 2026 (Riaan, Herman Peacock's pack): the exam copy in the sign-off
// pack must look exactly like the original SAHPA paper -- SAHPA logo, the
// A-F marks table, the master paper's instruction text, then every question
// in its open-answer wording with ONLY the student's own answer (ticked or
// crossed). No multiple-choice options. This is the same layout as the
// marked exam Word download (src/lib/exam-print.ts, buildExamDocx), drawn as
// a PDF so it can go straight into the zip. Keep the two in step.

const W = 595.28;
const H = 841.89;
const ML = 56;
const MR = 56;
const MT = 56;
const MB = 64;
const CW = W - ML - MR;
const GREEN = rgb(0.1, 0.48, 0.23);
const RED = rgb(0.75, 0.22, 0.17);
const AMBER = rgb(0.54, 0.35, 0);
const BLACK = rgb(0, 0, 0);
const GREY = rgb(0.6, 0.6, 0.6);
const DARKRED = rgb(0.55, 0, 0);

type Seg = { text: string; font: PDFFont; size: number; color?: RGB; mark?: "tick" | "cross" };

type Fonts = { reg: PDFFont; bold: PDFFont; ital: PDFFont };

function fmtMark(n: number) {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

async function embedImage(doc: PDFDocument, file: string): Promise<PDFImage | null> {
  try {
    const buf = await readFile(file);
    const ext = file.split(".").pop()?.toLowerCase();
    if (ext === "jpg" || ext === "jpeg") return await doc.embedJpg(buf);
    if (ext === "png") return await doc.embedPng(buf);
    return await doc.embedJpg(await sharp(buf).jpeg({ quality: 90 }).toBuffer());
  } catch {
    return null;
  }
}

export async function buildSahpaExamPdf(opts: {
  studentName: string;
  exam: ExamDetail;
  attempt: AttemptView;
  /** The signing instructor's own signature, if they verified this exam. */
  verifierSignature: Buffer | null;
}): Promise<Uint8Array> {
  const { studentName, exam, attempt } = opts;
  const doc = await PDFDocument.create();
  const f: Fonts = {
    reg: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    ital: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - MT;
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - MT;
  };
  const need = (h: number) => {
    if (y - h < MB) newPage();
  };

  /** Draws rich text wrapped to the content width; returns nothing, moves y. */
  function para(segs: Seg[], o: { align?: "left" | "right" | "center"; before?: number; after?: number; indent?: number } = {}) {
    y -= o.before ?? 0;
    const maxW = CW - (o.indent ?? 0);
    // split into words keeping their style
    type Word = { text: string; seg: Seg; space: boolean };
    const words: Word[] = [];
    for (const s of segs) {
      if (s.mark) {
        words.push({ text: "XX", seg: s, space: false });
        continue;
      }
      const parts = s.text.split(/(\s+)/);
      for (const p of parts) {
        if (p === "") continue;
        if (/^\s+$/.test(p)) words.push({ text: " ", seg: s, space: true });
        else words.push({ text: safeText(p) || "?", seg: s, space: false });
      }
    }
    const lines: Word[][] = [];
    let line: Word[] = [];
    let lw = 0;
    const width = (w: Word) => w.seg.font.widthOfTextAtSize(w.text, w.seg.size);
    for (const w of words) {
      const ww = width(w);
      if (!w.space && lw + ww > maxW && line.length) {
        while (line.length && line[line.length - 1].space) line.pop();
        lines.push(line);
        line = [];
        lw = 0;
      }
      if (w.space && line.length === 0) continue;
      line.push(w);
      lw += ww;
    }
    if (line.length) lines.push(line);
    for (const ln of lines) {
      const lh = Math.max(...ln.map((w) => w.seg.size)) * 1.3;
      need(lh);
      const total = ln.reduce((a, w) => a + width(w), 0);
      let x = ML + (o.indent ?? 0);
      if (o.align === "right") x = W - MR - total;
      if (o.align === "center") x = ML + (CW - total) / 2;
      const base = y - Math.max(...ln.map((w) => w.seg.size));
      for (const w of ln) {
        if (w.seg.mark) drawMark(w.seg.mark, x, base, w.seg.size, w.seg.color ?? BLACK);
        else if (!w.space) page.drawText(w.text, { x, y: base, size: w.seg.size, font: w.seg.font, color: w.seg.color ?? BLACK });
        x += width(w);
      }
      y -= lh;
    }
    y -= o.after ?? 0;
  }

  /** Tick or cross drawn as lines (the standard PDF fonts have no ✔ / ✘). */
  function drawMark(kind: "tick" | "cross", x: number, base: number, size: number, color: RGB) {
    const s0 = size * 0.85;
    const t = Math.max(1.2, size / 7);
    if (kind === "tick") {
      page.drawLine({ start: { x: x + 1, y: base + s0 * 0.45 }, end: { x: x + s0 * 0.38, y: base + s0 * 0.1 }, thickness: t, color });
      page.drawLine({ start: { x: x + s0 * 0.38, y: base + s0 * 0.1 }, end: { x: x + s0, y: base + s0 * 0.9 }, thickness: t, color });
    } else {
      page.drawLine({ start: { x: x + 1, y: base + s0 * 0.85 }, end: { x: x + s0 * 0.85, y: base + 0.5 }, thickness: t, color });
      page.drawLine({ start: { x: x + 1, y: base + 0.5 }, end: { x: x + s0 * 0.85, y: base + s0 * 0.85 }, thickness: t, color });
    }
  }

  function hr(after = 14) {
    need(10);
    y -= 4;
    page.drawLine({ start: { x: ML, y }, end: { x: W - MR, y }, thickness: 0.75, color: GREY });
    y -= after;
  }

  function image(img: PDFImage, maxW: number) {
    const s = Math.min(1, maxW / img.width, (H - MT - MB) / img.height);
    const w = img.width * s;
    const h = img.height * s;
    need(h + 4);
    page.drawImage(img, { x: ML, y: y - h, width: w, height: h });
    y -= h + 6;
  }

  const sahpa = exam.category === "pg" || exam.category === "ppg" || exam.category === "ppt";
  const S = 11;

  // ---- Cover ----
  if (sahpa) {
    const logo = await embedImage(doc, path.join(process.cwd(), "public", "exam-media", "_branding", "sahpa-logo.png"));
    if (logo) {
      const w = 112;
      const h = (logo.height / logo.width) * w;
      page.drawImage(logo, { x: ML + (CW - w) / 2, y: y - h, width: w, height: h });
      y -= h + 14;
    }
  }
  const field = (label: string, value: string) =>
    para([{ text: `${label}: `, font: f.bold, size: S }, { text: value, font: f.reg, size: S }], { after: 5 });
  field("Student Name", studentName);
  field("Date Exam written", fmtDate(attempt.submittedAt));
  field("Instructor name", attempt.verifiedByName ?? "");
  const sigTop = y;
  field("Instructor Signature", "");
  if (opts.verifierSignature) {
    try {
      const png = await signatureToPng(opts.verifierSignature);
      const lw = f.bold.widthOfTextAtSize("Instructor Signature: ", S);
      await placeSignature(
        doc,
        page,
        { regular: f.reg, bold: f.bold },
        png,
        { x0: ML + lw, x1: ML + lw + 170, y0: H - sigTop - 16, y1: H - sigTop + 20 },
        `Digitally signed by ${attempt.verifiedByName ?? "instructor"} - ${fmtDate(attempt.verifiedAt)}`
      );
      y -= 18;
    } catch {
      /* leave the line blank */
    }
  }
  field("Date Marked", fmtDate(attempt.verifiedAt));
  hr();

  // Marks: section letters over earned/available, like the master paper.
  const sectionEarned = exam.sections.map((s) => s.questions.reduce((sum, q) => sum + effectiveMarks(q), 0));
  const grandEarned = sectionEarned.reduce((a, b) => a + b, 0);
  const grandTotal = exam.totalMarks;
  const percent = grandTotal > 0 ? (grandEarned / grandTotal) * 100 : 0;
  para([{ text: "MARKS", font: f.bold, size: S }], { after: 6 });
  page.drawLine({ start: { x: ML, y: y + 4 }, end: { x: ML + f.bold.widthOfTextAtSize("MARKS", S), y: y + 4 }, thickness: 0.6, color: BLACK });
  if (sahpa) {
    const colW = 40;
    const cols = exam.sections.length;
    const xs = (i: number) => ML + i * colW;
    const centre = (t: string, font: PDFFont, x: number, w: number, yy: number) =>
      page.drawText(safeText(t), { x: x + (w - font.widthOfTextAtSize(safeText(t), S)) / 2, y: yy, size: S, font });
    need(60);
    const r1 = y - S;
    exam.sections.forEach((s, i) => centre(s.code, f.bold, xs(i), colW, r1));
    const r2 = r1 - 18;
    sectionEarned.forEach((v, i) => centre(fmtMark(v), f.reg, xs(i), colW, r2));
    centre(`= ${fmtMark(grandEarned)}`, f.bold, xs(cols), 115, r2);
    centre(`= ${percent.toFixed(1)} %`, f.bold, xs(cols) + 115, 60, r2);
    page.drawLine({ start: { x: ML, y: r2 - 5 }, end: { x: xs(cols) + 175, y: r2 - 5 }, thickness: 0.8, color: BLACK });
    const r3 = r2 - 20;
    exam.sections.forEach((s, i) => centre(fmtMark(s.totalMarks), f.reg, xs(i), colW, r3));
    page.drawText(fmtMark(grandTotal), { x: xs(cols) + 4, y: r3, size: S, font: f.reg });
    page.drawText(`Pass Mark = ${exam.passPercent}%`, {
      x: xs(cols) + 8 + f.reg.widthOfTextAtSize(fmtMark(grandTotal), S) + 10,
      y: r3,
      size: 9,
      font: f.ital,
    });
    y = r3 - 12;
  } else {
    para(
      [
        { text: `${fmtMark(grandEarned)} / ${fmtMark(grandTotal)}`, font: f.bold, size: 14 },
        { text: `   (${percent.toFixed(1)}%)   `, font: f.bold, size: 14 },
        { text: `Pass mark: ${exam.passPercent}%`, font: f.ital, size: 9 },
      ],
      { after: 4 }
    );
  }
  const passed = attempt.passed;
  para(
    [
      { text: "Result: ", font: f.bold, size: S },
      { text: passed ? "PASS" : "FAIL", font: f.bold, size: S, color: passed ? GREEN : RED },
      ...(attempt.resultOverride
        ? [{ text: `  (final result set by the CFI${attempt.resultOverrideNote ? `: ${attempt.resultOverrideNote}` : ""})`, font: f.ital, size: S }]
        : []),
      ...(sahpa && !attempt.mustPassSectionsOk && !attempt.resultOverride
        ? [{ text: "  (not every Airlaw question was correct -- those must all be right to pass)", font: f.ital, size: S }]
        : []),
    ],
    { before: 8, after: 16 }
  );
  para([{ text: exam.title.toUpperCase(), font: f.bold, size: 24 }], { after: 2 });
  if (exam.subtitle) para([{ text: exam.subtitle, font: f.reg, size: 10 }], { after: 12 });

  // Verbatim from each exam's own master paper (same text as exam-print.ts).
  const t = (text: string, after = 3, bold = false) => para([{ text, font: bold ? f.bold : f.reg, size: S }], { after });
  if (exam.category === "pg") {
    t("You are encouraged to complete this paper as soon as convenient, during or after your course, whilst all information is still fresh in your mind.", 5);
    t("All 'airlaw' questions to be passed.", 12, true);
    t("NOTE: This is an open book research examination. Please answer concisely. The test answers must be your own effort and should not be copied from others!");
    t("Draw sketches where required (distinguish between describe and/or illustrate).");
    t("Where sketches are provided, write/draw answers on them.");
    t("The test can be completed online and then printed to finish the drawings/illustrations and hard copy to be submitted to your instructor.", 14);
  } else if (exam.category === "ppg" || exam.category === "ppt") {
    t("You are encouraged to complete this paper as soon as convenient, after or during your course, whilst all information is still fresh in your mind.", 5);
    t("Air law questions to be passed, 100%", 12, true);
    t("NOTE: This is an open book research examination. Please answer concisely. The test answers must be your own effort, and should not be copied from others!");
    t("Draw sketches where required (distinguish between describe and/or illustrate).");
    t("Where sketches are provided, write answers on them.");
    t("All Answers must be typed out, NO handwritten Answers and must be in English.", 14);
  } else {
    para([{ text: "Printed record of a completed online exam, for the training file.", font: f.ital, size: S }], { after: 14 });
  }

  // ---- Questions: open-answer wording, the student's own answer only ----
  const mediaDir = path.join(process.cwd(), "public", "exam-media", exam.slug);
  for (const [si, section] of exam.sections.entries()) {
    if (si === 0) newPage();
    para([{ text: `SECTION ${section.code}: ${section.name}`, font: f.bold, size: 13 }], { before: si === 0 ? 0 : 10, after: 8 });
    for (const q of section.questions) {
      const selected = q.options.find((o) => o.id === q.selectedOptionId);
      const got = effectiveMarks(q);
      const ok = got >= q.marks;
      const num = q.code.replace(/^[A-F]\./, "");
      need(40);
      para(
        [
          { text: `${num}. `, font: f.bold, size: S },
          { text: q.printPrompt ?? q.prompt, font: f.reg, size: S },
          { text: `  (${q.marks} mk)`, font: f.ital, size: S },
        ],
        { before: 8, after: 3 }
      );
      if (q.stemImage) {
        const img = await embedImage(doc, path.join(mediaDir, q.stemImage));
        if (img) image(img, 270);
      }
      const mark: Seg = { text: "", font: f.bold, size: S, color: ok ? GREEN : RED, mark: ok ? "tick" : "cross" };
      if (selected?.image) {
        para([{ text: "Answer:  ", font: f.reg, size: S }, mark], { before: 2, after: 2 });
        const img = await embedImage(doc, path.join(mediaDir, selected.image));
        if (img) image(img, 270);
      } else {
        para(
          [
            { text: "Answer: ", font: f.bold, size: S },
            { text: selected ? selected.text ?? "" : "(no answer)", font: f.reg, size: S },
            { text: "  ", font: f.reg, size: S },
            mark,
          ],
          { before: 2, after: 2 }
        );
      }
      if (q.awardedMarks !== null || q.staffNote || q.answerChanged) {
        const orig = q.options.find((o) => o.id === q.originalOptionId);
        para(
          [
            ...(q.answerChanged
              ? [{ text: `Answer corrected by instructor (student's answer: ${orig ? orig.text ?? orig.label : "none"}). `, font: f.bold, size: 10, color: AMBER }]
              : []),
            ...(q.awardedMarks !== null ? [{ text: `Mark corrected: ${fmtMark(got)} / ${q.marks}. `, font: f.bold, size: 10, color: AMBER }] : []),
            ...(q.staffNote ? [{ text: `Instructor note: ${q.staffNote}`, font: f.ital, size: 10 }] : []),
          ],
          { after: 2 }
        );
      }
    }
    para([{ text: `Section Total: ${fmtMark(sectionEarned[si])} / ${fmtMark(section.totalMarks)}`, font: f.bold, size: S }], {
      align: "right",
      before: 8,
      after: 2,
    });
    hr(10);
  }
  para([{ text: `Grand Total: ${fmtMark(grandEarned)} / ${fmtMark(grandTotal)}  (${percent.toFixed(1)}%)`, font: f.bold, size: 13 }], {
    align: "right",
    before: 4,
  });

  // Footer on every page: dark red rule + "Page n" on the right, as in the Word copy.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: ML, y: 40 }, end: { x: W - MR, y: 40 }, thickness: 1, color: DARKRED });
    const label = `Page ${i + 1}`;
    p.drawText(label, { x: W - MR - f.reg.widthOfTextAtSize(label, 9), y: 28, size: 9, font: f.reg });
  });
  return doc.save();
}
