"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users, pilotProfiles } from "@/db/schema";
import { requireCFI, requireInstructor } from "@/lib/auth/dal";
import { logActivity } from "@/lib/activity-log";

// CFI-only housekeeping for pilot accounts (15 Oct 2026, Riaan). Only plain
// "pilot" accounts can be archived/deleted here -- never a CFI or instructor.

async function assertPlainPilot(userId: string) {
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u || u.role !== "pilot") throw new Error("Only a pilot account can be changed here.");
}

/** Hides a pilot from the Pilots list; everything is kept. Reversible. */
export async function archivePilot(pilotUserId: string) {
  await requireCFI();
  await assertPlainPilot(pilotUserId);
  await db.update(pilotProfiles).set({ status: "archived" }).where(eq(pilotProfiles.userId, pilotUserId));
  revalidatePath("/admin/pilots");
}

export async function restorePilot(pilotUserId: string) {
  await requireCFI();
  await assertPlainPilot(pilotUserId);
  await db.update(pilotProfiles).set({ status: "active" }).where(eq(pilotProfiles.userId, pilotUserId));
  revalidatePath("/admin/pilots");
}

/** Permanently deletes the pilot's account and everything tied to it
 * (profile, endorsements, logbook, sign-off records cascade). Not reversible. */
export async function deletePilot(pilotUserId: string) {
  await requireCFI();
  await db.delete(users).where(and(eq(users.id, pilotUserId), eq(users.role, "pilot")));
  revalidatePath("/admin/pilots");
}

/** CFI edits a pilot's call sign, SACAA No., SAHPA No. and SAHPA expiry. */
export async function updatePilotDetails(
  pilotUserId: string,
  d: { callSign: string; sacaaNumber: string; sahpaNumber: string; sahpaExpiryDate: string; caaLicenceExpiryDate?: string }
) {
  // Batch 103 (Riaan, 24 Nov 2026): CFI and instructors edit a pilot's
  // details, now incl. the SACAA licence expiry (logged).
  const staff = await requireInstructor();
  await assertPlainPilot(pilotUserId);
  await logActivity(
    staff,
    "edit_pilot_details",
    pilotUserId,
    [d.sacaaNumber && `SACAA ${d.sacaaNumber.trim()}`, d.caaLicenceExpiryDate && `SACAA expiry ${d.caaLicenceExpiryDate}`, d.sahpaExpiryDate && `SAHPA expiry ${d.sahpaExpiryDate}`]
      .filter(Boolean)
      .join(", ") || null
  );
  await db
    .update(pilotProfiles)
    .set({
      callSign: d.callSign.trim().toUpperCase() || null,
      sacaaNumber: d.sacaaNumber.trim() || null,
      sahpaNumber: d.sahpaNumber.trim() || null,
      sahpaExpiryDate: d.sahpaExpiryDate ? new Date(d.sahpaExpiryDate) : null,
      ...(d.caaLicenceExpiryDate !== undefined
        ? {
            caaLicenceExpiryDate: d.caaLicenceExpiryDate ? new Date(d.caaLicenceExpiryDate) : null,
            // A new expiry date clears a "renewed licence submitted" flag (same as the profile editor).
            ...(d.caaLicenceExpiryDate ? { caaLicenceRenewalSubmittedAt: null } : {}),
          }
        : {}),
    })
    .where(eq(pilotProfiles.userId, pilotUserId));
  revalidatePath("/admin/pilots");
  revalidatePath(`/admin/applicants/${pilotUserId}`);
}
