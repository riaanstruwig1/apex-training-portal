"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { flightLogEntries, pilotProfiles, studentProfiles, studentSignoffs, users } from "@/db/schema";
import { getCurrentUser, requireInstructor } from "@/lib/auth/dal";
import { gatherPackData, SignoffInput } from "@/lib/submission/gather-pack-data";
import { buildSubmissionPack } from "@/lib/submission/pack";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { HUB_URL, normalizePhone } from "@/lib/invite-message";
import { Grade, SignoffTrainingType, SkillGrades, TRAINING_LABEL } from "@/lib/submission/types";

export type SignoffState = { error?: string; success?: string; warnings?: string[] } | undefined;

const GRADES: Grade[] = ["excellent", "good", "average", "need_practice"];
const GRADE_KEYS: (keyof SkillGrades)[] = ["takeoff", "landing", "turns360", "ridge", "spot", "engine", "weather", "airlaw", "turbulence"];
const TYPES: SignoffTrainingType[] = ["pg", "ppg", "ppt"];

function str(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}

async function storePack(studentUserId: string, zip: Buffer): Promise<string> {
  const dir = path.join(process.cwd(), "data", "uploads", studentUserId);
  await mkdir(dir, { recursive: true });
  const name = `submission-pack-${Date.now()}.zip`;
  await writeFile(path.join(dir, name), zip);
  return name;
}

function parseInput(formData: FormData, instructorUserId: string, trainingType: SignoffTrainingType): SignoffInput | string {
  const skillGrades: SkillGrades = {};
  for (const k of GRADE_KEYS) {
    const v = str(formData, `grade_${k}`) as Grade;
    if (!GRADES.includes(v)) {
      if (k === "engine" && trainingType === "pg") continue;
      return "Choose a grade for every skill test item.";
    }
    skillGrades[k] = v;
  }
  const licence = str(formData, "instructorLicenceNumber");
  if (!licence) return "Enter your instructor licence number.";
  return {
    trainingType,
    signedOffAt: new Date(),
    instructorUserId,
    instructorLicenceNumber: licence,
    instructorRatingLine: str(formData, "instructorRatingLine"),
    surname: str(formData, "surname"),
    firstNames: str(formData, "firstNames"),
    skillGrades,
    remedialAction: str(formData, "remedialAction"),
    radioExaminerName: str(formData, "radioExaminerName"),
    radioExaminerLicence: str(formData, "radioExaminerLicence"),
    callSignChoices: [str(formData, "callSign1"), str(formData, "callSign2"), str(formData, "callSign3")],
  };
}

/** WhatsApp to the student, the signing instructor and every CFI (Riaan, 14 Oct 2026).
 * Best effort: the sign-off never fails because a message could not be sent. */
async function notifySignoff(studentId: string, staffId: string, studentName: string, instructorName: string, programme: string): Promise<string> {
  const people = await db.select({ id: users.id, role: users.role, phone: users.phone }).from(users);
  const [sp] = await db.select({ phone: studentProfiles.phone }).from(studentProfiles).where(eq(studentProfiles.userId, studentId)).limit(1);
  const targets = new Map<string, string>(); // phone -> message
  const add = (raw: string | null | undefined, msg: string) => {
    const n = normalizePhone(raw);
    if (n && !targets.has(n)) targets.set(n, msg);
  };
  const first = studentName.split(" ")[0];
  add(people.find((p) => p.id === studentId)?.phone ?? sp?.phone, `Hi ${first}, congratulations! ${instructorName} has signed you off and awarded your Solo wings (${programme}). Your SAHPA/CAA submission pack is being prepared. Your Apex Flight Hub status is now "Pending upload of licence from CAA" - upload your licence in the Hub once it arrives: ${HUB_URL}/login - Team Apex`);
  const staffMsg = `Apex Flight Hub: ${instructorName} signed off ${studentName} (${programme}) and awarded Solo wings. The SAHPA/CAA submission pack is ready on the student's folio. Status: Pending upload of licence from CAA.`;
  add(people.find((p) => p.id === staffId)?.phone, staffMsg);
  for (const p of people) if (p.role === "cfi") add(p.phone, staffMsg);
  let sent = 0;
  for (const [phone, msg] of targets) {
    const r = await sendWhatsAppText(phone, msg);
    if (r.ok) sent++;
    else console.error("[signoff WhatsApp]", r.error);
  }
  return targets.size === 0 ? "No WhatsApp sent (no cell numbers on file)." : `WhatsApp sent to ${sent} of ${targets.size} (student, instructor, CFI).`;
}

