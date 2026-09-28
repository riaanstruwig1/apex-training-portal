"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as z from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";

const ResetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, { error: "New password must be at least 8 characters." }),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordState =
  | { error: string; success?: never }
  | { error?: never; success: true }
  | undefined;

/** Looked up by the reset-password page itself before showing the form, so
 * an expired/already-used/bogus link gets a clear message right away
 * instead of only failing on submit. Read-only -- doesn't consume anything. */
export async function isResetTokenValid(token: string): Promise<boolean> {
  if (!token) return false;
  const [row] = await db
    .select({ passwordResetTokenExpiresAt: users.passwordResetTokenExpiresAt })
    .from(users)
    .where(eq(users.passwordResetToken, token))
    .limit(1);
  return !!row?.passwordResetTokenExpiresAt && row.passwordResetTokenExpiresAt > new Date();
}

/**
 * Consumes an emailed reset link ("V23" item 5, 25 Sep 2026) -- sets a new
 * password and single-use-invalidates the token (cleared either way, so a
 * link can't be replayed after a successful reset). Also clears the older
 * CFI/Admin-queue flag (passwordResetRequestedAt), if it happened to be set
 * too, since this resolves the same underlying request.
 */
export async function resetPasswordWithToken(
  token: string,
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const parsed = ResetPasswordSchema.safeParse({
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const [row] = await db
    .select({ id: users.id, passwordResetTokenExpiresAt: users.passwordResetTokenExpiresAt })
    .from(users)
    .where(eq(users.passwordResetToken, token))
    .limit(1);

  if (!row || !row.passwordResetTokenExpiresAt || row.passwordResetTokenExpiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired -- request a new one from the login page." };
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db
    .update(users)
    .set({
      passwordHash: newHash,
      passwordResetToken: null,
      passwordResetTokenExpiresAt: null,
      passwordResetRequestedAt: null,
    })
    .where(eq(users.id, row.id));

  return { success: true };
}
