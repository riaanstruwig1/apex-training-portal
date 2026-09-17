"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";

/**
 * Signs a student/pilot's own Consent & Indemnity forms after the fact --
 * for the case where a CFI/Admin added the account directly (the "Add
 * student" flow, or a pilot created without going through public sign-up),
 * which never collects these two signatures the way the public /signup form
 * does. Notes3 item 9: previously an unsigned account showed only a status
 * badge on the admin review page -- nothing actually stopped the student/
 * pilot from using the rest of the app. This is the self-serve completion
 * of that same signature, gated by StudentLayout/PilotLayout so the account
 * can't be used at all until it's done -- a real hard gate, not just a
 * warning badge.
 */
const ConsentSignSchema = z.object({
  consentName: z.string().trim().min(1, { error: "Type your full name to sign the Client Consent Form." }),
  indemnityName: z.string().trim().min(1, { error: "Type your full name to sign the Indemnity / Assumption of Risk & Release." }),
});

export async function signOwnConsentAndIndemnity(
  prevState: unknown,
  formData: FormData
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired -- please sign in again." };

  const parsed = ConsentSignSchema.safeParse({
    consentName: formData.get("consentName"),
    indemnityName: formData.get("indemnityName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please fill in both fields." };
  }

  const now = new Date();
  await db
    .update(users)
    .set({
      consentSigned: true,
      consentSignedAt: now,
      consentSignedName: parsed.data.consentName,
      indemnitySigned: true,
      indemnitySignedAt: now,
      indemnitySignedName: parsed.data.indemnityName,
    })
    .where(eq(users.id, user.id));

  revalidatePath("/student");
  revalidatePath("/pilot");
  revalidatePath(`/admin/applicants/${user.id}`);
  return { success: true };
}
