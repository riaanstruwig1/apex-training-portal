import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import { INK, NOTE_GREY, fmtDate, loadFonts, placeSignature, safeText, signatureToPng } from "./pdf-helpers";
import { ExamCopyData } from "./types";

// Copy of a passed exam for the SAHPA/CAA pack: result, pass mark, who
// verified it, and every question with the student's answer. A4 portrait.

const W = 595.28;
const H = 841.89;
const M = 40;

function wrap(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of safeText(text).split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        out.push(line);
        line = word;
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

const fm = (n: number) => String(Math.round(n * 100) / 100);

export async function buildExamCopyPdf(e: ExamCopyData, student: { name: string; apexNumber: string | null }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const f = await loadFonts(doc);
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const need = (h: number) => {
    if (y - h < M + 14) newPage();
  };
  const text = (t: string, size = 9, bold = false, color = rgb(0.1, 0.1, 0.1), x = M) => {
    page.drawText(safeText(t), { x, y, size, font: bold ? f.bold : f.regular, color });
    y -= size + 4;
  };

  text("EXAMINATION RECORD - COPY FOR SAHPA / CAA SUBMISSION", 13, true, rgb(0, 0, 0));
  y -= 4;
  text(e.title, 12, true);
  text(`Candidate: ${student.name}${student.apexNumber ? "   Apex No. " + student.apexNumber : ""}`, 10);
  text(`Attempt ${e.attemptNumber} (${e.source === "paper" ? "paper exam / held licence" : "online exam"}) - verified ${fmtDate(e.verifiedAt)}`, 10);
  const pct = e.scorePercent !== null ? `${e.scorePercent.toFixed(1)}%` : "n/a";
  text(`Score: ${e.scoreMarks !== null && e.totalMarks !== null ? `${fm(e.scoreMarks)} / ${fm(e.totalMarks)}  (${pct})` : pct}     Pass mark: ${e.passPercent}%     RESULT: PASS`, 11, true, rgb(0.05, 0.4, 0.15));
  if (e.externalLicenceNumber) text(`Radio licence number on file: ${e.externalLicenceNumber}`, 10);
  if (e.overrideNote) text(`Final result confirmed by the CFI: ${e.overrideNote}`, 9);
  y -= 6;

  // Verified-by block
  need(80);
  const boxTop = y;
  page.drawRectangle({ x: M, y: y - 62, width: W - 2 * M, height: 62, borderColor: rgb(0.4, 0.4, 0.4), borderWidth: 0.6 });
  page.drawText("VERIFIED AND SIGNED OFF BY INSTRUCTOR", { x: M + 6, y: boxTop - 12, size: 7, font: f.bold, color: NOTE_GREY });
  page.drawText(safeText(e.verifiedByName ?? "Instructor"), { x: M + 6, y: boxTop - 50, size: 10, font: f.regular, color: INK });
  page.drawText(`Date: ${fmtDate(e.verifiedAt)}`, { x: M + 200, y: boxTop - 50, size: 10, font: f.regular, color: INK });
  if (e.verifierSignature) {
    const png = await signatureToPng(e.verifierSignature);
    await placeSignature(doc, page, f, png, { x0: W - M - 200, x1: W - M - 4, y0: H - (boxTop - 14) + 0, y1: H - (boxTop - 60) }, `Digitally signed by ${e.verifiedByName ?? "instructor"} - ${fmtDate(e.verifiedAt)}`);
  }
  y -= 76;

  if (e.source === "paper") {
    text("Paper exam / held licence: the candidate's scan follows on the next page(s).", 9);
    return doc.save();
  }

  for (const s of e.sections) {
    need(40);
    y -= 4;
    page.drawRectangle({ x: M, y: y - 3, width: W - 2 * M, height: 14, color: rgb(0.9, 0.92, 0.96) });
    text(`Section ${s.code} - ${s.name}`, 9, true);
    for (const q of s.questions) {
      const lines = wrap(f.regular, `${q.code}  ${q.prompt}`, 8, W - 2 * M - 60);
      const optLines = q.options.flatMap((o) => wrap(f.regular, `${o.label}. ${o.text}`, 7.5, W - 2 * M - 80));
      need(lines.length * 10 + optLines.length * 9 + 20);
      lines.forEach((ln, i) => {
        page.drawText(ln, { x: M, y, size: 8, font: i === 0 ? f.bold : f.regular, color: rgb(0.1, 0.1, 0.1) });
        if (i === 0) {
          const mk = `${fm(q.awarded)} / ${fm(q.marks)}`;
          page.drawText(mk, { x: W - M - f.bold.widthOfTextAtSize(mk, 8), y, size: 8, font: f.bold, color: q.awarded >= q.marks ? rgb(0.05, 0.4, 0.15) : rgb(0.7, 0.1, 0.1) });
        }
        y -= 10;
      });
      for (const o of q.options) {
        const chosen = o.label === q.selectedLabel;
        const ol = wrap(f.regular, `${o.label}. ${o.text}${o.isCorrect ? "   [correct]" : ""}${chosen ? "   [answer]" : ""}`, 7.5, W - 2 * M - 80);
        ol.forEach((ln) => {
          page.drawText(ln, { x: M + 14, y, size: 7.5, font: chosen || o.isCorrect ? f.bold : f.regular, color: o.isCorrect ? rgb(0.05, 0.4, 0.15) : chosen ? rgb(0.7, 0.1, 0.1) : rgb(0.3, 0.3, 0.3) });
          y -= 9;
        });
      }
      if (q.changed || q.note) {
        page.drawText(safeText(`Instructor correction${q.note ? ": " + q.note : ""}`), { x: M + 14, y, size: 7, font: f.regular, color: NOTE_GREY });
        y -= 9;
      }
      y -= 4;
    }
  }
  const pages = doc.getPages();
  pages.forEach((p, i) => p.drawText(safeText(`${student.name} - ${e.title} - page ${i + 1} of ${pages.length}`), { x: M, y: 20, size: 7, font: f.regular, color: NOTE_GREY }));
  return doc.save();
}
