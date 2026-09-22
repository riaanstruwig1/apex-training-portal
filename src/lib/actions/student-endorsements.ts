"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { studentProfiles, studentEndorsements } from "@/db/schema";
import { requireAdminOrCFI } from "@/lib/auth/dal";
import { STUDENT_ENDORSEMENT_OPTIONS } from "@/lib/pilot-endorsements";

/**
 * Grants (or re-grants) one endorsement to a student -- added 22 Sep 2026,
 * item 3 of Riaan's request. Unlike pilot endorsements there's no student
 * self-declare step: the CFI just grants it directly as the student
 * progresses, same as adminGrantEndorsement does for a pilot the CFI is
 * reviewing. A row existing in student_endorsements IS the grant, so this
 * is idempotent -- granting an already-granted key is a no-op.
 */
export async function grantStudentEndorsement(
  studentUserId: string,
  key: string
) {
  const reviewer = await requireAdminOrCFI();
  if (!STUDENT_ENDORSEMENT_OPTIONS.some((o) => o.key === key)) return;

  const [profile] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, studentUserId))
    .limit(1);
  if (!profile) return;

  const [existing] = await db
    .select()
    .from(studentEndorsements)
    .where(
      and(
        eq(studentEndorsements.studentProfileId, profile.id),
        eq(studentEndorsements.key, key)
      )
    )
    .limit(1);

  if (!existing) {
    await db.insert(studentEndorsements).values({
      studentProfileId: profile.id,
      key,
      grantedAt: new Date(),
      grantedByUserId: reviewer.id,
    });
  }

  revalidatePath(`/instructor/students/${studentUserId}`);
  revalidatePath("/student");
}

/** Revokes a previously-granted student endorsement -- for a grant made in
 * error, or a status that no longer applies. */
export async function revokeStudentEndorsement(
  studentUserId: string,
  key: string
) {
  await requireAdminOrCFI();

  const [profile] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, studentUserId))
    .limit(1);
  if (!profile) return;

  await db
    .delete(studentEndorsements)
    .where(
      and(
        eq(studentEndorsements.studentProfileId, profile.id),
        eq(studentEndorsements.key, key)
      )
    );

  revalidatePath(`/instructor/students/${studentUserId}`);
  revalidatePath("/student");
}
