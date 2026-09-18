"use server";

import { eq, and, desc, inArray, sql } from "drizzle-orm";
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

/** CFI-only: full edit of an existing question -- wording, marks, and
 * which option is correct. A question's already-scored attempts keep
 * whatever score they were given at submit time (scores are frozen into
 * examAttempts, never recomputed), so changing the correct answer here
 * only affects attempts taken from now on -- it can't retroactively
 * change a result a student has already been given.
 *
 * `text: null` on an option means "leave its text alone" -- used for the
 * handful of image-only answers (e.g. the PG exam's diagram questions)
 * that have nothing to type here, but can still be picked as the correct
 * one. */
export async function updateExamQuestionFull(
  questionId: string,
  examId: string,
  data: {
    prompt: string;
    marks: number;
    options: { id: string; text: string | null; isCorrect: boolean }[];
  }
): Promise<UpdateQuestionState> {
  await requireCFI();

  const trimmedPrompt = data.prompt.trim();
  if (!trimmedPrompt) return { error: "Question text can't be empty." };
  if (!Number.isFinite(data.marks) || data.marks <= 0) {
    return { error: "Marks must be a positive number." };
  }
  for (const o of data.options) {
    if (o.text !== null && !o.text.trim()) return { error: "Every answer needs text." };
  }
  if (!data.options.some((o) => o.isCorrect)) {
    return { error: "Mark one answer as correct." };
  }

  await db
    .update(examQuestions)
    .set({ prompt: trimmedPrompt, marks: data.marks })
    .where(eq(examQuestions.id, questionId));

  for (const o of data.options) {
    if (o.text !== null) {
      await db
        .update(examOptions)
        .set({ text: o.text.trim(), isCorrect: o.isCorrect })
        .where(eq(examOptions.id, o.id));
    } else {
      await db
        .update(examOptions)
        .set({ isCorrect: o.isCorrect })
        .where(eq(examOptions.id, o.id));
    }
  }

  revalidatePath(`/instructor/exams/${examId}/edit`);
  return { success: true };
}

/** CFI-only: adds a brand-new question (with its 4 answers, A-D) to a
 * section, appended at the end. */
export async function createExamQuestion(
  sectionId: string,
  examId: string,
  data: {
    code: string;
    prompt: string;
    marks: number;
    options: { text: string; isCorrect: boolean }[]; // exactly 4, order A-D
  }
): Promise<UpdateQuestionState> {
  await requireCFI();

  const code = data.code.trim();
  const prompt = data.prompt.trim();
  if (!code) return { error: "Question code can't be empty." };
  if (!prompt) return { error: "Question text can't be empty." };
  if (!Number.isFinite(data.marks) || data.marks <= 0) {
    return { error: "Marks must be a positive number." };
  }
  if (data.options.length !== 4) return { error: "A question needs exactly 4 answers." };
  for (const o of data.options) {
    if (!o.text.trim()) return { error: "Every answer needs text." };
  }
  if (!data.options.some((o) => o.isCorrect)) {
    return { error: "Mark one answer as correct." };
  }

  const [{ maxOrder } = { maxOrder: 0 }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${examQuestions.order}), 0)` })
    .from(examQuestions)
    .where(eq(examQuestions.sectionId, sectionId));

  const [question] = await db
    .insert(examQuestions)
    .values({ sectionId, code, prompt, marks: data.marks, order: maxOrder + 1 })
    .returning();

  const labels = ["A", "B", "C", "D"] as const;
  for (let i = 0; i < 4; i++) {
    await db.insert(examOptions).values({
      questionId: question.id,
      label: labels[i],
      text: data.options[i].text.trim(),
      isCorrect: data.options[i].isCorrect,
      order: i,
    });
  }

  revalidatePath(`/instructor/exams/${examId}/edit`);
  return { success: true };
}

/** CFI-only: removes a question and its answers. Any answers students
 * already gave for it go with it (harmless -- their attempt's score was
 * already computed and stored at submit time, not recomputed live). */
export async function deleteExamQuestion(questionId: string, examId: string) {
  await requireCFI();
  await db.delete(examQuestions).where(eq(examQuestions.id, questionId));
  revalidatePath(`/instructor/exams/${examId}/edit`);
}

export type SectionState = { error: string } | { success: true } | undefined;

/** CFI-only: adds a new section to an exam, appended at the end.
 * totalMarks starts at 0 and isn't really used for anything scoring-wise
 * (each question carries its own marks; this field is informational),
 * so a fixed starting value is fine. */
export async function createExamSection(
  examId: string,
  code: string,
  name: string
): Promise<SectionState> {
  await requireCFI();

  const trimmedCode = code.trim();
  const trimmedName = name.trim();
  if (!trimmedCode) return { error: "Section code can't be empty." };
  if (!trimmedName) return { error: "Section name can't be empty." };

  const [{ maxOrder } = { maxOrder: 0 }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${examSections.order}), 0)` })
    .from(examSections)
    .where(eq(examSections.examId, examId));

  await db.insert(examSections).values({
    examId,
    code: trimmedCode,
    name: trimmedName,
    order: maxOrder + 1,
    totalMarks: 0,
  });

  revalidatePath(`/instructor/exams/${examId}/edit`);
  return { success: true };
}

