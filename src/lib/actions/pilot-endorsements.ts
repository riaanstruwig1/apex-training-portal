"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { pilotEndorsements } from "@/db/schema";
import { requirePilot } from "@/lib/auth/dal";
import { ENDORSEMENT_OPTIONS } from "@/lib/pilot-endorsements";

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
 */
export async function applyForEndorsement(key: string) {
  const { profile } = await requirePilot();
  if (!profile) return;

  if (!ENDORSEMENT_OPTIONS.some((o) => o.key === key)) return;

  const [existing] = await db
    .select()
    .from(pilotEndorsements)
    .where(
      and(eq(pilotEndorsements.pilotProfileId, profile.id), eq(pilotEndorsements.key, key))
    )
    .limit(1);

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
}
