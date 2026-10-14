import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import {
  Cell,
  Fonts,
  cellParagraph,
  cellText,
  circleCell,
  fmtDate,
  loadFonts,
  placeSignature,
  safeText,
  signatureToPng,
  tick,
} from "./pdf-helpers";
import { Grade, PackData, TRAINING_LABEL } from "./types";

// The four official forms, filled by writing the portfolio data onto the
// UNALTERED official PDFs (public/forms/*), so layout, wording, form numbers
// and footers are exactly SACAA's / SAHPA's. When a form is revised, drop the
// new blank into public/forms/ and re-check the cell coordinates below
// (measured from the 2025 revisions: CA 183-540 04 Sep 2025, R62.22 Rev 5,
// CA 62-16 and CA 62-15 26 Aug 2025).

const FORMS_DIR = path.join(process.cwd(), "public", "forms");

async function openBlank(file: string) {
  const bytes = await readFile(path.join(FORMS_DIR, file));
  const doc = await PDFDocument.load(bytes);
  const fonts = await loadFonts(doc);
  return { doc, fonts, pages: doc.getPages() };
}

const c = (x0: number, x1: number, y0: number, y1: number): Cell => ({ x0, x1, y0, y1 });

function digitalNote(name: string, when: Date): string {
  return `Digitally signed by ${name} - ${fmtDate(when)}`;
}

type SigCtx = { studentPng: Buffer | null; instructorPng: Buffer | null };
async function sigCtx(d: PackData): Promise<SigCtx> {
  return {
    studentPng: d.studentSignature ? await signatureToPng(d.studentSignature) : null,
    instructorPng: d.instructorSignature ? await signatureToPng(d.instructorSignature) : null,
  };
}

function upper(s: string): string {
  return safeText(s).toUpperCase();
}

const PROVINCES = [
  "Gauteng",
  "Western Cape",
  "Eastern Cape",
  "Northern Cape",
  "KwaZulu-Natal",
  "Free State",
  "Limpopo",
  "Mpumalanga",
  "North West",
];

/** Best-effort split of a free-text South African address into the three
 * things CA 62-16 asks for separately. Nothing is invented: whatever isn't
 * found is simply left blank for hand completion. */
export function splitAddress(address: string): { line: string; province: string; postalCode: string } {
  const flat = safeText(address);
  const code = flat.match(/(?:^|[^0-9])(\d{4})\s*$/)?.[1] ?? flat.match(/\b(\d{4})\b(?!.*\b\d{4}\b)/)?.[1] ?? "";
  const province = PROVINCES.find((p) => flat.toLowerCase().includes(p.toLowerCase())) ?? "";
  return { line: flat, province, postalCode: code };
}

// ---------------------------------------------------------------------------
// 1. CA 183-540 SACAA Client Consent Form
// ---------------------------------------------------------------------------
export async function fillConsentForm(d: PackData): Promise<Uint8Array> {
  const { doc, fonts, pages } = await openBlank("ca-183-540-client-consent-form.pdf");
  const p = pages[0];
  const s = d.student;
  const sig = await sigCtx(d);

  cellText(p, fonts, s.surname, c(143.4, 339.7, 353.8, 373.6), { size: 10 });
  cellText(p, fonts, s.initials, c(393.7, 543.8, 353.8, 373.6), { size: 10 });
  cellText(p, fonts, s.idPassport, c(143.4, 339.7, 374.1, 397.1), { size: 10 });
  cellParagraph(
    p,
    fonts,
    `Initial ${TRAINING_LABEL[d.trainingType]} licence application`,
    c(143.4, 339.7, 397.6, 432.1),
    { size: 9, maxLines: 2 }
  );
  cellText(p, fonts, s.licenceNumber ? s.licenceNumber : "None - initial application", c(340.1, 543.8, 411, 431), {
    size: 9,
  });

  // Signature / name / date row. The name is plain data entry and is always
  // printed; the signature (and the date that belongs to it) only when the
  // student has consented to his saved signature being used.
  cellText(p, fonts, upper(s.fullName), c(211, 380, 559.3, 601.8), { size: 10, align: "center" });
  if (sig.studentPng) {
    await placeSignature(doc, p, fonts, sig.studentPng, c(51.5, 210.5, 561, 601), digitalNote(s.fullName, d.signedOffAt));
    cellText(p, fonts, fmtDate(d.signedOffAt), c(380.5, 543.8, 559.3, 601.8), { size: 10, align: "center" });
  }
  // The "applicant's representative / proxy" block is already filled in on
  // the SAHPA copy of the form (courier contact) -- left exactly as supplied.
  return doc.save();
}

