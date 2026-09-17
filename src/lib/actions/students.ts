"use server";

import { randomBytes } from "node:crypto";
import { eq, and } from "drizzle-orm";
import * as z from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users, studentProfiles, studentExerciseProgress } from "@/db/schema";
import { requireInstructor, requireCFI } from "@/lib/auth/dal";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const NewStudentSchema = z.object({
  name: z.string().trim().min(2, { error: "Enter the student's full name." }),
  email: z.string().trim().toLowerCase().email({ error: "Enter a valid email address." }),
  phone: z.string().trim().optional(),
  trainingType: z.enum(["pg", "ppg", "ppt"], {
    error: "Select what training this student is signed up for.",
  }),
  callSign: z.string().trim().toUpperCase().optional(),
  startDate: z.string().trim().optional(),
  sahpaNumber: z.string().trim().optional(),
  sahpaExpiryDate: z.string().trim().optional(),
});

export type NewStudentState = { error: string; inviteUrl?: never } | { error?: never; inviteUrl: string } | undefined;

/**
 * Manually adds a student and generates an invite link, for use until the
 * Shopify "Student" tag webhook is wired up (or as a fallback alongside it).
 * The instructor copies the link and sends it to the student directly.
 */
export async function createInvitedStudent(
  _prevState: NewStudentState,
  formData: FormData
): Promise<NewStudentState> {
  await requireCFI();

  const parsed = NewStudentSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    trainingType: formData.get("trainingType") || undefined,
    callSign: formData.get("callSign") || undefined,
    startDate: formData.get("startDate") || undefined,
    sahpaNumber: formData.get("sahpaNumber") || undefined,
    sahpaExpiryDate: formData.get("sahpaExpiryDate") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, email, phone, trainingType, callSign, startDate, sahpaNumber, sahpaExpiryDate } =
    parsed.data;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return { error: "A user with that email already exists." };
  }

  const inviteToken = randomBytes(24).toString("base64url");

  const [user] = await db
    .insert(users)
    .values({ name, email, role: "student", passwordHash: null })
    .returning();

  await db.insert(studentProfiles).values({
    userId: user.id,
    phone,
    trainingType,
    callSign,
    startDate: startDate ? new Date(startDate) : undefined,
    sahpaNumber,
    sahpaExpiryDate: sahpaExpiryDate ? new Date(sahpaExpiryDate) : undefined,
    status: "invited",
    inviteToken,
    inviteTokenExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  revalidatePath("/instructor");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return { inviteUrl: `${baseUrl}/accept-invite/${inviteToken}` };
}

/** Regenerates an invite link for an already-invited (not yet activated)
 * student -- used both for a fresh resend and to surface the link for a
 * student who came in via the Shopify webhook (which has no way to email
 * them itself yet). */
export async function resendInvite(studentUserId: string) {
  await requireCFI();

  const inviteToken = randomBytes(24).toString("base64url");
  const inviteTokenExpiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await db
    .update(studentProfiles)
    .set({ inviteToken, inviteTokenExpiresAt })
    .where(eq(studentProfiles.userId, studentUserId));

  revalidatePath("/instructor");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return { inviteUrl: `${baseUrl}/accept-invite/${inviteToken}` };
}

/** Archives a student: hides them from the main roster without deleting
 * their data (logbook, sign-offs, etc. are all kept). Reversible. */
export async function archiveStudent(studentUserId: string) {
  await requireCFI();

  await db
    .update(studentProfiles)
    .set({ status: "archived" })
    .where(eq(studentProfiles.userId, studentUserId));

  revalidatePath("/instructor");
}

/** Restores a previously-archived student back to "active". */
export async function restoreStudent(studentUserId: string) {
  await requireCFI();

  await db
    .update(studentProfiles)
    .set({ status: "active" })
    .where(eq(studentProfiles.userId, studentUserId));

  revalidatePath("/instructor");
}

/** Permanently deletes a student and everything tied to their account --
 * their profile, exercise sign-offs and flight log entries all cascade-
 * delete along with the user row. Not reversible; the UI should confirm
 * before calling this. */
export async function deleteStudent(studentUserId: string) {
  await requireCFI();

  // Guard the role too, not just the id -- this action should never be able
  // to delete an instructor account even if called with a bad id.
  await db
    .delete(users)
    .where(and(eq(users.id, studentUserId), eq(users.role, "student")));

  revalidatePath("/instructor");
}

const StatusEnum = z.enum(["not_started", "in_progress", "signed_off"]);

/** Instructor sign-off / status update on one exercise for one student. */
export async function setExerciseStatus(
  studentId: string,
  exerciseId: string,
  status: z.infer<typeof StatusEnum>,
  notes: string
) {
  const instructor = await requireInstructor();
  StatusEnum.parse(status);

  const [existing] = await db
    .select()
    .from(studentExerciseProgress)
    .where(
      and(
        eq(studentExerciseProgress.studentId, studentId),
        eq(studentExerciseProgress.exerciseId, exerciseId)
      )
    )
    .limit(1);

  const signedOff = status === "signed_off";

  if (existing) {
    await db
      .update(studentExerciseProgress)
      .set({
        status,
        notes: notes || null,
        signedOffByUserId: signedOff ? instructor.id : existing.signedOffByUserId,
        signedOffAt: signedOff ? new Date() : existing.signedOffAt,
        updatedAt: new Date(),
      })
      .where(eq(studentExerciseProgress.id, existing.id));
  } else {
    await db.insert(studentExerciseProgress).values({
      studentId,
      exerciseId,
      status,
      notes: notes || null,
      signedOffByUserId: signedOff ? instructor.id : null,
      signedOffAt: signedOff ? new Date() : null,
    });
  }

  revalidatePath(`/instructor/students/${studentId}`);
  revalidatePath("/student/exercises");
  revalidatePath("/student");
}

/** Instructor sets/edits a student's call sign, start date, SAHPA membership
 * number and SAHPA expiry date together (the small identity/certification
 * fields shown on the folio header). */
export async function updateStudentDetails(
  studentUserId: string,
  details: {
    callSign: string;
    startDate: string;
    sahpaNumber: string;
    sahpaExpiryDate: string;
    trainingType?: "pg" | "ppg" | "ppt" | null;
  }
) {
  await requireCFI();

  await db
    .update(studentProfiles)
    .set({
      callSign: details.callSign.trim().toUpperCase() || null,
      startDate: details.startDate ? new Date(details.startDate) : null,
      sahpaNumber: details.sahpaNumber.trim() || null,
      sahpaExpiryDate: details.sahpaExpiryDate
        ? new Date(details.sahpaExpiryDate)
        : null,
      ...(details.trainingType !== undefined ? { trainingType: details.trainingType } : {}),
    })
    .where(eq(studentProfiles.userId, studentUserId));

  revalidatePath(`/instructor/students/${studentUserId}`);
  revalidatePath("/student");
}
