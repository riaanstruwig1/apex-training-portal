"use server";

import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as z from "zod";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, studentProfiles } from "@/db/schema";
import { createSession } from "@/lib/auth/session";

const AcceptInviteSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8, { error: "Password must be at least 8 characters." }),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type AcceptInviteState = { error: string } | undefined;

const INVALID_OR_EXPIRED =
  "This invite link is invalid or has expired. Ask your Chief Flight Instructor to resend it.";

/** Handles both invite kinds with the same form/page: a student invite
 * (token lives on studentProfiles) and an instructor invite (token lives
 * directly on users, since instructors have no profile row). Whichever
 * table the token matches decides what happens next. */
export async function acceptInvite(
  _prevState: AcceptInviteState,
  formData: FormData
): Promise<AcceptInviteState> {
  const parsed = AcceptInviteSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { token, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  const [studentProfile] = await db
    .select()
    .from(studentProfiles)
    .where(
      and(
        eq(studentProfiles.inviteToken, token),
        gt(studentProfiles.inviteTokenExpiresAt, new Date())
      )
    )
    .limit(1);

  if (studentProfile) {
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, studentProfile.userId));

    await db
      .update(studentProfiles)
      .set({ status: "active", inviteToken: null, inviteTokenExpiresAt: null })
      .where(eq(studentProfiles.id, studentProfile.id));

    await createSession(studentProfile.userId, "student");
    redirect("/student");
  }

  const [instructorUser] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.inviteToken, token),
        eq(users.role, "instructor"),
        gt(users.inviteTokenExpiresAt, new Date())
      )
    )
    .limit(1);

  if (instructorUser) {
    await db
      .update(users)
      .set({ passwordHash, inviteToken: null, inviteTokenExpiresAt: null })
      .where(eq(users.id, instructorUser.id));

    await createSession(instructorUser.id, "instructor");
    redirect("/instructor");
  }

  return { error: INVALID_OR_EXPIRED };
}
