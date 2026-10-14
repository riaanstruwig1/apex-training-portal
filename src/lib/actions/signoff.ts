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
import { Grade, SignoffTrainingType, SkillGrades } from "@/lib/submission/types";

export type SignoffState = { error?: string; success?: string; warnings?: string[] } | undefined;

const GRADES: Grade[] = ["excellent", "good", "average", "need_practice"];
const GRADE_KEYS: (keyof SkillGrades)[] = ["takeoff", "landing", "turns360", "ridge", "spot", "engine", "weather", "airlaw", "turbulence"];
const TYPES: SignoffTrainingType[] = ["pg", "ppg", "ppt"];

function str(fd: FormData, k: string): string {
  return String(fd.get(k) ?? "").trim();
}

/** Student/pilot ticks (or un-ticks) permission to put their saved signature on the submission forms. */
export async function setSignatureFormsConsent(_prev: SignoffState, formData: FormData): Promise<SignoffState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired -- please sign in again." };
  const on = formData.get("consent") === "on";
  await db.update(users).set({ signatureFormsConsentAt: on ? new Date() : null }).where(eq(users.id, user.id));
  revalidatePath("/student/profile");
  revalidatePath("/pilot/profile");
  return { success: on ? "Saved - your signature may be placed on your submission forms." : "Saved - your signature will not be placed on forms." };
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
    surname: str(formData, "surname"),
    firstNames: str(formData, "firstNames"),
    skillGrades,
    remedialAction: str(formData, "remedialAction"),
    radioExaminerName: str(formData, "radioExaminerName"),
    radioExaminerLicence: str(formData, "radioExaminerLicence"),
    callSignChoices: [str(formData, "callSign1"), str(formData, "callSign2"), str(formData, "callSign3")],
  };
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
  return { success: `${student.name} is signed off, awarded Solo wings and moved to Pilots (pending licence from CAA).`, warnings };
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
