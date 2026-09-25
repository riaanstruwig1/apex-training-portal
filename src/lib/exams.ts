import "server-only";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  exams,
  examSections,
  examQuestions,
  examOptions,
  examAttempts,
  examAnswers,
  users,
} from "@/db/schema";

export type AttemptStatus = "not_started" | "in_progress" | "submitted" | "verified";

export type ExamCategory = "pg" | "ppg" | "ppt" | "rt";
export const EXAM_CATEGORY_LABELS: Record<ExamCategory, string> = {
  pg: "PG Exam",
  ppg: "PPG Exam",
  ppt: "PPT Exam",
  rt: "SAHPA RT Exam",
};
export const EXAM_CATEGORY_ORDER: ExamCategory[] = ["pg", "ppg", "ppt", "rt"];

// Re-exported so existing server-side callers can keep importing these from
// "@/lib/exams" -- but the underlying module has no "server-only" guard, so
// a "use client" component (the training-type checkbox editors) can import
// parseTrainingTypes/formatTrainingTypes/TrainingType directly from
// "@/lib/training-types" instead, where this file's server-only guard would
// otherwise block it.
export type { TrainingType } from "@/lib/training-types";
export { parseTrainingTypes, formatTrainingTypes } from "@/lib/training-types";
import { parseTrainingTypes } from "@/lib/training-types";

/**
 * Which exam categories a student should see, based on what they signed up
 * to train toward (a student may be enrolled in more than one course at
 * once -- the visible set is the union across all of them):
 *  - PG: only the PG exam.
 *  - PPG: PG, PPG and the Radio (RT) exam.
 *  - PPT: PG, PPT and the Radio (RT) exam.
 * A student with no trainingType declared (older accounts from before this
 * field existed) sees everything, rather than having exams unexpectedly
 * disappear on them.
 */
export function visibleExamCategories(
  trainingTypeRaw: string | null | undefined
): ExamCategory[] | null {
  const types = parseTrainingTypes(trainingTypeRaw);
  if (types.length === 0) return null; // no restriction -- show everything
  const visible = new Set<ExamCategory>();
  for (const t of types) {
    if (t === "pg") visible.add("pg");
    if (t === "ppg") {
      visible.add("pg");
      visible.add("ppg");
      visible.add("rt");
    }
    if (t === "ppt") {
      visible.add("pg");
      visible.add("ppt");
      visible.add("rt");
    }
  }
  return EXAM_CATEGORY_ORDER.filter((c) => visible.has(c));
}

export type ExamSummary = {
  examId: string;
  slug: string;
  title: string;
  subtitle: string | null;
  category: ExamCategory | null;
  totalQuestions: number;
  answeredCount: number;
  status: AttemptStatus;
  attemptNumber: number;
  passed: boolean | null;
  scorePercent: number | null;
  /** Minutes on the clock once an attempt starts, or null for no time
   * limit (e.g. the PG exam). */
  timeLimitMinutes: number | null;
  /** True once the current (latest) attempt is a verified fail -- the
   * student is in the retry-eligible state (may still be on cooldown --
   * see nextRetryAt). */
  canRetry: boolean;
  /** When a cooldown-gated retry becomes available. Null if there's no
   * cooldown (or none currently running). */
  nextRetryAt: Date | null;
  /** "paper" once the current attempt is a pre-written exam / already-held
   * licence the student submitted for review rather than an online
   * attempt (see schema.ts's examAttempts.source doc comment). Always
   * "online" when there's no attempt yet. */
  source: "online" | "paper";
  /** True when the student has no attempt yet, or their latest attempt is
   * a verified fail -- i.e. they're free to submit a paper exam right
   * now (mirrors the online startNewAttempt gate in lib/actions/exams.ts,
   * so "submit paper" and "retry online" are equally available). */
  canSubmitPaper: boolean;
};

function computeNextRetryAt(
  verifiedAt: Date | null,
  retryCooldownDays: number | null
): Date | null {
  if (!verifiedAt || !retryCooldownDays) return null;
  return new Date(verifiedAt.getTime() + retryCooldownDays * 24 * 60 * 60 * 1000);
}

