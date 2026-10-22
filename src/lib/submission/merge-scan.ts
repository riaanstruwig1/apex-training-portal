import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";

// 22 Oct 2026 (Riaan): "combine the two PDFs -- no. 10 (the one that says
// PASS as first page, then the rest of the exam, also no. 10 SCAN). Same
// with no. 11. One PDF." Appends the candidate's scan (PDF pages, or a
// photo/scan image placed on A4 pages) after the PASSED record and numbers
// every page. Returns null when the scan can't be read, so the caller can
// fall back to shipping it as a separate file.

const A4W = 595.28;
const A4H = 841.89;
const M = 28;

export async function appendScanToExamPdf(
  passedPdf: Uint8Array,
  scan: { bytes: Buffer | Uint8Array; ext: string },
  footer: string
): Promise<Uint8Array | null> {
  try {
    const out = await PDFDocument.load(passedPdf);
    const ext = scan.ext.toLowerCase();
    if (ext === "pdf") {
      const src = await PDFDocument.load(scan.bytes, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    } else {
      // Any image (jpg/png/webp/heic...) -> upright JPEG, then fit on A4.
      const jpg = await sharp(Buffer.from(scan.bytes)).rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer();
      const img = await out.embedJpg(jpg);
      const landscape = img.width > img.height;
      const [pw, ph] = landscape ? [A4H, A4W] : [A4W, A4H];
      const page = out.addPage([pw, ph]);
      const s = Math.min((pw - 2 * M) / img.width, (ph - 2 * M - 12) / img.height);
      const w = img.width * s;
      const h = img.height * s;
      page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2 + 6, width: w, height: h });
    }
    const font = await out.embedFont(StandardFonts.Helvetica);
    const all = out.getPages();
    all.forEach((p, i) => {
      const label = `${footer} - page ${i + 1} of ${all.length}`.replace(/[^\x20-\x7E]/g, "-");
      const { width } = p.getSize();
      // white strip so the number stays readable over a scan
      p.drawRectangle({ x: width - 40 - font.widthOfTextAtSize(label, 7) - 4, y: 14, width: font.widthOfTextAtSize(label, 7) + 8, height: 11, color: rgb(1, 1, 1) });
      p.drawText(label, { x: width - 40 - font.widthOfTextAtSize(label, 7), y: 17, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
    });
    return await out.save();
  } catch {
    return null;
  }
}
