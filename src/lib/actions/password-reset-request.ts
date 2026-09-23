"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdminOrCFI } from "@/lib/auth/dal";

const RequestSchema = z.object({
  email: z.string().trim().toLowerCase().email({ error: "Enter a valid email address." }),
});

export type RequestPasswordResetState =
  | { error: string; success?: never }
  | { error?: never; success: true }
  | undefined;

/**
 * Public "Forgot your password?" flow (V22 rollout item 11, 23 Sep 2026).
 * This app has no outbound email provider (see adminResetPassword's own
 * comment in src/lib/actions/profile.ts), so there's no reset link to send
 * -- instead this just flags the matching account, if there is one, for
 * CFI/Admin attention on a dedicated queue page (/admin/password-resets),
 * same spirit as the existing verification queue: they call/message the
 * person and reset it from there. Always returns the same generic success
 * message regardless of whether the email matched an account, so this
 * can't be used to probe which emails have accounts here.
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
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (match) {
    await db
      .update(users)
      .set({ passwordResetRequestedAt: new Date() })
      .where(eq(users.id, match.id));
    revalidatePath("/admin/password-resets");
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
