"use server";

import { eq, and, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  exams,
  examSections,
  examQuestions,
  examOptions,
  examAttempts,
  examAnswers,
} from "@/db/schema";
import { requireStudent, requireInstructor, requireCFI } from "@/lib/auth/dal";

async function latestAttempt(studentId: string, examId: string) {
  const [row] = await db
    .select()
    .from(examAttempts)
    .where(and(eq(examAttempts.studentId, studentId), eq(examAttempts.examId, examId)))
    .orderBy(desc(examAttempts.attemptNumber))
    .limit(1);
  return row;
}

/** Creates the student's first attempt the first time they open an exam.
 * Safe to call repeatedly -- returns the current (latest) attempt if one
 * exists, whatever its status. Does NOT start a retry on its own; that's
 * an explicit student action via startNewAttempt. */
export async function ensureAttempt(examId: string) {
  const { user } = await requireStudent();

  const existing = await latestAttempt(user.id, examId);
  if (existing) return existing.id;

  const [created] = await db
    .insert(examAttempts)
    .values({ studentId: user.id, examId, attemptNumber: 1 })
    .returning();
  return created?.id ?? null;
}

export type RetryState = { error: string } | undefined;

/** Starts a new attempt after a verified fail. Each retake redoes the
 * whole exam from scratch -- no answers carry over. Exams with a
 * retryCooldownDays set (e.g. the RT exam's 7-day rule) block a retry
 * until that many days have passed since the failed attempt was
 * verified. */
export async function startNewAttempt(examId: string): Promise<RetryState> {
  const { user } = await requireStudent();

  const current = await latestAttempt(user.id, examId);
  if (!current || current.status !== "verified" || current.passed !== false) {
    return { error: "You can only start a new attempt after a verified fail." };
  }

  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (exam?.retryCooldownDays && current.verifiedAt) {
    const eligibleAt = new Date(
      current.verifiedAt.getTime() + exam.retryCooldownDays * 24 * 60 * 60 * 1000
    );
    if (new Date() < eligibleAt) {
      return {
        error: `You can retry from ${eligibleAt.toLocaleDateString()} (${exam.retryCooldownDays}-day wait after a fail).`,
      };
    }
  }

  await db.insert(examAttempts).values({
    studentId: user.id,
    examId,
    attemptNumber: current.attemptNumber + 1,
  });

  revalidatePath(`/student/exams/${examId}`);
  revalidatePath("/student");
}

export type SaveAnswerState = { error: string } | undefined;

/** Autosaves one answer. Student-only, and only while the current attempt
 * is still in progress -- a submitted/verified exam can't be edited. */
export async function saveExamAnswer(
  examId: string,
  questionId: string,
  optionId: string
): Promise<SaveAnswerState> {
  const { user } = await requireStudent();

  const attempt = await latestAttempt(user.id, examId);
  if (!attempt) return { error: "Exam attempt not found." };
  if (attempt.status !== "in_progress") {
    return { error: "This exam has already been submitted and can no longer be changed." };
  }

  await db
    .insert(examAnswers)
    .values({ attemptId: attempt.id, questionId, selectedOptionId: optionId })
    .onConflictDoUpdate({
      target: [examAnswers.attemptId, examAnswers.questionId],
      set: { selectedOptionId: optionId, updatedAt: new Date() },
    });

  revalidatePath(`/student/exams/${examId}`);
}

export type SubmitExamState = { error: string } | undefined;

/** Locks the current attempt and scores it. Once submitted, the student
 * can't change any answer -- only an instructor verifying it can see the
 * result, and the score itself is never re-shown to the student as "the
 * correct answer" for anything they got wrong.
 *
 * `auto: true` is the clock-expiry path for timed exams (e.g. the RT
 * exam's 60-minute limit): it skips the "answer everything" requirement
 * -- whatever's answered gets scored, anything left blank counts as
 * wrong -- but only once the time limit has actually elapsed server-side
 * (never trusts the client's word that time is up). */
