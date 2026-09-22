"use server";

import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { db } from "@/db";
import { users, pilotProfiles, pilotEndorsements, studentProfiles } from "@/db/schema";
import { requireAdminOrCFI } from "@/lib/auth/dal";
import { ENDORSEMENT_OPTIONS, endorsementLabel } from "@/lib/pilot-endorsements";
import { sendEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/base-url";

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

/**
 * Lets a CFI/Admin grant a rating directly to a pilot during review --
 * added 20 Sep 2026 (Notes4 item 11, the Henna Fourie case): a reviewer
 * could already edit a pilot's personal details during verification but had
 * no way to add a rating the pilot hadn't self-declared at sign-up. If the
 * pilot already declared this key, this just verifies it (same effect as
 * PilotEndorsementToggle's "Verify", but usable before first approval too,
 * since the ladder/flat-list toggles were gated to accountStatus==="active").
 * If they never declared it, this creates the row and verifies it in one
 * step -- the CFI's own judgement stands in for the pilot's declaration.
 */
export async function adminGrantEndorsement(
  pilotProfileId: string,
  applicantUserId: string,
  key: string
) {
  const reviewer = await requireAdminOrCFI();
  if (!ENDORSEMENT_OPTIONS.some((o) => o.key === key)) return;

  const [existing] = await db
    .select()
    .from(pilotEndorsements)
    .where(
      and(eq(pilotEndorsements.pilotProfileId, pilotProfileId), eq(pilotEndorsements.key, key))
    )
    .limit(1);

  if (!existing) {
    await db.insert(pilotEndorsements).values({
      pilotProfileId,
      key,
      declaredAt: new Date(),
      verified: true,
      verifiedAt: new Date(),
      verifiedByUserId: reviewer.id,
    });
  } else if (!existing.verified) {
    await db
      .update(pilotEndorsements)
      .set({
        verified: true,
        verifiedAt: new Date(),
        verifiedByUserId: reviewer.id,
        declined: false,
        declineReason: null,
        declinedAt: null,
        declinedByUserId: null,
      })
      .where(eq(pilotEndorsements.id, existing.id));
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/applicants/${applicantUserId}`);
  revalidatePath("/pilot");
}

/**
 * Sets (or clears) a pilot's held instructor grade for one equipment type
 * (PG/PPG/PPT) -- Notes4 item 15, the three-column instructor-ratings grid.
 * A pilot only ever holds one grade per equipment (Grade A supersedes B
 * supersedes C), so setting a new grade removes any other grade row already
 * declared for that same equipment -- there's no separate "un-declare"
 * control needed, selecting the new grade (or "None") is the whole
 * interaction. Passing `grade: null` clears the column entirely.
 */
export async function adminSetInstructorGrade(
  pilotProfileId: string,
  applicantUserId: string,
  equipment: "pg" | "ppg" | "ppt",
  grade: "c" | "b" | "a" | null
) {
  const reviewer = await requireAdminOrCFI();

  const gradeKeys: Record<"c" | "b" | "a", string> = {
    c: `instructor_${equipment}_grade_c`,
    b: `instructor_${equipment}_grade_b`,
    a: `instructor_${equipment}_grade_a`,
  };
  const targetKey = grade ? gradeKeys[grade] : null;
  const keysToRemove = Object.values(gradeKeys).filter((k) => k !== targetKey);

  if (keysToRemove.length > 0) {
    await db
      .delete(pilotEndorsements)
      .where(
        and(
          eq(pilotEndorsements.pilotProfileId, pilotProfileId),
          inArray(pilotEndorsements.key, keysToRemove)
        )
      );
  }

  if (targetKey) {
    const [existing] = await db
      .select()
      .from(pilotEndorsements)
      .where(
        and(eq(pilotEndorsements.pilotProfileId, pilotProfileId), eq(pilotEndorsements.key, targetKey))
      )
      .limit(1);

    if (!existing) {
      await db.insert(pilotEndorsements).values({
        pilotProfileId,
        key: targetKey,
        declaredAt: new Date(),
        verified: true,
        verifiedAt: new Date(),
        verifiedByUserId: reviewer.id,
      });
    } else if (!existing.verified || existing.declined) {
      await db
        .update(pilotEndorsements)
        .set({
          verified: true,
          verifiedAt: new Date(),
          verifiedByUserId: reviewer.id,
          declined: false,
          declineReason: null,
          declinedAt: null,
          declinedByUserId: null,
        })
        .where(eq(pilotEndorsements.id, existing.id));
    }
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/applicants/${applicantUserId}`);
  revalidatePath("/pilot");
}

/**
 * Toggles the single, equipment-agnostic "Assistant Instructor" rating --
 * the fourth rung of the instructor-ratings grid, shown once above the
 * PG/PPG/PPT columns since (per Riaan's own list) it isn't tracked
 * separately per equipment type.
 */
export async function adminSetAssistantInstructor(
  pilotProfileId: string,
  applicantUserId: string,
  on: boolean
) {
  const reviewer = await requireAdminOrCFI();
  const key = "assistant_instructor";

  if (on) {
    const [existing] = await db
      .select()
      .from(pilotEndorsements)
      .where(and(eq(pilotEndorsements.pilotProfileId, pilotProfileId), eq(pilotEndorsements.key, key)))
      .limit(1);

    if (!existing) {
      await db.insert(pilotEndorsements).values({
        pilotProfileId,
        key,
        declaredAt: new Date(),
        verified: true,
        verifiedAt: new Date(),
        verifiedByUserId: reviewer.id,
      });
    } else if (!existing.verified || existing.declined) {
      await db
        .update(pilotEndorsements)
        .set({
          verified: true,
          verifiedAt: new Date(),
          verifiedByUserId: reviewer.id,
          declined: false,
          declineReason: null,
          declinedAt: null,
          declinedByUserId: null,
        })
        .where(eq(pilotEndorsements.id, existing.id));
    }
  } else {
    await db
      .delete(pilotEndorsements)
      .where(and(eq(pilotEndorsements.pilotProfileId, pilotProfileId), eq(pilotEndorsements.key, key)));
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/applicants/${applicantUserId}`);
  revalidatePath("/pilot");
}

const DeclineReasonSchema = z.string().trim().min(1, { error: "Enter a reason for declining." }).max(500);

/**
 * Declines a single declared endorsement with a required comment (Notes3
 * item 7) -- distinct from rejecting a whole application (ApplicantReview
 * Actions), which only applies while pending_verification. This works on
 * any declared item, pending or already-active-pilot, same as
 * setEndorsementVerified above.
 *
 * Notifies the pilot (Notes item #8, added 22 Sep 2026), two ways, both
 * always on -- Riaan's choice was "in-portal flag + email", not one or the
 * other:
 *  - In-portal: no extra write needed here -- the pilot dashboard already
 *    reads `declined`/`declineReason` straight off this row (see
 *    app/pilot/page.tsx's "Action needed" banner and the existing red
 *    Declined section below it), so it's already correct the moment this
 *    transaction commits.
 *  - Email: best-effort, see lib/email.ts -- never throws, never blocks or
 *    rolls back the decline itself if Resend isn't configured yet or the
 *    send fails.
 */
export async function declineEndorsement(endorsementId: string, reason: string) {
  const reviewer = await requireAdminOrCFI();

  const parsed = DeclineReasonSchema.safeParse(reason);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a reason." };
  }

  const [existing] = await db
    .select({ key: pilotEndorsements.key, pilotProfileId: pilotEndorsements.pilotProfileId })
    .from(pilotEndorsements)
    .where(eq(pilotEndorsements.id, endorsementId))
    .limit(1);

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

  if (existing) {
    const [pilot] = await db
      .select({ email: users.email, name: users.name })
      .from(pilotProfiles)
      .innerJoin(users, eq(users.id, pilotProfiles.userId))
      .where(eq(pilotProfiles.id, existing.pilotProfileId))
      .limit(1);

    if (pilot) {
      const label = endorsementLabel(existing.key);
      const dashboardUrl = `${getBaseUrl()}/pilot`;
      await sendEmail({
        to: pilot.email,
        subject: `Apex Flight Hub: ${label} application declined`,
        text:
          `Hi ${pilot.name},\n\n` +
          `Your application for "${label}" was reviewed and declined by your CFI/Admin.\n\n` +
          `Reason: ${parsed.data}\n\n` +
          `Once addressed, you can re-apply from your dashboard:\n${dashboardUrl}\n\n` +
          `-- Apex Flight Hub`,
        html:
          `<p>Hi ${pilot.name},</p>` +
          `<p>Your application for <strong>${label}</strong> was reviewed and declined by your CFI/Admin.</p>` +
          `<p><strong>Reason:</strong> ${parsed.data}</p>` +
          `<p>Once addressed, you can re-apply from your dashboard: <a href="${dashboardUrl}">${dashboardUrl}</a></p>` +
          `<p>-- Apex Flight Hub</p>`,
      });
    }
  }
}
