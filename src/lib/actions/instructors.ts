"use server";

import { randomBytes } from "node:crypto";
import { eq, and, inArray } from "drizzle-orm";
import * as z from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireCFI } from "@/lib/auth/dal";
import { getBaseUrl } from "@/lib/base-url";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const NewInstructorSchema = z.object({
  name: z.string().trim().min(2, { error: "Enter the instructor's full name." }),
  email: z.string().trim().toLowerCase().email({ error: "Enter a valid email address." }),
});

export type NewInstructorState =
  | { error: string; inviteUrl?: never }
  | { error?: never; inviteUrl: string }
  | undefined;

/** CFI-only: creates a regular instructor account and returns an invite
 * link for them to set their own password. A regular instructor can sign
 * off exercises and countersign logbook entries -- nothing administrative
 * (no managing students, other instructors, the syllabus, or settings). */
export async function createInvitedInstructor(
  _prevState: NewInstructorState,
  formData: FormData
): Promise<NewInstructorState> {
  await requireCFI();

  const parsed = NewInstructorSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, email } = parsed.data;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return { error: "A user with that email already exists." };
  }

  const inviteToken = randomBytes(24).toString("base64url");

  await db.insert(users).values({
    name,
    email,
    role: "instructor",
    passwordHash: null,
    inviteToken,
    inviteTokenExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  revalidatePath("/instructor/team");

  const baseUrl = getBaseUrl();
  return { inviteUrl: `${baseUrl}/accept-invite/${inviteToken}` };
}

/** Regenerates an invite link for an instructor who hasn't activated yet. */
export async function resendInstructorInvite(instructorUserId: string) {
  await requireCFI();

  const inviteToken = randomBytes(24).toString("base64url");
  const inviteTokenExpiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await db
    .update(users)
    .set({ inviteToken, inviteTokenExpiresAt })
    .where(and(eq(users.id, instructorUserId), eq(users.role, "instructor")));

  revalidatePath("/instructor/team");

  const baseUrl = getBaseUrl();
  return { inviteUrl: `${baseUrl}/accept-invite/${inviteToken}` };
}

/** CFI-only: permanently removes a regular instructor's access. Scoped to
 * role "instructor" so this can never be used to remove a CFI account
 * (including the caller's own). */
export async function removeInstructor(instructorUserId: string) {
  await requireCFI();

  await db
    .delete(users)
    .where(and(eq(users.id, instructorUserId), eq(users.role, "instructor")));

  revalidatePath("/instructor/team");
}

export type InstructorSummary = {
  id: string;
  name: string;
  email: string;
  role: "cfi" | "instructor";
  active: boolean; // has a password set / has accepted their invite
};

/** CFI-only roster of every staff account (both roles), for the Team page. */
export async function listInstructors(): Promise<InstructorSummary[]> {
  await requireCFI();

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(inArray(users.role, ["cfi", "instructor"]))
    .orderBy(users.name);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role as "cfi" | "instructor",
    active: !!r.passwordHash,
  }));
}