async function latestAttemptsByExam(studentId: string) {
  const rows = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.studentId, studentId))
    .orderBy(desc(examAttempts.attemptNumber));

  const latestByExam = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!latestByExam.has(r.examId)) latestByExam.set(r.examId, r);
  }
  return latestByExam;
}

/** Dashboard-level summary for every exam, for one student -- powers the
 * "Exam" button/progress card. No answer content, just counts. Reflects
 * the student's most recent attempt if they've taken it more than once. */
export async function getExamsForStudent(
  studentId: string,
  trainingTypeRaw?: string | null
): Promise<ExamSummary[]> {
  const visibleCategories = visibleExamCategories(trainingTypeRaw);
  const allExamsUnfiltered = await db.select().from(exams).orderBy(exams.order);
  // A category-less exam (not yet slotted into PG/PPG/PPT/RT) always stays
  // visible -- only exams with a recognized category are gated.
  const allExams = visibleCategories
    ? allExamsUnfiltered.filter(
        (e) => !e.category || visibleCategories.includes(e.category as ExamCategory)
      )
    : allExamsUnfiltered;

  const questionCounts = await db
    .select({
      examId: examSections.examId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(examQuestions)
    .innerJoin(examSections, eq(examQuestions.sectionId, examSections.id))
    .groupBy(examSections.examId);
  const countByExam = new Map(questionCounts.map((r) => [r.examId, Number(r.count)]));

  const latestByExam = await latestAttemptsByExam(studentId);

  const answeredCounts = await db
    .select({
      attemptId: examAnswers.attemptId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(examAnswers)
    .innerJoin(examAttempts, eq(examAnswers.attemptId, examAttempts.id))
    .where(eq(examAttempts.studentId, studentId))
    .groupBy(examAnswers.attemptId);
  const answeredByAttempt = new Map(answeredCounts.map((r) => [r.attemptId, Number(r.count)]));

  return allExams.map((e) => {
    const attempt = latestByExam.get(e.id);
    const canRetry = attempt?.status === "verified" && attempt.passed === false;
    // Same eligibility as canRetry, but also true for a student with no
    // attempt at all -- unlike the online retry action, submitting a
    // paper exam is a valid FIRST move, not just a retake path.
    const canSubmitPaper = !attempt || canRetry;
    return {
      examId: e.id,
      slug: e.slug,
      title: e.title,
      subtitle: e.subtitle,
      category: (e.category as ExamCategory) ?? null,
      totalQuestions: countByExam.get(e.id) ?? 0,
      answeredCount: attempt ? answeredByAttempt.get(attempt.id) ?? 0 : 0,
      status: (attempt?.status as AttemptStatus) ?? "not_started",
      attemptNumber: attempt?.attemptNumber ?? 1,
      passed: attempt?.passed ?? null,
      scorePercent: attempt?.scorePercent ?? null,
      timeLimitMinutes: e.timeLimitMinutes,
      canRetry,
      nextRetryAt: canRetry
        ? computeNextRetryAt(attempt?.verifiedAt ?? null, e.retryCooldownDays)
        : null,
      source: (attempt?.source as "online" | "paper") ?? "online",
      canSubmitPaper,
    };
  });
}

export type ExamOptionView = {
  id: string;
  label: "A" | "B" | "C" | "D";
  text: string | null;
  image: string | null;
  isCorrect?: boolean; // only populated when reveal=true -- used for the
  // student's OWN selection (tick/cross); callers should never render
  // which of the other options was correct.
};

export type ExamQuestionView = {
  id: string;
  code: string;
  prompt: string;
  printPrompt: string | null;
  marks: number;
  stemImage: string | null;
  options: ExamOptionView[];
  selectedOptionId: string | null;
};

export type ExamSectionView = {
  id: string;
  code: string;
  name: string;
  totalMarks: number;
  questions: ExamQuestionView[];
};

export type ExamDetail = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  category: ExamCategory | null;
  passPercent: number;
  mustPassSections: string | null;
  timeLimitMinutes: number | null;
  retryCooldownDays: number | null;
  totalMarks: number;
  sections: ExamSectionView[];
};

export type AttemptView = {
  id: string;
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: Date | null;
  submittedAt: Date | null;
  verifiedAt: Date | null;
  verifiedByName: string | null;
  scoreMarks: number | null;
  totalMarks: number | null;
  scorePercent: number | null;
  passed: boolean | null;
  mustPassSectionsOk: boolean | null;
  source: "online" | "paper";
  proofFile: string | null;
  externalLicenseNumber: string | null;
};

export type AttemptSummary = Pick<
  AttemptView,
  | "id"
  | "attemptNumber"
  | "status"
  | "submittedAt"
  | "verifiedAt"
  | "scorePercent"
  | "passed"
  | "source"
>;

/** Every attempt a student has made at one exam, most recent first --
 * for the instructor's "attempt history" list once retakes are in play. */
export async function getAttemptHistory(
  studentId: string,
  examId: string
): Promise<AttemptSummary[]> {
  const rows = await db
    .select()
    .from(examAttempts)
    .where(and(eq(examAttempts.studentId, studentId), eq(examAttempts.examId, examId)))
    .orderBy(desc(examAttempts.attemptNumber));

  return rows.map((a) => ({
    id: a.id,
    attemptNumber: a.attemptNumber,
    status: a.status as AttemptStatus,
    submittedAt: a.submittedAt,
    verifiedAt: a.verifiedAt,
    scorePercent: a.scorePercent,
    passed: a.passed,
    source: a.source as "online" | "paper",
  }));
}

/**
 * Loads the full exam content plus one student's answers for a single
 * attempt. Pass `attemptId` to load a specific historical attempt
 * (instructor review); omit it to load the student's current (most
 * recent) attempt.
 *
 * `reveal` controls whether option.isCorrect is included -- NEVER pass
 * true while the student can still be editing an in-progress attempt,
 * since this is serialized straight into the page. Even when true,
 * callers must only use it to mark the student's OWN selection right or
 * wrong -- never to show which other option was the correct one.
 */
export async function getExamDetail(
  examId: string,
  studentId: string,
  reveal: boolean,
  attemptId?: string
): Promise<{ exam: ExamDetail; attempt: AttemptView | null } | null> {
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) return null;

  const sectionRows = await db
    .select()
    .from(examSections)
    .where(eq(examSections.examId, examId))
    .orderBy(examSections.order);

  const sectionIds = sectionRows.map((s) => s.id);
  const questionRows = sectionIds.length
    ? await db
        .select()
        .from(examQuestions)
        .where(inArray(examQuestions.sectionId, sectionIds))
        .orderBy(examQuestions.order)
    : [];

  const questionIds = questionRows.map((q) => q.id);
  const optionRows = questionIds.length
    ? await db.select().from(examOptions).where(inArray(examOptions.questionId, questionIds))
    : [];

  let attemptRow: typeof examAttempts.$inferSelect | undefined;
  if (attemptId) {
    [attemptRow] = await db
      .select()
      .from(examAttempts)
      .where(eq(examAttempts.id, attemptId))
      .limit(1);
  } else {
    [attemptRow] = await db
      .select()
      .from(examAttempts)
      .where(and(eq(examAttempts.studentId, studentId), eq(examAttempts.examId, examId)))
      .orderBy(desc(examAttempts.attemptNumber))
      .limit(1);
  }

  let verifiedByName: string | null = null;
  if (attemptRow?.verifiedByUserId) {
    const [v] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, attemptRow.verifiedByUserId))
      .limit(1);
    verifiedByName = v?.name ?? null;
  }

  const answerRows = attemptRow
    ? await db.select().from(examAnswers).where(eq(examAnswers.attemptId, attemptRow.id))
    : [];
  const answerByQuestion = new Map(answerRows.map((a) => [a.questionId, a.selectedOptionId]));

  const optionsByQuestion = new Map<string, typeof optionRows>();
  for (const o of optionRows) {
    const list = optionsByQuestion.get(o.questionId) ?? [];
    list.push(o);
    optionsByQuestion.set(o.questionId, list);
  }

  const sections: ExamSectionView[] = sectionRows.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    totalMarks: s.totalMarks,
    questions: questionRows
      .filter((q) => q.sectionId === s.id)
      .map((q) => {
        const opts = (optionsByQuestion.get(q.id) ?? []).sort((a, b) => a.order - b.order);
        return {
          id: q.id,
          code: q.code,
          prompt: q.prompt,
          printPrompt: q.printPrompt,
          marks: q.marks,
          stemImage: q.stemImage,
          selectedOptionId: answerByQuestion.get(q.id) ?? null,
          options: opts.map((o) => ({
            id: o.id,
            label: o.label as "A" | "B" | "C" | "D",
            text: o.text,
            image: o.image,
            ...(reveal ? { isCorrect: o.isCorrect } : {}),
          })),
        };
      }),
  }));

  const totalMarks = sections.reduce((sum, s) => sum + s.totalMarks, 0);

  return {
    exam: {
      id: exam.id,
      slug: exam.slug,
      title: exam.title,
      subtitle: exam.subtitle,
      category: (exam.category as ExamCategory) ?? null,
      passPercent: exam.passPercent,
      mustPassSections: exam.mustPassSections,
      timeLimitMinutes: exam.timeLimitMinutes,
      retryCooldownDays: exam.retryCooldownDays,
      totalMarks,
      sections,
    },
    attempt: attemptRow
      ? {
          id: attemptRow.id,
          attemptNumber: attemptRow.attemptNumber,
          status: attemptRow.status as AttemptStatus,
          startedAt: attemptRow.startedAt,
          submittedAt: attemptRow.submittedAt,
          verifiedAt: attemptRow.verifiedAt,
          verifiedByName,
          scoreMarks: attemptRow.scoreMarks,
          totalMarks: attemptRow.totalMarks,
          scorePercent: attemptRow.scorePercent,
          passed: attemptRow.passed,
          mustPassSectionsOk: attemptRow.mustPassSectionsOk,
          source: attemptRow.source as "online" | "paper",
          proofFile: attemptRow.proofFile,
          externalLicenseNumber: attemptRow.externalLicenseNumber,
        }
      : null,
  };
}