/** CFI-only: renames a section (code/name only -- order stays as-is). */
export async function updateExamSection(
  sectionId: string,
  examId: string,
  code: string,
  name: string
): Promise<SectionState> {
  await requireCFI();

  const trimmedCode = code.trim();
  const trimmedName = name.trim();
  if (!trimmedCode) return { error: "Section code can't be empty." };
  if (!trimmedName) return { error: "Section name can't be empty." };

  await db
    .update(examSections)
    .set({ code: trimmedCode, name: trimmedName })
    .where(eq(examSections.id, sectionId));

  revalidatePath(`/instructor/exams/${examId}/edit`);
  return { success: true };
}

/** CFI-only: deletes a section and everything in it (questions, answers).
 * Called only after the client confirms -- this has no undo. */
export async function deleteExamSection(sectionId: string, examId: string) {
  await requireCFI();
  await db.delete(examSections).where(eq(examSections.id, sectionId));
  revalidatePath(`/instructor/exams/${examId}/edit`);
}

export type ExamMetaInput = {
  title: string;
  subtitle: string;
  category: "" | "pg" | "ppg" | "ppt" | "rt";
  passPercent: number;
  timeLimitMinutes: number | null;
  retryCooldownDays: number | null;
  mustPassSections: string;
};

export type CreateExamState = { error: string } | { success: true; examId: string } | undefined;

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** CFI-only: creates a brand-new, empty exam (no sections/questions yet --
 * those are added afterward on the edit page). Slug is derived from the
 * title and de-duplicated if needed so it stays URL-safe and unique. */
export async function createExam(data: ExamMetaInput): Promise<CreateExamState> {
  await requireCFI();

  const title = data.title.trim();
  if (!title) return { error: "Exam title can't be empty." };
  if (!Number.isFinite(data.passPercent) || data.passPercent <= 0 || data.passPercent > 100) {
    return { error: "Pass percent must be between 1 and 100." };
  }

  let slug = slugify(title) || "exam";
  const existing = await db.select({ slug: exams.slug }).from(exams);
  const existingSlugs = new Set(existing.map((e) => e.slug));
  if (existingSlugs.has(slug)) {
    let n = 2;
    while (existingSlugs.has(`${slug}-${n}`)) n++;
    slug = `${slug}-${n}`;
  }

  const [{ maxOrder } = { maxOrder: 0 }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${exams.order}), 0)` })
    .from(exams);

  const [created] = await db
    .insert(exams)
    .values({
      slug,
      title,
      subtitle: data.subtitle.trim() || null,
      category: data.category || null,
      passPercent: Math.round(data.passPercent),
      timeLimitMinutes: data.timeLimitMinutes,
      retryCooldownDays: data.retryCooldownDays,
      mustPassSections: data.mustPassSections.trim() || null,
      order: maxOrder + 1,
    })
    .returning();

  revalidatePath("/instructor/exams");
  return created ? { success: true, examId: created.id } : { error: "Could not create exam." };
}

/** CFI-only: edits an existing exam's settings (not its content). */
export async function updateExamMeta(
  examId: string,
  data: ExamMetaInput
): Promise<CreateExamState> {
  await requireCFI();

  const title = data.title.trim();
  if (!title) return { error: "Exam title can't be empty." };
  if (!Number.isFinite(data.passPercent) || data.passPercent <= 0 || data.passPercent > 100) {
    return { error: "Pass percent must be between 1 and 100." };
  }

  await db
    .update(exams)
    .set({
      title,
      subtitle: data.subtitle.trim() || null,
      category: data.category || null,
      passPercent: Math.round(data.passPercent),
      timeLimitMinutes: data.timeLimitMinutes,
      retryCooldownDays: data.retryCooldownDays,
      mustPassSections: data.mustPassSections.trim() || null,
    })
    .where(eq(exams.id, examId));

  revalidatePath("/instructor/exams");
  revalidatePath(`/instructor/exams/${examId}/edit`);
  return { success: true, examId };
}

/** CFI-only: deletes an exam entirely (sections/questions/attempts cascade
 * with it). Called only after the client confirms -- this has no undo, and
 * removes any students' history of taking this exam along with it. */
export async function deleteExam(examId: string) {
  await requireCFI();
  await db.delete(exams).where(eq(exams.id, examId));
  revalidatePath("/instructor/exams");
}

