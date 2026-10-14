import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { fmtDate, placeSignature, safeText, signatureToPng, fitSize } from "./pdf-helpers";
import { PackData, TRAINING_LABEL } from "./types";

// Printable Solo Wings certificate, A4 landscape.
export async function buildWingsCertificate(d: PackData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const W = 841.89;
  const H = 595.28;
  const page = doc.addPage([W, H]);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.08, 0.16, 0.38);
  const gold = rgb(0.72, 0.56, 0.16);

  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: navy, borderWidth: 3 });
  page.drawRectangle({ x: 34, y: 34, width: W - 68, height: H - 68, borderColor: gold, borderWidth: 1 });

  const centre = (text: string, y: number, size: number, font = serif, color = navy) => {
    const t = safeText(text);
    const sz = fitSize(font, t, W - 160, size, 10);
    page.drawText(t, { x: (W - font.widthOfTextAtSize(t, sz)) / 2, y, size: sz, font, color });
  };

  const logoBytes = await readFile(path.join(process.cwd(), "public", "apex-wings.png")).catch(() => null);
  if (logoBytes) {
    const png = await sharp(logoBytes).resize({ width: 900, withoutEnlargement: true }).png().toBuffer();
    const img = await doc.embedPng(png);
    const lw = 330;
    const lh = (img.height * lw) / img.width;
    page.drawImage(img, { x: (W - lw) / 2, y: H - 46 - lh, width: lw, height: lh });
  }

  centre("SOLO WINGS", H - 214, 44, serifBold, navy);
  centre("CERTIFICATE OF ACHIEVEMENT", H - 236, 13, regular, gold);
  centre("This is to certify that", H - 282, 15, italic, rgb(0.25, 0.25, 0.25));
  centre(d.student.fullName.toUpperCase(), H - 322, 30, serifBold, rgb(0, 0, 0));
  centre(
    `has successfully completed the ${TRAINING_LABEL[d.trainingType]} training programme`,
    H - 356,
    15,
    serif,
    rgb(0.15, 0.15, 0.15)
  );
  centre(`at ${d.dtoName} (DTO ${d.dtoNumber}) and is hereby awarded their`, H - 376, 15, serif, rgb(0.15, 0.15, 0.15));
  centre("SOLO WINGS", H - 406, 20, serifBold, gold);

  // Date + instructor
  page.drawText(`Date: ${fmtDate(d.signedOffAt)}`, { x: 90, y: 86, size: 11, font: regular, color: rgb(0.2, 0.2, 0.2) });
  if (d.student.apexNumber) {
    page.drawText(`Apex No. ${safeText(d.student.apexNumber)}`, { x: 90, y: 68, size: 9, font: regular, color: rgb(0.4, 0.4, 0.4) });
  }
  const sx = W - 90 - 230;
  page.drawLine({ start: { x: sx, y: 100 }, end: { x: sx + 230, y: 100 }, thickness: 0.7, color: navy });
  if (d.instructorSignature) {
    const png = await signatureToPng(d.instructorSignature);
    await placeSignature(
      doc,
      page,
      { regular, bold },
      png,
      // top-origin box above the line
      { x0: sx, x1: sx + 230, y0: H - 100 - 46, y1: H - 100 - 2 },
      `Digitally signed by ${d.instructor.fullName} - ${fmtDate(d.signedOffAt)}`
    );
  }
  page.drawText(safeText(d.instructor.fullName), { x: sx, y: 86, size: 11, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(safeText(`Instructor${d.instructor.licenceNumber ? " - Licence " + d.instructor.licenceNumber : ""}`), {
    x: sx,
    y: 72,
    size: 9,
    font: regular,
    color: rgb(0.35, 0.35, 0.35),
  });
  return doc.save();
}