/** For the roster: which students have an exam attempt sitting in
 * "submitted", awaiting instructor verification. */
export async function getPendingExamVerifications(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      studentId: examAttempts.studentId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(examAttempts)
    .where(eq(examAttempts.status, "submitted"))
    .groupBy(examAttempts.studentId);

  return new Map(rows.map((r) => [r.studentId, Number(r.count)]));
}

export type ExamCategoryStatus = "pass" | "fail" | "not_done";

/** For the roster's three headline exam badges (PG / PPG / SAHPA RT).
 * "not_done" covers no attempt at all, an attempt still in progress or
 * awaiting verification, and a category with no exam set up yet. One
 * query set for every student, rather than one per row. */
export async function getExamCategoryStatusesForAllStudents(): Promise<
  Map<string, Record<ExamCategory, ExamCategoryStatus>>
> {
  const allExams = await db.select().from(exams);
  const categoryByExamId = new Map(
    allExams.map((e) => [e.id, (e.category as ExamCategory) ?? null])
  );

  const rows = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.status, "verified"))
    .orderBy(desc(examAttempts.attemptNumber));

  // Latest verified attempt per (student, exam).
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const key = `${r.studentId}:${r.examId}`;
    if (!latest.has(key)) latest.set(key, r);
  }

  const result = new Map<string, Record<ExamCategory, ExamCategoryStatus>>();
  function forStudent(studentId: string) {
    let entry = result.get(studentId);
    if (!entry) {
      entry = { pg: "not_done", ppg: "not_done", ppt: "not_done", rt: "not_done" };
      result.set(studentId, entry);
    }
    return entry;
  }

  for (const attempt of latest.values()) {
    const category = categoryByExamId.get(attempt.examId);
    if (!category) continue;
    forStudent(attempt.studentId)[category] = attempt.passed ? "pass" : "fail";
  }

  return result;
}
