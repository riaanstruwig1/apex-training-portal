"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { pilotEndorsements } from "@/db/schema";
import { requirePilot } from "@/lib/auth/dal";
import { ENDORSEMENT_OPTIONS } from "@/lib/pilot-endorsements";
import { computeLadder, type Equipment } from "@/lib/pilot-progress";

export type ApplyEndorsementResult = { error?: string };

/**
 * A pilot self-declares a licence/endorsement/rating they want reviewed --
 * either at sign-up (existing flow) or, as of v17, any time after from their
 * own dashboard via the ladder/checklist "Apply" button. Idempotent: if
 * they've already declared this key (pending or verified), this is a no-op.
 * Verification still requires a CFI/Admin, same as everything else here.
 *
 * If the pilot previously declared this and it was since declined by a
 * CFI/Admin, re-applying clears the decline (reason/timestamp/reviewer) and
 * re-stamps declaredAt, sending it back into the pending queue -- otherwise a
 * declined pilot would have no way to ever apply again.
 *
 * Ladder-tier keys (Basic/Intermediate/Sport/Tandem) are additionally gated
 * server-side as of 21 Sep 2026 (Notes4 item 18): the pilot dashboard's own
 * ladder UI already hides the Apply button for a locked/ineligible tier, but
 * that was only a client-side hint -- this action itself accepted any valid
 * key with no ordering check, so calling it directly (bypassing the UI)
 * could jump the queue, e.g. applying for Tandem without holding Sport. Non-
 * tiered keys (add-ons, instructor/display ratings) are unaffected.
 */
export async function applyForEndorsement(key: string): Promise<ApplyEndorsementResult> {
  const { profile } = await requirePilot();
  if (!profile) return {};

  const option = ENDORSEMENT_OPTIONS.find((o) => o.key === key);
  if (!option) return {};

  const existingRows = await db
    .select()
    .from(pilotEndorsements)
    .where(eq(pilotEndorsements.pilotProfileId, profile.id));
  const existing = existingRows.find((r) => r.key === key);

  if (option.tier && option.equipment && !existing?.verified) {
    const ladder = computeLadder(option.equipment as Equipment, existingRows);
    const state = ladder.find((t) => t.key === key);
    if (!state?.eligible) {
      return { error: "That rating isn't open to apply for yet -- the prerequisite tier isn't held." };
    }
  }

  if (!existing) {
    await db.insert(pilotEndorsements).values({
      pilotProfileId: profile.id,
      key,
      declaredAt: new Date(),
    });
  } else if (existing.declined) {
    await db
      .update(pilotEndorsements)
      .set({
        declaredAt: new Date(),
        declined: false,
        declineReason: null,
        declinedAt: null,
        declinedByUserId: null,
      })
      .where(eq(pilotEndorsements.id, existing.id));
  }

  revalidatePath("/pilot");
  return {};
}
