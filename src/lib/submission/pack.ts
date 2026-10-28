import { ZipArchive } from "archiver";
import { PassThrough } from "node:stream";
import { buildPassportPhoto } from "./photo";
import { buildLogbookPdf } from "./logbook-pdf";
import { buildWingsCertificate } from "./certificate";
import { buildChecklistPdf, PackFileInfo } from "./checklist";
import { fillConsentForm, fillMedicalForm, fillCA6216, fillCA6215 } from "./forms";
import { PackData } from "./types";
import { buildDtoCertificate, buildRadioCertificate } from "./certificates";
import { buildExamCopyPdf } from "./exam-copy-pdf";
import { appendScanToExamPdf, concatPdfs } from "./merge-scan";
import { buildSahpaExamPdf } from "./exam-sahpa-pdf";

function slug(s: string): string {
  return s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") || "student";
}

/** Builds every document and zips them. Pure: no DB, no disk writes. */
export async function buildSubmissionPack(d: PackData): Promise<{ zip: Buffer; fileName: string; warnings: string[] }> {
  const warnings = [...d.warnings];
  const files: { name: string; data: Buffer | Uint8Array; what: string }[] = [];

  files.push({ name: "1_CA-183-540_Client_Consent.pdf", data: await fillConsentForm(d), what: "CA 183-540 client consent form" });
  files.push({ name: "2_SAHPA_Medical_Fitness_R62-22.pdf", data: await fillMedicalForm(d), what: "SAHPA medical fitness form (pilot half only)" });
  files.push({ name: "3_CA-62-16_Application.pdf", data: await fillCA6216(d), what: "CA 62-16 licence application" });
  files.push({ name: "4_CA-62-15_Skill_Test.pdf", data: await fillCA6215(d), what: "CA 62-15 skill test form" });

  let photoJpeg: Buffer | null = null;
  if (d.profilePicture) {
    try {
      const p = await buildPassportPhoto(d.profilePicture);
      photoJpeg = p.jpg;
      warnings.push(...p.warnings);
      files.push({ name: "5_Passport_Photo_35x45mm.jpg", data: p.jpg, what: "digital passport/ID photo, 35 x 45 mm" });
      files.push({ name: "5_Passport_Photo_Print_Sheet.pdf", data: p.sheetPdf, what: "A4 sheet with two prints" });
    } catch (e) {
      warnings.push(`Passport photo could not be prepared: ${(e as Error).message}`);
    }
  } else {
    warnings.push("No profile picture - a passport photo could not be produced.");
  }

  files.push({ name: "6_Logbook_Copy.pdf", data: await buildLogbookPdf(d, photoJpeg), what: "certified logbook copy" });
  if (d.idCopy) files.push({ name: `7_ID_Copy.${d.idCopy.ext}`, data: d.idCopy.bytes, what: "copy of ID / passport" });
  if (d.radioCertificate) files.push({ name: `8_Radio_Licence_Copy.${d.radioCertificate.ext}`, data: d.radioCertificate.bytes, what: "radio certificate" });
  if (d.radioCert) files.push({ name: "8_Radio_Endorsement_Certificate.pdf", data: await buildRadioCertificate(d.radioCert, d.dtoName), what: "restricted radio endorsement certificate" });
  files.push({ name: "9_DTO_Certificate_of_Completion.pdf", data: await buildDtoCertificate(d), what: `DTO certificate of completion (${d.dtoCertRef})` });
  let n = 10;
  for (const e of d.examCopies) {
    const base = `${n++}_Exam_${slug(e.title)}`;
    const passed = await buildExamCopyPdf(e, { name: d.student.fullName, apexNumber: d.student.apexNumber });
    const what = `${e.title} - passed (${e.passPercent}% pass mark), verified by instructor`;
    if (e.print) {
      // Online exam: PASSED page, then the exam in the SAHPA paper format
      // (logo, marks table, open-answer questions, student's answer only).
      try {
        const sahpa = await buildSahpaExamPdf({
          studentName: d.student.fullName,
          exam: e.print.exam,
          attempt: e.print.attempt,
          verifierSignature: e.verifierSignature,
        });
        const joined = await concatPdfs(passed, sahpa);
        files.push({ name: `${base}_PASSED.pdf`, data: joined ?? passed, what: `${what}, followed by the exam in the SAHPA paper format` });
      } catch (err) {
        warnings.push(`${e.title}: the exam pages couldn't be drawn (${(err as Error).message}).`);
        files.push({ name: `${base}_PASSED.pdf`, data: passed, what });
      }
      continue;
    }
    if (!e.proof) {
      files.push({ name: `${base}_PASSED.pdf`, data: passed, what });
      continue;
    }
    // One PDF per exam: the PASSED record first, then the candidate's scan.
    const combined = await appendScanToExamPdf(passed, e.proof, `${d.student.fullName} - ${e.title}`);
    if (combined) {
      files.push({ name: `${base}_PASSED.pdf`, data: combined, what: `${what}, followed by the candidate's scan` });
    } else {
      warnings.push(`${e.title}: the scan couldn't be added to the exam PDF, so it is included as a separate file.`);
      files.push({ name: `${base}_PASSED.pdf`, data: passed, what });
      files.push({ name: `${base}_Scan.${e.proof.ext}`, data: e.proof.bytes, what: `${e.title} - candidate's scan` });
    }
  }
  files.push({ name: "Solo_Wings_Certificate.pdf", data: await buildWingsCertificate(d), what: "student's Solo Wings certificate (keep, not submitted)" });

  const info: PackFileInfo[] = files.map((f) => ({ name: f.name, what: f.what }));
  info.push({ name: "0_Checklist.pdf", what: "this sheet" });
  const checklist = await buildChecklistPdf({ ...d, warnings }, info, {
    student: !!d.studentSignature,
    instructor: !!d.instructorSignature,
    medical: !!d.studentSignature && d.medicalSignatureAllowed,
  });
  files.unshift({ name: "0_Checklist.pdf", data: checklist, what: "" });

  const zip = new ZipArchive({ zlib: { level: 6 } });
  const sink = new PassThrough();
  const chunks: Buffer[] = [];
  sink.on("data", (c) => chunks.push(c));
  const done = new Promise<void>((res, rej) => {
    sink.on("end", res);
    zip.on("error", rej);
  });
  zip.pipe(sink);
  for (const f of files) zip.append(Buffer.from(f.data), { name: f.name });
  await zip.finalize();
  await done;
  return { zip: Buffer.concat(chunks), fileName: `Apex_Submission_${slug(d.student.fullName)}.zip`, warnings };
}
