import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { fmtDate, placeSignature, safeText, signatureToPng, fitSize } from "./pdf-helpers";
import { PackData, RadioCertData, SignoffTrainingType } from "./types";

// "Certificate of Completion" pages in the style of Apex's existing paper
// certificates (blue double border, faint Apex watermark, italic body text,
// signature + date at the bottom, Apex / SAHPA / SACAA marks).

const W = 595.28;
const H = 841.89;
const BLUE = rgb(0.0, 0.42, 0.72);
const TITLE = rgb(0.15, 0.32, 0.62);

const COURSE_NAME: Record<SignoffTrainingType, string> = {
  pg: "Paragliding (PG)",
  ppg: "Power Paragliding (PPG)",
  ppt: "Powered Paratrike (PPT)",
};
const COURSE_LONG: Record<SignoffTrainingType, string> = {
  pg: "a Paragliding",
  ppg: "a Powered Paragliding",
  ppt: "a Powered Paratrike",
};

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  italic: PDFFont;
  italicBold: PDFFont;
  regular: PDFFont;
  bold: PDFFont;
};

async function logoPng(file: string, width: number): Promise<Buffer | null> {
  const b = await readFile(path.join(process.cwd(), "public", file)).catch(() => null);
  return b ? sharp(b).resize({ width, withoutEnlargement: true }).png().toBuffer() : null;
}

async function base(): Promise<Ctx> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([W, H]);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const italicBold = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: BLUE, borderWidth: 5 });
  page.drawRectangle({ x: 36, y: 36, width: W - 72, height: H - 72, borderColor: BLUE, borderWidth: 1 });
  // Faint watermark
  const wm = await logoPng("apex-logo.png", 900);
  if (wm) {
    const img = await doc.embedPng(wm);
    const w = 420;
    const h = (img.height * w) / img.width;
    page.drawImage(img, { x: (W - w) / 2, y: 250, width: w, height: h, opacity: 0.09 });
  }
  return { doc, page, italic, italicBold, regular, bold };
}

function centre(c: Ctx, text: string, y: number, size: number, font: PDFFont, color = rgb(0.1, 0.1, 0.1)) {
  const t = safeText(text);
  const sz = fitSize(font, t, W - 120, size, 8);
  c.page.drawText(t, { x: (W - font.widthOfTextAtSize(t, sz)) / 2, y, size: sz, font, color });
}

async function footer(c: Ctx, withSacaa: boolean) {
  const apex = await logoPng("apex-logo.png", 200);
  if (apex) {
    const img = await c.doc.embedPng(apex);
    const w = 52;
    c.page.drawImage(img, { x: 60, y: 50, width: w, height: (img.height * w) / img.width });
  }
  const sahpa = await logoPng("sahpa-logo.png", 200);
  if (sahpa && !withSacaa) {
    const img = await c.doc.embedPng(sahpa);
    const w = 40;
    c.page.drawImage(img, { x: 120, y: 50, width: w, height: (img.height * w) / img.width });
  }
  c.page.drawText("www.apexaviation.co.za   061-719-2430", { x: 215, y: 54, size: 8, font: c.regular, color: rgb(0.2, 0.2, 0.5) });
  if (withSacaa) {
    c.page.drawText("SOUTH AFRICAN CIVIL AVIATION AUTHORITY", { x: W - 60 - 170, y: 54, size: 6, font: c.bold, color: rgb(0.1, 0.2, 0.5) });
  }
}

async function signatureBlock(c: Ctx, opts: { sig: Buffer | null; name: string; lines: string[]; date: Date; signedBy: string }) {
  const y = 150;
  // date
  c.page.drawText(fmtDate(opts.date), { x: 100, y: y + 6, size: 12, font: c.regular, color: rgb(0.05, 0.1, 0.45) });
  c.page.drawLine({ start: { x: 66, y }, end: { x: 230, y }, thickness: 0.8, color: rgb(0, 0, 0) });
  c.page.drawText("Date", { x: 120, y: y - 16, size: 11, font: c.italicBold, color: rgb(0, 0, 0) });
  // signature
  const sx = 330;
  c.page.drawLine({ start: { x: sx, y }, end: { x: sx + 200, y }, thickness: 0.8, color: rgb(0, 0, 0) });
  if (opts.sig) {
    const png = await signatureToPng(opts.sig);
    await placeSignature(
      c.doc,
      c.page,
      { regular: c.regular, bold: c.bold },
      png,
      { x0: sx, x1: sx + 200, y0: H - y - 54, y1: H - y - 1 },
      `Digitally signed by ${opts.signedBy} - ${fmtDate(opts.date)}`
    );
  }
  c.page.drawText(safeText(opts.name), { x: sx + 20, y: y - 16, size: 12, font: c.italicBold, color: rgb(0, 0, 0) });
  opts.lines.forEach((ln, i) =>
    c.page.drawText(safeText(ln), { x: sx + 14, y: y - 30 - i * 11, size: 8.5, font: c.italicBold, color: rgb(0.1, 0.1, 0.1) })
  );
}