export async function submitExam(
  examId: string,
  opts?: { auto?: boolean }
): Promise<SubmitExamState> {
  const { user } = await requireStudent();

  const attempt = await latestAttempt(user.id, examId);
  if (!attempt) return { error: "Exam attempt not found." };
  if (attempt.status !== "in_progress") {
    return { error: "This exam has already been submitted." };
  }

  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) return { error: "Exam not found." };

  if (opts?.auto) {
    if (!exam.timeLimitMinutes) {
      return { error: "This exam has no time limit -- nothing to auto-submit." };
    }
    const deadline = new Date(
      attempt.startedAt.getTime() + exam.timeLimitMinutes * 60 * 1000
    );
    if (new Date() < deadline) {
      return { error: "Time isn't actually up yet." };
    }
  }

  const sectionRows = await db
    .select()
    .from(examSections)
    .where(eq(examSections.examId, examId));
  const sectionIds = sectionRows.map((s) => s.id);

  const questionRows = sectionIds.length
    ? await db.select().from(examQuestions).where(inArray(examQuestions.sectionId, sectionIds))
    : [];
  const totalMarks = questionRows.reduce((sum, q) => sum + q.marks, 0);

  const answerRows = await db
    .select()
    .from(examAnswers)
    .where(eq(examAnswers.attemptId, attempt.id));

  if (!opts?.auto && answerRows.length < questionRows.length) {
    return { error: "Answer every question before submitting." };
  }

  const optionIds = answerRows.map((a) => a.selectedOptionId).filter((id): id is string => !!id);
  const optionRows = optionIds.length
    ? await db.select().from(examOptions).where(inArray(examOptions.id, optionIds))
    : [];
  const optionById = new Map(optionRows.map((o) => [o.id, o]));
  const answerByQuestion = new Map(answerRows.map((a) => [a.questionId, a.selectedOptionId]));

  // Iterate every question in the exam (not just answered ones), so a
  // question left blank at timeout scores as wrong and still counts
  // toward its section's total -- rather than being silently excluded.
  let scoreMarks = 0;
  const sectionScored = new Map<string, { earned: number; total: number }>();
  for (const s of sectionRows) sectionScored.set(s.id, { earned: 0, total: 0 });

  for (const q of questionRows) {
    const selectedOptionId = answerByQuestion.get(q.id);
    const opt = selectedOptionId ? optionById.get(selectedOptionId) : null;
    const correct = !!opt?.isCorrect;
    const entry = sectionScored.get(q.sectionId)!;
    entry.total += q.marks;
    if (correct) {
      scoreMarks += q.marks;
      entry.earned += q.marks;
    }
  }

  const scorePercent = totalMarks > 0 ? (scoreMarks / totalMarks) * 100 : 0;

  const mustPassCodes = (exam.mustPassSections ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const mustPassSectionsOk = mustPassCodes.every((code) => {
    const section = sectionRows.find((s) => s.code === code);
    if (!section) return true;
    const scored = sectionScored.get(section.id);
    return scored ? scored.earned >= scored.total : true;
  });

  const passed = scorePercent >= exam.passPercent && mustPassSectionsOk;

  await db
    .update(examAttempts)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      scoreMarks,
      totalMarks,
      scorePercent,
      passed,
      mustPassSectionsOk,
    })
    .where(eq(examAttempts.id, attempt.id));

  revalidatePath(`/student/exams/${examId}`);
  revalidatePath("/student");
  revalidatePath("/instructor");
  revalidatePath(`/instructor/students/${user.id}`);
}

/** Instructor (CFI or regular) confirms/verifies a submitted attempt --
 * mirrors the shared logbook-verify permission. The score was already
 * computed at submit time; this just records who signed off on it. */
export async function verifyExamAttempt(attemptId: string) {
  const instructor = await requireInstructor();

  const [attempt] = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.id, attemptId))
    .limit(1);
  if (!attempt || attempt.status !== "submitted") return;

  await db
    .update(examAttempts)
    .set({
      status: "verified",
      verifiedAt: new Date(),
      verifiedByUserId: instructor.id,
    })
    .where(eq(examAttempts.id, attemptId));

  revalidatePath(`/instructor/students/${attempt.studentId}`);
  revalidatePath(`/instructor/students/${attempt.studentId}/exams/${attempt.examId}`);
  revalidatePath("/instructor");
  revalidatePath("/student");
}

export type UpdateQuestionState = { error: string } | { success: true } | undefined;

/** CFI-only: fix wording on an existing question and/or its options.
 * Deliberately narrow -- prompt text and option text only. It never
 * touches order, marks, images, or which option is correct, so it can't
 * silently break scoring or the question sequence. */
export async function updateExamQuestionContent(
  questionId: string,
  examId: string,
  prompt: string,
  options: { id: string; text: string }[]
): Promise<UpdateQuestionState> {
  await requireCFI();

  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return { error: "Question text can't be empty." };
  for (const o of options) {
    if (!o.text.trim()) return { error: "Answer text can't be empty." };
  }

  await db
    .update(examQuestions)
    .set({ prompt: trimmedPrompt })
    .where(eq(examQuestions.id, questionId));

  for (const o of options) {
    await db
      .update(examOptions)
      .set({ text: o.text.trim() })
      .where(eq(examOptions.id, o.id));
  }

  revalidatePath(`/instructor/exams/${examId}/edit`);
  return { success: true };
}
