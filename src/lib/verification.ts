import "server-only";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, pilotProfiles, pilotEndorsements, studentProfiles } from "@/db/schema";

export type PendingApplicant = {
  id: string;
  name: string;
  email: string;
  role: "student" | "pilot";
  apexNumber: string | null;
  profilePictureFile: string | null;
  createdAt: Date;
  /** Student applicant with no SAHPA number loaded. */
  sahpaMissing: boolean;
  /** 19 Oct 2026: signed up for PG/PPG Intro training (Phase 1 only). */
  introCourse: boolean;
};

export async function getPendingApplicants(): Promise<PendingApplicant[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      apexNumber: users.apexNumber,
      profilePictureFile: users.profilePictureFile,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.accountStatus, "pending_verification"));

  const sp = await db.select({ userId: studentProfiles.userId, sahpaNumber: studentProfiles.sahpaNumber, courseLevel: studentProfiles.courseLevel }).from(studentProfiles);
  const sahpaOf = new Map(sp.map((p) => [p.userId, (p.sahpaNumber ?? "").trim()]));
  const introIds = new Set(sp.filter((p) => p.courseLevel === "intro").map((p) => p.userId));
  return rows
    .filter((r) => r.role === "student" || r.role === "pilot")
    .map((r) => ({ ...r, role: r.role as "student" | "pilot", sahpaMissing: r.role === "student" && !sahpaOf.get(r.id), introCourse: r.role === "student" && introIds.has(r.id) }))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function getApplicantDetail(userId: string) {
  const [applicant] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!applicant) return null;

  let pilot: {
    profile: typeof pilotProfiles.$inferSelect;
    endorsements: (typeof pilotEndorsements.$inferSelect)[];
  } | null = null;

  if (applicant.role === "pilot" || applicant.role === "cfi" || applicant.role === "instructor") {
    const [profile] = await db
      .select()
      .from(pilotProfiles)
      .where(eq(pilotProfiles.userId, userId))
      .limit(1);
    if (profile) {
      const endorsements = await db
        .select()
        .from(pilotEndorsements)
        .where(eq(pilotEndorsements.pilotProfileId, profile.id));
      pilot = { profile, endorsements };
    }
  }

  let student: { profile: typeof studentProfiles.$inferSelect } | null = null;
  if (applicant.role === "student") {
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, userId))
      .limit(1);
    if (profile) student = { profile };
  }

  return { applicant, pilot, student };
}

/** Small helper for "still needs review" counts elsewhere, e.g. a nav badge. */
export async function countPendingApplicants(): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.accountStatus, "pending_verification")
      )
    );
  return rows.length;
}