/** DTO "Certificate of Completion" for the course (Clint Cowie style). */
export async function buildDtoCertificate(d: PackData): Promise<Uint8Array> {
  const c = await base();
  centre(c, "Certificate of Completion", H - 108, 30, c.bold, TITLE);
  centre(c, "This certifies that", H - 160, 13, c.italicBold);
  centre(c, d.student.fullName, H - 218, 32, c.regular, rgb(0, 0, 0));
  centre(c, `Has successfully completed ${COURSE_LONG[d.trainingType]}`, H - 262, 13, c.italicBold);
  centre(c, "Course Endorsement Applicable with", H - 290, 13, c.italicBold);
  centre(c, `${d.dtoName} .`, H - 318, 13, c.italicBold);
  centre(c, "Tested and founded proficient to exercise the privileges of the applicable licence", H - 372, 10.5, c.italic);
  centre(c, COURSE_NAME[d.trainingType], H - 440, 24, c.italicBold, rgb(0, 0, 0));
  centre(c, `#${d.dtoCertRef}`, H - 468, 14, c.regular);
  centre(c, "SACAA 0012/DTO", H - 510, 14, c.regular);
  await signatureBlock(c, {
    sig: d.instructorSignature,
    name: d.instructor.fullName,
    lines: [d.instructorRatingLine || "Flight Instructor", d.instructor.licenceNumber ? `Licence ${d.instructor.licenceNumber}` : ""].filter(Boolean),
    date: d.signedOffAt,
    signedBy: d.instructor.fullName,
  });
  await footer(c, true);
  return c.doc.save();
}

/** SAHPA restricted radio endorsement certificate, issued on passing the radio exam. */
export async function buildRadioCertificate(r: RadioCertData, dtoName: string): Promise<Uint8Array> {
  const c = await base();
  centre(c, "Certificate of Completion", H - 108, 30, c.bold, TITLE);
  centre(c, r.studentName, H - 175, 34, c.italicBold, rgb(0, 0, 0));
  if (r.sahpaNumber) centre(c, `SAHPA SPL ${r.sahpaNumber}`, H - 222, 24, c.regular);
  centre(c, "Has successfully completed an Aeronautical Restricted", H - 268, 13, c.italicBold);
  centre(c, "SAHPA Endorsement Radio Licenses", H - 296, 13, c.italicBold);
  centre(c, `${dtoName} .`, H - 324, 13, c.italicBold);
  centre(c, "Tested and founded proficient to exercise the privileges of the relevant", H - 368, 10.5, c.italic);
  centre(c, "Aeronautical Radio License.", H - 384, 10.5, c.italic);
  centre(c, "Restricted Endorsement certificate", H - 436, 28, c.italicBold, rgb(0, 0, 0));
  centre(c, `#${r.ref}`, H - 470, 15, c.regular);
  centre(c, r.heldLicenceOnFile ? "(Restricted Radio License on file at SACAA)" : "(Restricted Radio License to be held on file at SACAA)", H - 490, 13, c.regular);
  centre(c, "Radio Theory and Practical Test", H - 522, 10.5, c.regular);
  centre(c, "Emergency Procedures", H - 546, 10.5, c.regular);
  centre(c, "Phonetic Alphabet", H - 570, 10.5, c.regular);
  await signatureBlock(c, {
    sig: r.issuerSignature,
    name: r.issuerName,
    lines: [r.issuerLine, "Theory - DTO0012"],
    date: r.issuedAt,
    signedBy: r.issuerName,
  });
  await footer(c, false);
  return c.doc.save();
}