// ---------------------------------------------------------------------------
// 2. SAHPA Appendix R62.22 Medical Fitness Certificate (pilot's declaration)
// ---------------------------------------------------------------------------
export async function fillMedicalForm(d: PackData): Promise<Uint8Array> {
  const { doc, fonts, pages } = await openBlank("sahpa-r62-22-medical-fitness.pdf");
  const p = pages[0];
  const s = d.student;
  const sig = await sigCtx(d);

  // "I, ______ (name in full)"
  cellText(p, fonts, s.fullName, c(70, 372, 160, 174), { size: 10, dy: 3 });

  // The pilot's declaration says he has never suffered from the listed
  // conditions. His signature goes on ONLY when his own Hub declaration is
  // signed and in date (he is under 60 and it hasn't expired) AND he has
  // consented to his signature being used. Otherwise it stays blank.
  if (sig.studentPng && d.medicalSignatureAllowed) {
    await placeSignature(
      doc,
      p,
      fonts,
      sig.studentPng,
      c(150, 375, 339, 368),
      digitalNote(s.fullName, d.signedOffAt)
    );
    cellText(p, fonts, fmtDate(d.signedOffAt), c(398, 538, 352, 368), { size: 10, align: "center", dy: -1 });
  }
  // The Medical Practitioner's Declaration (overleaf half) is for a doctor:
  // never touched here.
  return doc.save();
}

// ---------------------------------------------------------------------------
// 3. CA 62-16 Application for licence / renewal / upgrade
// ---------------------------------------------------------------------------
export async function fillCA6216(d: PackData): Promise<Uint8Array> {
  const { doc, fonts, pages } = await openBlank("ca-62-16-application.pdf");
  const [p1, p2, p3] = pages;
  const s = d.student;
  const sig = await sigCtx(d);
  const isPG = d.trainingType === "pg";
  const rating = `${d.trainingType.toUpperCase()} Basic`;

  // ---- Page 1: membership, tick boxes, candidate ----
  const sz = { size: 8.5 };
  if (s.sahpaNumber) cellText(p1, fonts, "Yes", c(149, 214, 369, 390), { ...sz, align: "center" });
  cellText(p1, fonts, s.sahpaNumber, c(285, 366, 369, 390), sz);
  cellText(p1, fonts, fmtDate(s.sahpaExpiry), c(447, 544, 369, 390), sz);

  tick(p1, fonts, c(173, 292, 400, 415)); // Initial
  tick(p1, fonts, isPG ? c(413, 544, 400, 415) : c(490, 544, 415, 430)); // Paragliding | Powered Paragliding PPG/PPC/PPT

  cellText(p1, fonts, s.surname, c(180, 324, 488, 503), sz);
  cellText(p1, fonts, s.firstNames, c(415, 539, 488, 503), sz);
  cellText(p1, fonts, s.idPassport, c(180, 324, 503, 518), sz);
  cellText(p1, fonts, fmtDate(s.dob), c(415, 539, 503, 518), sz);
  cellText(p1, fonts, "", c(180, 324, 518, 533), sz); // home number: not captured separately
  cellText(p1, fonts, s.phone, c(415, 539, 518, 533), sz);
  // work number left blank (not captured)
  cellText(p1, fonts, s.licenceNumber ?? "", c(415, 539, 533, 548), sz);
  cellText(p1, fonts, d.dtoName, c(180, 324, 548, 563), sz);
  cellText(p1, fonts, d.dtoNumber, c(415, 539, 548, 563), sz);
  cellText(p1, fonts, s.email, c(180, 539, 563, 579), sz);

  const phys = splitAddress(s.homeAddress);
  cellParagraph(p1, fonts, phys.line, c(180, 539, 579, 609 - 15), { size: 8, maxLines: 1 });
  cellText(p1, fonts, phys.province, c(327, 414, 594, 609), sz);
  cellText(p1, fonts, phys.postalCode, c(463, 539, 594, 609), sz);

  const post = splitAddress(s.postalAddress || s.homeAddress);
  cellParagraph(p1, fonts, post.line, c(180, 539, 609, 624), { size: 8, maxLines: 1 });
  cellText(p1, fonts, post.province, c(327, 414, 640, 655), sz);
  cellText(p1, fonts, post.postalCode, c(474, 539, 640, 655), sz);
  // Section B (renewal checklist) is for renewals only: left blank.

  // ---- Page 2: C radio licence, D licence/rating ----
  if (d.radioExamPassed) cellText(p2, fonts, "Passed - cert. attached", c(182, 301, 391, 406), { size: 7.5 });
  cellText(p2, fonts, d.radioExaminerName, c(189, 291, 448, 463), { size: 8 });
  cellText(p2, fonts, d.radioExaminerLicence, c(412, 544, 448, 463), sz);
  const [cs1, cs2, cs3] = d.callSignChoices;
  cellText(p2, fonts, cs1, c(219, 281, 473, 488), { size: 8, align: "center" });
  cellText(p2, fonts, cs2, c(341, 403, 473, 488), { size: 8, align: "center" });
  cellText(p2, fonts, cs3, c(463, 544, 473, 488), { size: 8, align: "center" });

  cellText(p2, fonts, "None - initial application", c(193, 544, 621, 636), sz);
  tick(p2, fonts, c(476, 538, 692, 702), 9); // checklist: Ab Initio/Basic

  const instrNote = digitalNote(d.instructor.fullName, d.signedOffAt);
  const rows = isPG
    ? { page: p2, rating: c(193, 275, 680, 695), sig: c(193, 275, 695, 710), name: c(193, 275, 710, 724), lic: c(193, 275, 724, 739), date: c(193, 275, 739, 754) }
    : { page: p3, rating: c(193, 275, 40, 54), sig: c(193, 275, 54, 69), name: c(193, 275, 69, 84), lic: c(193, 275, 84, 99), date: c(193, 275, 99, 113) };
  cellText(rows.page, fonts, rating, rows.rating, { size: 7.5 });
  cellText(rows.page, fonts, d.instructor.fullName, rows.name, { size: 7.5 });
  cellText(rows.page, fonts, d.instructor.licenceNumber, rows.lic, { size: 7.5 });
  if (sig.instructorPng) {
    await placeSignature(doc, rows.page, fonts, sig.instructorPng, rows.sig, instrNote);
    cellText(rows.page, fonts, fmtDate(d.signedOffAt), rows.date, { size: 7.5 });
  }

  // ---- Page 3: E declaration (applicant) ----
  cellText(p3, fonts, upper(s.fullName), c(211, 370, 293, 336), { size: 9, align: "center" });
  if (sig.studentPng) {
    await placeSignature(doc, p3, fonts, sig.studentPng, c(51, 210, 295, 335), digitalNote(s.fullName, d.signedOffAt));
    cellText(p3, fonts, fmtDate(d.signedOffAt), c(370, 544, 293, 336), { size: 9, align: "center" });
  }
  // Parent/legal guardian block (under 18): left for hand completion.
  return doc.save();
}

