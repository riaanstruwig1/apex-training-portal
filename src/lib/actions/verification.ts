"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { db } from "@/db";
import { users, pilotProfiles, pilotEndorsements, studentProfiles } from "@/db/schema";
import { requireAdminOrCFI } from "@/lib/auth/dal";

/**
 * Approves a pending Student or Pilot application. For a pilot, only the
 * endorsement keys passed in `verifiedEndorsementKeys` get marked verified
 * -- the reviewer can approve the account while leaving individual
 * endorsements unverified if they're not satisfied on all of them yet (the
 * dashboard only ever shows verified items, per SOW 3.7).
 */
export async function approveApplicant(
  userId: string,
  verifiedEndorsementKeys: string[] = []
) {
  const reviewer = await requireAdminOrCFI();

  const [applicant] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!applicant || applicant.accountStatus !== "pending_verification") {
    return;
  }

  await db
    .update(users)
    .set({ accountStatus: "active", rejectionReason: null })
    .where(eq(users.id, userId));

  if (applicant.role === "pilot") {
    const [profile] = await db
      .select()
      .from(pilotProfiles)
      .where(eq(pilotProfiles.userId, userId))
      .limit(1);

    if (profile) {
      await db
        .update(pilotProfiles)
        .set({ status: "active" })
        .where(eq(pilotProfiles.id, profile.id));

      const keySet = new Set(verifiedEndorsementKeys);
      const declared = await db
        .select()
        .from(pilotEndorsements)
        .where(eq(pilotEndorsements.pilotProfileId, profile.id));

      for (const endorsement of declared) {
        if (keySet.has(endorsement.key) && !endorsement.verified) {
          await db
            .update(pilotEndorsements)
            .set({ verified: true, verifiedAt: new Date(), verifiedByUserId: reviewer.id })
            .where(eq(pilotEndorsements.id, endorsement.id));
        }
      }
    }
  }

  revalidatePath("/admin");
}

export async function rejectApplicant(userId: string, reason: string) {
  await requireAdminOrCFI();

  await db
    .update(users)
    .set({ accountStatus: "rejected", rejectionReason: reason || null })
    .where(eq(users.id, userId));

  revalidatePath("/admin");
}

/** Lets a reviewer set/correct a student applicant's training type at
 * verification time -- the student picks one at sign-up, but this gives the
 * CFI/Admin a chance to fix it before (or after) approving them. */
export async function updateApplicantTrainingType(
  studentUserId: string,
  trainingType: "pg" | "ppg" | "ppt"
) {
  await requireAdminOrCFI();

  await db
    .update(studentProfiles)
    .set({ trainingType })
    .where(eq(studentProfiles.userId, studentUserId));

  revalidatePath("/admin");
  revalidatePath(`/admin/applicants/${studentUserId}`);
}

/** Verifies (or un-verifies) one already-approved pilot's single
 * endorsement -- for the case where new endorsements get added/reviewed
 * after the account is already active, not just at first sign-up. */
export async function setEndorsementVerified(
  endorsementId: string,
  verified: boolean
) {
  const reviewer = await requireAdminOrCFI();

  await db
    .update(pilotEndorsements)
    .set({
      verified,
      verifiedAt: verified ? new Date() : null,
      verifiedByUserId: verified ? reviewer.id : null,
      // Verifying always supersedes an earlier decline -- whichever action
      // ran most recently wins (see the schema's own comment).
      ...(verified
        ? { declined: false, declineReason: null, declinedAt: null, declinedByUserId: null }
        : {}),
    })
    .where(eq(pilotEndorsements.id, endorsementId));

  revalidatePath("/admin");
  revalidatePath("/pilot");
}

const DeclineReasonSchema = z.string().trim().min(1, { error: "Enter a reason for declining." }).max(500);

/**
 * Declines a single declared endorsement with a required comment (Notes3
 * item 7) -- distinct from rejecting a whole application (ApplicantReview
 * Actions), which only applies while pending_verification. This works on
 * any declared item, pending or already-active-pilot, same as
 * setEndorsementVerified above.
 */
export async function declineEndorsement(endorsementId: string, reason: string) {
  const reviewer = await requireAdminOrCFI();

  const parsed = DeclineReasonSchema.safeParse(reason);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a reason." };
  }

  await db
    .update(pilotEndorsements)
    .set({
      declined: true,
      declineReason: parsed.data,
      declinedAt: new Date(),
      declinedByUserId: reviewer.id,
      // A decline always supersedes a previous verification.
      verified: false,
      verifiedAt: null,
      verifiedByUserId: null,
    })
    .where(eq(pilotEndorsements.id, endorsementId));

  revalidatePath("/admin");
  revalidatePath("/pilot");
}
