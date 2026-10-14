import { PDFDocument, rgb } from "pdf-lib";
import { fmtDate, loadFonts, safeText } from "./pdf-helpers";
import { PackData, TRAINING_LABEL } from "./types";

export type PackFileInfo = { name: string; what: string };

// One-page cover sheet for the pack: what is inside, what was auto-signed,
// and what the instructor still has to check or do by hand.
export async function buildChecklistPdf(d: PackData, files: PackFileInfo[], signed: { student: boolean; instructor: boolean; medical: boolean }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = await loadFonts(doc);
  const page = doc.addPage([595.28, 841.89]);
  let y = 800;
  const line = (t: string, size = 9, bold = false, color = rgb(0.1, 0.1, 0.1), x = 48) => {
    page.drawText(safeText(t), { x, y, size, font: bold ? fonts.bold : fonts.regular, color });
    y -= size + 5;
  };
  line("SAHPA / CAA SUBMISSION PACK - CHECKLIST", 15, true, rgb(0, 0, 0));
  line(`${d.student.fullName} - ${TRAINING_LABEL[d.trainingType]} - signed off ${fmtDate(d.signedOffAt)} by ${d.instructor.fullName}`, 9);
  y -= 8;
  line("Contents", 11, true);
  for (const f of files) line(`[ ]  ${f.name}  -  ${f.what}`, 9);
  y -= 8;
  line("Signatures applied automatically", 11, true);
  line(`Student signature (consent given in profile): ${signed.student ? "YES, with 'Digitally signed' note" : "NO - sign by hand"}`, 9);
  line(`Pilot declaration on medical form: ${signed.medical ? "YES" : "NO - sign by hand (needs a valid Hub medical declaration and age under 60)"}`, 9);
  line(`Instructor signature: ${signed.instructor ? "YES, with 'Digitally signed' note" : "NO - no signature uploaded; sign by hand"}`, 9);
  y -= 8;
  line("Check by eye before submitting", 11, true);
  for (const t of [
    "Passport photo: plain light background, face 70-80% of frame, neutral expression, no glare (DHA spec).",
    "Print the photo sheet at 100% scale on photo paper - two identical 35 x 45 mm prints.",
    "SAHPA medical: the practitioner half is for the doctor - never completed by the Hub.",
    "CA 183-540: confirm the proxy details pre-printed on the SAHPA form are still correct.",
    "Logbook: every flight should show an instructor countersignature.",
  ]) line(`[ ]  ${t}`, 9);
  if (d.warnings.length) {
    y -= 8;
    line("Warnings from the Hub", 11, true, rgb(0.7, 0.1, 0.1));
    for (const w of d.warnings) line(`!  ${w}`, 9, false, rgb(0.7, 0.1, 0.1));
  }
  return doc.save();
}
