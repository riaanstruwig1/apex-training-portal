"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { medicalDeclarationEligibility } from "@/lib/medical";

/**
 * Online self-declare path for the SAHPA Appendix R62.22 "Pilot's
 * Declaration of Medical Fitness" -- the alternative to downloading the
 * form, getting it signed, and uploading it back. Re-checks eligibility
 * server-side (age < 60, known DOB) rather than trusting the client: the
 * button is hidden client-side too, but DOB is admin/CFI-controlled and
 * could change between page load and submit, or a request could be crafted
 * directly.
 */
const MedicalDeclarationSchema = z.object({
  declaredName: z
    .string()
    .trim()
    .min(1, { error: "Type your full name to sign the declaration." }),
});

export type MedicalDeclarationState =
  | { error: string; success?: never }
  | { error?: never; success: true }
  | undefined;

export async function signOwnMedicalDeclaration(
  _prevState: MedicalDeclarationState,
  formData: FormData
): Promise<MedicalDeclarationState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired -- please sign in again." };

  const eligibility = medicalDeclarationEligibility(user.dob);
  if (!eligibility.eligible) {
    return {
      error:
        eligibility.reason === "over_60"
          ? "Online self-declaration isn't available for pilots 60 or over -- the form requires a Medical Practitioner's Declaration instead. Download the form, get it signed by a medical practitioner, and upload the signed copy."
          : "We don't have your date of birth on file, so online self-declaration isn't available -- download the form, get it signed, and upload the signed copy instead.",
    };
  }

  const parsed = MedicalDeclarationSchema.safeParse({
    declaredName: formData.get("declaredName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please type your full name." };
  }

  await db
    .update(users)
    .set({
      medicalDeclarationSignedAt: new Date(),
      medicalDeclarationSignedName: parsed.data.declaredName,
    })
    .where(eq(users.id, user.id));

  revalidatePath("/pilot/profile");
  revalidatePath("/student/profile");
  revalidatePath(`/admin/applicants/${user.id}`);
  revalidatePath(`/instructor/students/${user.id}`);
  return { success: true };
}
