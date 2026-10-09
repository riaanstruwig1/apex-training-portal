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
import {
  compareSections,
  sectionAppliesTo,
  type SectionPhase,
  type SectionTrainingType,
} from "@/lib/syllabus-tags";
import { compareByName } from "@/lib/sort-by-name";

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
  /** V24 items 75-77: which training this section belongs to and its phase. */
  trainingType: SectionTrainingType;
  phase: SectionPhase;
  exercises: ExerciseWithProgress[];
  totalCount: number;
  signedOffCount: number;
  isComplete: boolean;
  /** True if the previous section is fully signed off (or this is the first section). */
  isUnlocked: boolean;
};

/**
 * Builds the full section -> exercise -> progress tree for one student, and
 * computes section gating. This is the single source of truth -- the CFI
 * folio, student dashboard, student folio and both print views all read it.
 *
 * V24 items 76-77 (1 Oct 2026): only sections for the student's own training
 * type(s) are included (plus "Applicable to all" ones; a student with no
 * training type declared still sees everything), ordered by
 * compareSections in lib/syllabus-tags.ts: PHASE FIRST
 * (Phase 1 -> 2 -> 3 -> Conversion -> Practical Theory), then training
 * type, then the CFI's own order. Unlocking follows that same order: a
 * section unlocks once the one before it is fully signed off.
 */
export async function getStudentProgress(
  studentId: string
): Promise<SectionWithProgress[]> {
  const [allSections, allExercises, progressRows, [profile]] = await Promise.all([
    db.select().from(sections),
    db.select().from(exercises).orderBy(exercises.order),
    db
      .select()
      .from(studentExerciseProgress)
      .where(eq(studentExerciseProgress.studentId, studentId)),
    db
      .select({ trainingType: studentProfiles.trainingType })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, studentId))
      .limit(1),
  ]);

  const applicable = allSections
    .filter((s) => sectionAppliesTo(s.trainingType, profile?.trainingType))
    .sort(compareSections);

  const progressByExerciseId = new Map(
    progressRows.map((p) => [p.exerciseId, p])
  );

  const result: SectionWithProgress[] = [];
  let previousComplete = true; // first section is always unlocked

  for (const section of applicable) {
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

    // A section with no exercises yet can never be "complete", so it would
    // lock every section after it -- leave it out of the folio views until
    // the CFI adds exercises (it still shows in Manage Syllabus).
    if (sectionExercises.length === 0) continue;

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
      trainingType: section.trainingType,
      phase: section.phase,
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
  profilePictureFile: string | null;
  status: "invited" | "active" | "suspended" | "archived";
  signedOffCount: number;
  totalCount: number;
  currentSectionName: string | null;
  /** Flight log entries this student has submitted that the instructor
   * hasn't countersigned yet -- surfaced as a flag on the roster. */
  pendingLogbookCount: number;
  sahpaNumber: string | null;
  sahpaExpiryDate: Date | null;
  /** Comma-separated list of TrainingType values, e.g. "pg,ppg" -- parse
   * with parseTrainingTypes() from lib/exams before rendering/comparing. */
  trainingType: string | null;
};

/** Roster view for the instructor dashboard: one row per student, with a
 * lightweight progress summary (no need for the full gating tree here). */
export async function getAllStudentsWithSummary(): Promise<StudentSummary[]> {
  // V24 item 76 (1 Oct 2026): each student's "x / y" only counts exercises
  // in sections for their own training type(s) -- same rule as
  // getStudentProgress above.
  const [allSections, allExercises] = await Promise.all([
    db.select({ id: sections.id, trainingType: sections.trainingType }).from(sections),
    db.select({ id: exercises.id, sectionId: exercises.sectionId }).from(exercises),
  ]);
  const sectionType = new Map(allSections.map((sec) => [sec.id, sec.trainingType]));

  const students = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      profilePictureFile: users.profilePictureFile,
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

  const signedOffRows = await db
    .select({
      studentId: studentExerciseProgress.studentId,
      exerciseId: studentExerciseProgress.exerciseId,
    })
    .from(studentExerciseProgress)
    .where(eq(studentExerciseProgress.status, "signed_off"));
  const signedOffByStudent = new Map<string, Set<string>>();
  for (const r of signedOffRows) {
    const set = signedOffByStudent.get(r.studentId) ?? new Set<string>();
    set.add(r.exerciseId);
    signedOffByStudent.set(r.studentId, set);
  }

  function applicableExerciseIds(trainingTypeRaw: string | null): string[] {
    return allExercises
      .filter((e) => sectionAppliesTo(sectionType.get(e.sectionId) ?? "all", trainingTypeRaw))
      .map((e) => e.id);
  }

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

  return [...students].sort(compareByName).map((s) => {
    const ids = applicableExerciseIds(s.trainingType);
    const done = signedOffByStudent.get(s.id);
    return {
    ...s,
    status: s.status as "invited" | "active" | "suspended" | "archived",
    signedOffCount: done ? ids.filter((id) => done.has(id)).length : 0,
    totalCount: ids.length,
    currentSectionName: null,
    pendingLogbookCount: pendingByStudent.get(s.id) ?? 0,
    };
  });
}
