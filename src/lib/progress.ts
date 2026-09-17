import "server-only";
import { eq, sql, and } from "drizzle-orm";
import { db } from "@/db";
import {
  sections,
  exercises,
  studentExerciseProgress,
  users,
  studentProfiles,
  flightLogEntries,
} from "@/db/schema";

export type ExerciseWithProgress = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  order: number;
  status: "not_started" | "in_progress" | "signed_off";
  notes: string | null;
  signedOffAt: Date | null;
};

export type SectionWithProgress = {
  id: string;
  name: string;
  description: string | null;
  order: number;
  exercises: ExerciseWithProgress[];
  totalCount: number;
  signedOffCount: number;
  isComplete: boolean;
  /** True if the previous section is fully signed off (or this is the first section). */
  isUnlocked: boolean;
};

/**
 * Builds the full section -> exercise -> progress tree for one student, and
 * computes section gating: a section is unlocked once every exercise in the
 * previous section is signed off. This is the single source of truth for
 * gating -- both instructor and student views read it, so they can't drift.
 */
export async function getStudentProgress(
  studentId: string
): Promise<SectionWithProgress[]> {
  const allSections = await db
    .select()
    .from(sections)
    .orderBy(sections.order);

  const allExercises = await db
    .select()
    .from(exercises)
    .orderBy(exercises.order);

  const progressRows = await db
    .select()
    .from(studentExerciseProgress)
    .where(eq(studentExerciseProgress.studentId, studentId));

  const progressByExerciseId = new Map(
    progressRows.map((p) => [p.exerciseId, p])
  );

  const result: SectionWithProgress[] = [];
  let previousComplete = true; // first section is always unlocked

  for (const section of allSections) {
    const sectionExercises = allExercises
      .filter((e) => e.sectionId === section.id)
      .map((e): ExerciseWithProgress => {
        const p = progressByExerciseId.get(e.id);
        return {
          id: e.id,
          code: e.code,
          title: e.title,
          description: e.description,
          order: e.order,
          status: p?.status ?? "not_started",
          notes: p?.notes ?? null,
          signedOffAt: p?.signedOffAt ?? null,
        };
      });

    const totalCount = sectionExercises.length;
    const signedOffCount = sectionExercises.filter(
      (e) => e.status === "signed_off"
    ).length;
    const isComplete = totalCount > 0 && signedOffCount === totalCount;

    result.push({
      id: section.id,
      name: section.name,
      description: section.description,
      order: section.order,
      exercises: sectionExercises,
      totalCount,
      signedOffCount,
      isComplete,
      isUnlocked: previousComplete,
    });

    previousComplete = isComplete;
  }

  return result;
}

export type StudentSummary = {
  id: string;
  name: string;
  email: string;
  status: "invited" | "active" | "suspended" | "archived";
  signedOffCount: number;
  totalCount: number;
  currentSectionName: string | null;
  /** Flight log entries this student has submitted that the instructor
   * hasn't countersigned yet -- surfaced as a flag on the roster. */
  pendingLogbookCount: number;
  sahpaNumber: string | null;
  sahpaExpiryDate: Date | null;
  trainingType: "pg" | "ppg" | "ppt" | null;
};

/** Roster view for the instructor dashboard: one row per student, with a
 * lightweight progress summary (no need for the full gating tree here). */
export async function getAllStudentsWithSummary(): Promise<StudentSummary[]> {
  const totalExercises = await db.$count(exercises);

  const students = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: studentProfiles.status,
      sahpaNumber: studentProfiles.sahpaNumber,
      sahpaExpiryDate: studentProfiles.sahpaExpiryDate,
      trainingType: studentProfiles.trainingType,
    })
    .from(users)
    .innerJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .where(
      and(
        eq(users.role, "student"),
        // A brand-new sign-up sits here with accountStatus "pending_verification"
        // until a CFI/Admin approves them in the verification queue -- they can't
        // log in yet, so they shouldn't show up on the roster looking like an
        // ordinary active student. Rejected applicants never join the roster either.
        eq(users.accountStatus, "active")
      )
    )
    .orderBy(users.name);

  const signedOffCounts = await db
    .select({
      studentId: studentExerciseProgress.studentId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(studentExerciseProgress)
    .where(eq(studentExerciseProgress.status, "signed_off"))
    .groupBy(studentExerciseProgress.studentId);

  const countByStudent = new Map(
    signedOffCounts.map((r) => [r.studentId, Number(r.count)])
  );

  const pendingLogbookCounts = await db
    .select({
      studentId: flightLogEntries.studentId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(flightLogEntries)
    .where(eq(flightLogEntries.verified, false))
    .groupBy(flightLogEntries.studentId);

  const pendingByStudent = new Map(
    pendingLogbookCounts.map((r) => [r.studentId, Number(r.count)])
  );

  return students.map((s) => ({
    ...s,
    status: s.status as "invited" | "active" | "suspended" | "archived",
    signedOffCount: countByStudent.get(s.id) ?? 0,
    totalCount: totalExercises,
    currentSectionName: null,
    pendingLogbookCount: pendingByStudent.get(s.id) ?? 0,
  }));
}
