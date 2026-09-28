"use server";

import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdminOrCFI } from "@/lib/auth/dal";
import { sendEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/base-url";

const RequestSchema = z.object({
  email: z.string().trim().toLowerCase().email({ error: "Enter a valid email address." }),
});

export type RequestPasswordResetState =
  | { error: string; success?: never }
  | { error?: never; success: true }
  | undefined;

// A reset link is only good for an hour -- long enough to check your email
// right after requesting it, short enough that an old, unused link sitting
// in an inbox isn't a standing risk.
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Public "Forgot your password?" flow (V22 rollout item 11, 23 Sep 2026;
 * upgraded to a real emailed link in "V23" item 5, 25 Sep 2026, now that
 * Resend's sending domain is verified in production). Always returns the
 * same generic success message regardless of whether the email matched an
 * account, so this can't be used to probe which emails have accounts here.
 *
 * If the email can't actually be sent (Resend not configured, or the send
 * fails) this falls back to exactly what it always did: flag the account
 * for CFI/Admin attention on the /admin/password-resets queue, so a person
 * is never simply stuck because of an email problem on our end.
 */
export async function requestPasswordReset(
  _prevState: RequestPasswordResetState,
  formData: FormData
): Promise<RequestPasswordResetState> {
  const parsed = RequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  const [match] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (match) {
    const token = randomBytes(32).toString("base64url");
    const resetUrl = `${getBaseUrl()}/reset-password/${token}`;

    const result = await sendEmail({
      to: match.email,
      subject: "Reset your Apex Flight Hub password",
      text:
        `Hi ${match.name},\n\n` +
        `Someone (hopefully you) asked to reset the password on your Apex Flight Hub account.\n\n` +
        `Reset it here (this link works for 1 hour):\n${resetUrl}\n\n` +
        `If you didn't ask for this, you can ignore this email -- your password won't change.\n\n` +
        `-- Apex Flight Hub`,
      html:
        `<p>Hi ${match.name},</p>` +
        `<p>Someone (hopefully you) asked to reset the password on your Apex Flight Hub account.</p>` +
        `<p><a href="${resetUrl}">Reset your password</a> (this link works for 1 hour).</p>` +
        `<p>If you didn't ask for this, you can ignore this email -- your password won't change.</p>` +
        `<p>-- Apex Flight Hub</p>`,
    });

    if (result.sent) {
      await db
        .update(users)
        .set({
          passwordResetToken: token,
          passwordResetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        })
        .where(eq(users.id, match.id));
    } else {
      // Couldn't email it -- fall back to the CFI/Admin queue exactly as
      // before, rather than leaving the person with no way forward.
      await db
        .update(users)
        .set({ passwordResetRequestedAt: new Date() })
        .where(eq(users.id, match.id));
      revalidatePath("/admin/password-resets");
    }
  }

  return { success: true };
}

/**
 * CFI/Admin clears a pending request without necessarily resetting the
 * password (they handled it another way, or it was a duplicate) -- just
 * drops it off the queue.
 */
export async function dismissPasswordResetRequest(targetUserId: string): Promise<void> {
  await requireAdminOrCFI();
  await db
    .update(users)
    .set({ passwordResetRequestedAt: null })
    .where(eq(users.id, targetUserId));
  revalidatePath("/admin/password-resets");
}
