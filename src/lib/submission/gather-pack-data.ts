import "server-only";
import { readFile } from "node:fs/promises";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { flightLogEntries, studentProfiles, users } from "@/db/schema";
import { resolveUploadPath } from "@/lib/uploads";
import { ageFromDob } from "@/lib/medical";
import { PackData, SignoffTrainingType, SkillGrades } from "./types";

export const DTO_NAME = "Paramotor SA (Pty) Ltd";

export type SignoffInput = {
  trainingType: SignoffTrainingType;
  signedOffAt: Date;
  instructorUserId: string;
  instructorLicenceNumber: string;
  surname?: string;
  firstNames?: string;
  skillGrades: SkillGrades;
  remedialAction: string;
  radioExaminerName: string;
  radioExaminerLicence: string;
  callSignChoices: [string, string, string];
};

async function readUpload(userId: string, file: string | null): Promise<Buffer | null> {
  if (!file) return null;
  const p = resolveUploadPath(userId, file);
  if (!p) return null;
  return readFile(p).catch(() => null);
}

function extOf(file: string): string {
  return (file.split(".").pop() ?? "bin").toLowerCase();
}

function splitName(full: string): { surname: string; firstNames: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { surname: full.trim(), firstNames: "" };
  return { surname: parts[parts.length - 1], firstNames: parts.slice(0, -1).join(" ") };
}

/** Reads the student's portfolio and assembles everything the pack builder needs.
 * Signature rule: the student's signature is only used if they ticked the
 * forms-consent box; the instructor's is always the signing user's own. */
export async function gatherPackData(studentUserId: string, input: SignoffInput): Promise<PackData> {
  const [u] = await db.select().from(users).where(eq(users.id, studentUserId)).limit(1);
  if (!u) throw new Error("Student not found.");
  const [sp] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, studentUserId)).limit(1);
  const [ins] = await db.select().from(users).where(eq(users.id, input.instructorUserId)).limit(1);
  if (!ins) throw new Error("Instructor not found.");

  const warnings: string[] = [];
  const guess = splitName(u.name);
  const surname = input.surname?.trim() || guess.surname;
  const firstNames = input.firstNames?.trim() || guess.firstNames;
  const initials = (u.initials?.trim() || firstNames.split(/\s+/).filter(Boolean).map((n) => n[0].toUpperCase()).join("")).replace(/\./g, "");

  // Two same-named `name` columns in one join silently shift under the
  // sqlite-proxy driver, so names are looked up separately and mapped.
  const rows = await db
    .select({
      date: flightLogEntries.date,
      site: flightLogEntries.site,
      aircraftType: flightLogEntries.aircraftType,
      flightType: flightLogEntries.flightType,
      durationMinutes: flightLogEntries.durationMinutes,
      launches: flightLogEntries.launches,
      exerciseCodes: flightLogEntries.exerciseCodesCovered,
      verified: flightLogEntries.verified,
      verifiedAt: flightLogEntries.verifiedAt,
      instructorComment: flightLogEntries.instructorComment,
      verifiedByUserId: flightLogEntries.verifiedByUserId,
      instructorUserId: flightLogEntries.instructorUserId,
    })
    .from(flightLogEntries)
    .where(eq(flightLogEntries.studentId, studentUserId))
    .orderBy(asc(flightLogEntries.date));
  const nameRows = await db.select({ id: users.id, name: users.name }).from(users);
  const nameOf = new Map(nameRows.map((n) => [n.id, n.name]));
  const logbook = rows.map(({ verifiedByUserId, instructorUserId, ...r }) => ({
    ...r,
    verified: !!r.verified,
    verifiedByName: verifiedByUserId ? nameOf.get(verifiedByUserId) ?? null : null,
    instructorName: instructorUserId ? nameOf.get(instructorUserId) ?? null : null,
  }));
  const unverified = logbook.filter((e) => !e.verified).length;
  if (unverified) warnings.push(`${unverified} logbook flight(s) are not countersigned by an instructor.`);
  if (!logbook.length) warnings.push("The student has no logbook entries.");

  // Signatures
  const consented = !!u.signatureFormsConsentAt;
  let studentSignature: Buffer | null = null;
  if (u.signatureFile && consented) studentSignature = await readUpload(u.id, u.signatureFile);
  else if (u.signatureFile && !consented) warnings.push("The student has a signature on file but has not consented to its use on the forms - sign by hand.");
  else warnings.push("The student has not uploaded a signature - sign the forms by hand.");
  const instructorSignature = await readUpload(ins.id, ins.signatureFile);
  if (!instructorSignature) warnings.push("Your signature is not uploaded - sign the instructor sections by hand.");

  const age = ageFromDob(u.dob);
  const declValid = !!u.medicalDeclarationSignedAt && !!u.medicalDeclarationExpiresAt && u.medicalDeclarationExpiresAt > input.signedOffAt;
  const medicalSignatureAllowed = declValid && age !== null && age < 60;
  if (!medicalSignatureAllowed) warnings.push("Medical form: no valid Hub medical declaration (or age 60+) - the pilot signs by hand.");

  const profilePicture = await readUpload(u.id, u.profilePictureFile);
  const idBytes = await readUpload(u.id, u.idPassportFile);
  if (!u.idPassportFile || !idBytes) warnings.push("No ID / passport copy on file - attach one.");
  if (!u.dob) warnings.push("Date of birth is missing.");
  if (!u.homeAddress) warnings.push("Home address is missing.");

  return {
    trainingType: input.trainingType,
    signedOffAt: input.signedOffAt,
    dtoName: DTO_NAME,
    dtoNumber: sp?.dtoNumber ?? "SACAA-0012DTO",
    student: {
      fullName: u.name,
      surname,
      firstNames,
      initials,
      email: u.email,
      phone: u.phone ?? sp?.phone ?? "",
      idPassport: u.idPassportNumber ?? "",
      dob: u.dob ?? null,
      homeAddress: u.homeAddress ?? "",
      postalAddress: u.postalAddress ?? u.homeAddress ?? "",
      apexNumber: u.apexNumber ?? null,
      callSign: sp?.callSign ?? null,
      sacaaNumber: sp?.sacaaNumber ?? null,
      sahpaNumber: sp?.sahpaNumber ?? null,
      sahpaExpiry: sp?.sahpaExpiryDate ?? null,
      licenceNumber: sp?.licenseNumber ?? null,
      medicalDeclarationSignedAt: u.medicalDeclarationSignedAt ?? null,
      medicalDeclarationExpiresAt: u.medicalDeclarationExpiresAt ?? null,
    },
    instructor: { fullName: ins.name, licenceNumber: input.instructorLicenceNumber },
    studentSignature,
    instructorSignature,
    medicalSignatureAllowed,
    profilePicture,
    idCopy: idBytes && u.idPassportFile ? { bytes: idBytes, ext: extOf(u.idPassportFile) } : null,
    radioCertificate: null,
    radioExamPassed: !!input.radioExaminerName,
    skillGrades: input.skillGrades,
    remedialAction: input.remedialAction,
    radioExaminerName: input.radioExaminerName,
    radioExaminerLicence: input.radioExaminerLicence,
    callSignChoices: input.callSignChoices,
    logbook,
    warnings,
  };
}