/** Signs a student off: wings, pack, and move to Pilot "pending CAA licence". */
export async function signOffStudent(_prev: SignoffState, formData: FormData): Promise<SignoffState> {
  const staff = await requireInstructor();
  const studentId = str(formData, "studentId");
  const trainingType = str(formData, "trainingType") as SignoffTrainingType;
  if (!studentId || !TYPES.includes(trainingType)) return { error: "Missing student or training type." };

  const [student] = await db.select({ id: users.id, role: users.role, name: users.name }).from(users).where(eq(users.id, studentId)).limit(1);
  if (!student || student.role !== "student") return { error: "This student is not in the student list (already signed off?)." };
  const existing = await db.select({ id: studentSignoffs.id }).from(studentSignoffs).where(and(eq(studentSignoffs.studentUserId, studentId), eq(studentSignoffs.trainingType, trainingType))).limit(1);
  if (existing.length) return { error: "This student has already been signed off." };

  const [consentRow] = await db.select({ sig: users.signatureFile, yes: users.signatureFormsConsentAt, no: users.signatureFormsConsentDeclinedAt }).from(users).where(eq(users.id, studentId)).limit(1);
  if (consentRow?.sig && !consentRow.yes && !consentRow.no) {
    return { error: `${student.name} has a saved signature but has not answered the Yes / No consent question yet. Ask him to open Edit profile, answer it under Saved signature and Save - then sign him off.` };
  }

  const input = parseInput(formData, staff.id, trainingType);
  if (typeof input === "string") return { error: input };

  let packFile: string;
  let data;
  let warnings: string[];
  try {
    data = await gatherPackData(studentId, input);
    const built = await buildSubmissionPack(data);
    warnings = built.warnings;
    packFile = await storePack(studentId, built.zip);
  } catch (e) {
    return { error: `The submission pack could not be built: ${(e as Error).message}` };
  }

  const now = input.signedOffAt;
  const [sp] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, studentId)).limit(1);
  const [existingPilot] = await db.select({ id: pilotProfiles.id }).from(pilotProfiles).where(eq(pilotProfiles.userId, studentId)).limit(1);

  // Countersign any flights still waiting -- the logbook copy goes out "signed off".
  await db
    .update(flightLogEntries)
    .set({ verified: true, verifiedByUserId: staff.id, verifiedAt: now, instructorUserId: staff.id })
    .where(and(eq(flightLogEntries.studentId, studentId), eq(flightLogEntries.verified, false)));

  await db.insert(studentSignoffs).values({
    studentUserId: studentId,
    trainingType,
    signedOffByUserId: staff.id,
    signedOffAt: now,
    skillGrades: JSON.stringify(input.skillGrades),
    remedialAction: input.remedialAction,
    instructorLicenceNumber: input.instructorLicenceNumber,
    instructorRatingLine: input.instructorRatingLine ?? "",
    radioExaminerName: input.radioExaminerName,
    radioExaminerLicence: input.radioExaminerLicence,
    callSignChoices: input.callSignChoices.join("|"),
    studentSignatureApplied: !!data.studentSignature,
    instructorSignatureApplied: !!data.instructorSignature,
    medicalSignatureApplied: !!data.studentSignature && data.medicalSignatureAllowed,
    packFile,
    packGeneratedAt: now,
  });

  await db.update(users).set({ role: "pilot" }).where(eq(users.id, studentId));
  if (existingPilot) {
    await db.update(pilotProfiles).set({ awaitingCaaLicenceSince: now, status: "active" }).where(eq(pilotProfiles.id, existingPilot.id));
  } else {
    await db.insert(pilotProfiles).values({
      userId: studentId,
      callSign: sp?.callSign ?? null,
      sacaaNumber: sp?.sacaaNumber ?? null,
      sahpaNumber: sp?.sahpaNumber ?? null,
      sahpaExpiryDate: sp?.sahpaExpiryDate ?? null,
      status: "active",
      awaitingCaaLicenceSince: now,
    });
  }

  revalidatePath("/instructor");
  revalidatePath(`/instructor/students/${studentId}`);
  revalidatePath("/instructor/pilots");
  const wa = await notifySignoff(studentId, staff.id, student.name, staff.name, TRAINING_LABEL[trainingType]).catch(() => "WhatsApp could not be sent.");
  return { success: `${student.name} is signed off, awarded Solo wings and moved to Pilots (pending licence from CAA). ${wa}`, warnings };
}

/** Rebuilds the pack (e.g. after the student adds a signature or photo). Staff only. */
export async function regenerateSubmissionPack(_prev: SignoffState, formData: FormData): Promise<SignoffState> {
  const staff = await requireInstructor();
  const studentId = str(formData, "studentId");
  const trainingType = str(formData, "trainingType") as SignoffTrainingType;
  const [so] = await db.select().from(studentSignoffs).where(and(eq(studentSignoffs.studentUserId, studentId), eq(studentSignoffs.trainingType, trainingType))).limit(1);
  if (!so) return { error: "No sign-off found." };
  if (staff.role !== "cfi" && so.signedOffByUserId !== staff.id) return { error: "Only the signing instructor or the CFI can regenerate the pack." };
  try {
    const data = await gatherPackData(studentId, {
      trainingType,
      signedOffAt: so.signedOffAt,
      instructorUserId: so.signedOffByUserId,
      instructorLicenceNumber: so.instructorLicenceNumber ?? "",
      instructorRatingLine: so.instructorRatingLine ?? "",
      skillGrades: JSON.parse(so.skillGrades ?? "{}"),
      remedialAction: so.remedialAction ?? "",
      radioExaminerName: so.radioExaminerName ?? "",
      radioExaminerLicence: so.radioExaminerLicence ?? "",
      callSignChoices: (so.callSignChoices ?? "||").split("|").slice(0, 3) as [string, string, string],
    });
    const built = await buildSubmissionPack(data);
    const packFile = await storePack(studentId, built.zip);
    await db.update(studentSignoffs).set({
      packFile,
      packGeneratedAt: new Date(),
      studentSignatureApplied: !!data.studentSignature,
      instructorSignatureApplied: !!data.instructorSignature,
      medicalSignatureApplied: !!data.studentSignature && data.medicalSignatureAllowed,
    }).where(eq(studentSignoffs.id, so.id));
    revalidatePath(`/instructor/students/${studentId}`);
    return { success: "Pack regenerated.", warnings: built.warnings };
  } catch (e) {
    return { error: `Could not rebuild the pack: ${(e as Error).message}` };
  }
}
