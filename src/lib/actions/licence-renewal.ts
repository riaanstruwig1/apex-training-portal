"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { pilotProfiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { saveUpload, UploadError } from "@/lib/uploads";

/**
 * Self-service re-upload of a pilot's CAA licence once the on-file one has
 * expired (V22 rollout items 6/7, 23 Sep 2026 -- Riaan: "Pilot must submit
 * new lic for review when expired"). Deliberately does NOT touch
 * caaLicenceExpiryDate -- only a CFI/Admin can push that forward
 * (adminUpdateProfile in profile.ts), after actually reviewing the new
 * document. Submitting here just replaces the file on record; the pilot
 * stays behind LicenceExpiredGate (wired into PilotLayout) until a CFI/
 * Admin reviews it and updates the expiry date.
 */
export type LicenceRenewalState =
  | { error: string; success?: never }
  | { error?: never; success: true }
  | undefined;

export async function submitRenewedLicence(
  _prevState: LicenceRenewalState,
  formData: FormData
): Promise<LicenceRenewalState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired -- please sign in again." };
  if (user.role !== "pilot") {
    return { error: "Not available for this account type." };
  }

  const file = formData.get("caaLicenceFile");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a copy of your renewed licence to submit." };
  }

  let filename: string | null;
  try {
    filename = await saveUpload(user.id, "caa-licence", file);
  } catch (err) {
    return { error: err instanceof UploadError ? err.message : "caaLicenceFile: upload failed." };
  }
  if (!filename) {
    return { error: "Choose a copy of your renewed licence to submit." };
  }

  await db
    .update(pilotProfiles)
    .set({ caaLicenceFile: filename })
    .where(eq(pilotProfiles.userId, user.id));

  revalidatePath("/pilot");
  return { success: true };
}
