import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";

// DHA "Passport & ID photograph specifications": 35 mm x 45 mm colour photo,
// head and top of shoulders, two identical prints, taken within the last
// month. We can crop and size a photo correctly -- we cannot judge pose,
// lighting, background or expression, so the checklist tells the instructor
// to check those by eye (the DHA rules are summarised there).

const MM = 72 / 25.4;
export const PHOTO_PX_W = 827; // 35 mm at 600 dpi
export const PHOTO_PX_H = 1063; // 45 mm at 600 dpi

export async function buildPassportPhoto(
  source: Buffer
): Promise<{ jpg: Buffer; sheetPdf: Uint8Array; warnings: string[] }> {
  const warnings: string[] = [];
  const img = sharp(source).rotate();
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (!w || !h) throw new Error("Profile picture could not be read.");

  if (w < 413 || h < 531) {
    warnings.push(
      `The profile picture is small (${w} x ${h} px). 35 x 45 mm needs at least 413 x 531 px to print sharply - ask the student for a better photo.`
    );
  }
  const target = 35 / 45;
  let cropW = w;
  let cropH = h;
  let left = 0;
  let top = 0;
  if (w / h > target) {
    cropW = Math.round(h * target);
    left = Math.round((w - cropW) / 2);
  } else {
    cropH = Math.round(w / target);
    top = Math.round(Math.max(0, (h - cropH) * 0.15)); // heads sit in the upper part of a portrait
  }
  const jpg = await sharp(source)
    .rotate()
    .extract({ left, top, width: cropW, height: cropH })
    .resize(PHOTO_PX_W, PHOTO_PX_H, { fit: "fill" })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92 })
    .withMetadata({ density: 600 })
    .toBuffer();

  const sheet = await PDFDocument.create();
  const font = await sheet.embedFont(StandardFonts.Helvetica);
  const page = sheet.addPage([595.28, 841.89]);
  const embedded = await sheet.embedJpg(jpg);
  const pw = 35 * MM;
  const ph = 45 * MM;
  const gap = 10 * MM;
  const x0 = (595.28 - (2 * pw + gap)) / 2;
  const yTop = 841.89 - 60;
  for (let k = 0; k < 2; k++) {
    const x = x0 + k * (pw + gap);
    page.drawImage(embedded, { x, y: yTop - ph, width: pw, height: ph });
    page.drawRectangle({ x, y: yTop - ph, width: pw, height: ph, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.4 });
  }
  const lines = [
    "Passport / ID photograph - two identical copies, 35 mm x 45 mm",
    "Print on high-quality photo paper at 100% scale (no 'fit to page'), then cut along the grey outline.",
    "DHA: colour, taken within the last month, plain light-grey or cream background, face fills 70-80% of the photo,",
    "looking straight at the camera, neutral expression, mouth closed, no shadows, flash glare or red-eye.",
  ];
  lines.forEach((t, i) => page.drawText(t, { x: 56, y: yTop - ph - 30 - i * 12, size: 8, font, color: rgb(0.3, 0.3, 0.3) }));
  return { jpg, sheetPdf: await sheet.save(), warnings };
}