// ---------------------------------------------------------------------------
// 4. CA 62-15 Examination and Practical Skill Test Report
// ---------------------------------------------------------------------------
const GRADE_COLS: Record<Grade, [number, number]> = {
  excellent: [335, 383],
  good: [384, 418],
  average: [418, 466],
  need_practice: [467, 538],
};

export async function fillCA6215(d: PackData): Promise<Uint8Array> {
  const { doc, fonts, pages } = await openBlank("ca-62-15-skill-test.pdf");
  const [p1, p2] = pages;
  const s = d.student;
  const sig = await sigCtx(d);
  const isPG = d.trainingType === "pg";
  const sz = { size: 9 };

  tick(p1, fonts, isPG ? c(187, 238, 400, 415) : c(432, 538, 400, 415));
  tick(p1, fonts, c(248, 295, 425, 448)); // Initial issue

  cellText(p1, fonts, s.surname, c(150, 289, 474, 489), sz);
  cellText(p1, fonts, s.firstNames, c(370, 538, 474, 489), sz);
  cellText(p1, fonts, s.licenceNumber ?? "", c(150, 289, 489, 504), sz);
  cellText(p1, fonts, s.phone, c(370, 538, 489, 504), sz);
  cellText(p1, fonts, d.dtoName, c(149, 289, 504, 518), sz);
  cellText(p1, fonts, d.dtoNumber, c(369, 538, 504, 518), sz);

  cellText(p1, fonts, upper(s.fullName), c(218, 377, 518, 551), { size: 9, align: "center" });
  if (sig.studentPng) {
    await placeSignature(doc, p1, fonts, sig.studentPng, c(57, 217, 520, 550), digitalNote(s.fullName, d.signedOffAt));
    cellText(p1, fonts, fmtDate(d.signedOffAt), c(378, 538, 518, 551), { size: 9, align: "center" });
  }

  // Grades: circle the chosen word on its row.
  const g = d.skillGrades;
  const rowsP1: [keyof typeof g, number, number][] = [
    ["takeoff", 647, 662],
    ["landing", 662, 676],
    ["turns360", 676, 691],
    ["ridge", 691, 706],
    ["spot", 706, 721],
    ["engine", 721, 735],
    ["weather", 762, 777],
  ];
  for (const [key, y0, y1] of rowsP1) {
    const grade = g[key];
    if (grade) circleCell(p1, c(GRADE_COLS[grade][0], GRADE_COLS[grade][1], y0, y1));
  }
  const rowsP2: [keyof typeof g, number, number][] = [
    ["airlaw", 37, 52],
    ["turbulence", 52, 66],
  ];
  for (const [key, y0, y1] of rowsP2) {
    const grade = g[key];
    if (grade) circleCell(p2, c(GRADE_COLS[grade][0], GRADE_COLS[grade][1], y0, y1));
  }

  // Remedial action (two ruled lines under the label)
  const rem = safeText(d.remedialAction);
  if (rem) cellParagraph(p2, fonts, rem, c(57, 538, 93, 122), { size: 8, maxLines: 2 });

  // Examiner block
  cellText(p2, fonts, upper(d.instructor.fullName), c(218, 378, 135, 166), { size: 9, align: "center" });
  if (sig.instructorPng) {
    await placeSignature(doc, p2, fonts, sig.instructorPng, c(57, 217, 137, 165), digitalNote(d.instructor.fullName, d.signedOffAt));
    cellText(p2, fonts, fmtDate(d.signedOffAt), c(378, 538, 135, 166), { size: 9, align: "center" });
  }
  return doc.save();
}
