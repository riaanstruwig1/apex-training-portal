import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { studentProfiles, users } from "@/db/schema";
import { isIntroCourse } from "@/lib/intro-course";

/** Is this user an intro (Phase 1 only) student? Used to lock exams and
 * study notes on the server, not just hide the buttons. */
export async function isIntroStudent(userId: string): Promise<boolean> {
  const [p] = await db
    .select({ courseLevel: studentProfiles.courseLevel })
    .from(studentProfiles)
    .innerJoin(users, eq(users.id, studentProfiles.userId))
    .where(and(eq(studentProfiles.userId, userId), eq(users.role, "student")))
    .limit(1);
  return isIntroCourse(p?.courseLevel);
}

/** Intro students waiting for a CFI to approve their Phase 2 sign-up. */
export async function getPhase2Requests() {
  return db
    .select({
      userId: users.id,
      name: users.name,
      requestedAt: studentProfiles.phase2RequestedAt,
      requestedTypes: studentProfiles.phase2RequestedTypes,
    })
    .from(studentProfiles)
    .innerJoin(users, eq(users.id, studentProfiles.userId))
    .where(and(eq(studentProfiles.courseLevel, "intro"), isNotNull(studentProfiles.phase2RequestedAt)))
    .orderBy(studentProfiles.phase2RequestedAt);
}

export async function countPhase2Requests(): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(studentProfiles)
    .where(and(eq(studentProfiles.courseLevel, "intro"), isNotNull(studentProfiles.phase2RequestedAt)));
  return Number(r?.n ?? 0);
}
