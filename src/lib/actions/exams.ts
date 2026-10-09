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
import { saveUpload, UploadError } from "@/lib/uploads";

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

export type SubmitPaperExamState = { error: string } | undefined;

/**
 * Student self-submits a pre-written (paper) exam, or an SACAA radio
 * licence they already hold for the RT exam specifically -- added 25 Sep
 * 2026 per Riaan: some students already wrote the Basic/PPG exam on
 * paper, and a student may already hold a radio licence from outside
 * this school. This does NOT mark the exam passed by itself (unlike an
 * online submission, there's no score to compute it from) -- it only
 * gets the attempt to "submitted", same as an online exam waiting on
 * verifyExamAttempt. A CFI/Admin must review the uploaded proof and
 * explicitly decide pass/fail via verifyPaperExam below, mirroring the
 * flight logbook's log-then-countersign pattern rather than the
 * instructor grade-rating's instant-effect one -- a student's own upload
 * shouldn't be able to mark itself as a pass.
 *
 * Eligible exactly when a fresh online attempt would also be eligible to
 * start (no attempt yet, or the latest one is a verified fail past its
 * cooldown) -- see ExamSummary.canSubmitPaper in lib/exams.ts, computed
 * the same way as the online startNewAttempt gate above.
 */
export async function submitPaperExam(
  examId: string,
  _prevState: SubmitPaperExamState,
  formData: FormData
): Promise<SubmitPaperExamState> {
  const { user } = await requireStudent();

  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) return { error: "Exam not found." };

  const current = await latestAttempt(user.id, examId);
  if (current && !(current.status === "verified" && current.passed === false)) {
    return {
      error:
        current.status === "verified"
          ? "This exam is already passed."
          : "This exam already has an attempt in progress or awaiting review.",
    };
  }
  if (current?.verifiedAt && exam.retryCooldownDays) {
    const eligibleAt = new Date(
      current.verifiedAt.getTime() + exam.retryCooldownDays * 24 * 60 * 60 * 1000
    );
    if (new Date() < eligibleAt) {
      return {
        error: `You can submit again from ${eligibleAt.toLocaleDateString()} (${exam.retryCooldownDays}-day wait after a fail).`,
      };
    }
  }

  const file = formData.get("proofFile");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Upload a photo or scan of the exam (or licence) to submit." };
  }
  const licenseNumberRaw = formData.get("licenseNumber");
  const licenseNumber = typeof licenseNumberRaw === "string" ? licenseNumberRaw.trim() : "";
  if (exam.category === "rt" && !licenseNumber) {
    return { error: "Enter the radio licence number shown on your SACAA licence." };
  }

  let proofFile: string | null;
  try {
    proofFile = await saveUpload(user.id, `paper-exam-${exam.slug}`, file);
  } catch (err) {
    return { error: err instanceof UploadError ? err.message : "proofFile: upload failed." };
  }
  if (!proofFile) {
    return { error: "Upload a photo or scan of the exam (or licence) to submit." };
  }

  await db.insert(examAttempts).values({
    studentId: user.id,
    examId,
    attemptNumber: (current?.attemptNumber ?? 0) + 1,
    status: "submitted",
    submittedAt: new Date(),
    source: "paper",
    proofFile,
    externalLicenseNumber: exam.category === "rt" ? licenseNumber : null,
  });

  revalidatePath(`/student/exams/${examId}`);
  revalidatePath("/student");
  revalidatePath("/instructor");
  revalidatePath(`/instructor/students/${user.id}`);
  return undefined;
}

export type StaffPaperUploadState = { error: string } | { success: true } | undefined;

/**
 * 9 Oct 2026 (Riaan: "I need to be able to upload an exam for a student as
 * CFI, or delete the file and then verify pass or fail"): the staff side of
 * submitPaperExam above -- a CFI/instructor uploads a paper exam (or, for
 * the radio exam, the student's SACAA radio licence) straight from the
 * student's folio, for a student who hasn't submitted anything themselves.
 * Same storage as the student's own upload (the student's upload folder),
 * so View / Download / New upload / Delete / Mark passed / Mark failed on
 * the review page all work on it unchanged. The reviewer can also record
 * the result in the same step ("result" = pending | passed | failed).
 *
 * Allowed when the exam is not started, after a verified fail (a retake;
 * staff aren't held to the retry wait), or over an online attempt the
 * student opened but never answered. Blocked if the student has answered
 * questions online or already has a submission awaiting review / passed.
 */
export async function staffSubmitPaperExam(
  studentId: string,
  examId: string,
  _prevState: StaffPaperUploadState,
  formData: FormData
): Promise<StaffPaperUploadState> {
  const staff = await requireInstructor();

  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) return { error: "Exam not found." };

  const current = await latestAttempt(studentId, examId);
  let replaceEmptyAttemptId: string | null = null;
  if (current) {
    if (current.status === "verified" && current.passed) {
      return { error: "This exam is already passed." };
    }
    if (current.status === "submitted") {
      return { error: "This exam already has a submission awaiting review -- open Review & verify." };
    }
    if (current.status === "in_progress") {
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)` })
        .from(examAnswers)
        .where(eq(examAnswers.attemptId, current.id));
      if (Number(n) > 0) {
        return {
          error: `The student has started this exam online (${n} answered). They need to finish or you can review it once submitted.`,
        };
      }
      replaceEmptyAttemptId = current.id;
    }
  }

  const file = formData.get("proofFile");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose the scanned exam (or licence) to upload." };
  }
  const licenseNumberRaw = formData.get("licenseNumber");
  const licenseNumber = typeof licenseNumberRaw === "string" ? licenseNumberRaw.trim() : "";
  const resultRaw = String(formData.get("result") ?? "pending");
  const result = resultRaw === "passed" || resultRaw === "failed" ? resultRaw : "pending";

  let proofFile: string | null;
  try {
    proofFile = await saveUpload(studentId, `paper-exam-${exam.slug}`, file);
  } catch (err) {
    return { error: err instanceof UploadError ? err.message : "Upload failed." };
  }
  if (!proofFile) return { error: "Choose the scanned exam (or licence) to upload." };

  if (replaceEmptyAttemptId) {
    await db.delete(examAttempts).where(eq(examAttempts.id, replaceEmptyAttemptId));
  }
  const attemptNumber =
    replaceEmptyAttemptId && current ? current.attemptNumber : (current?.attemptNumber ?? 0) + 1;
  const now = new Date();
  await db.insert(examAttempts).values({
    studentId,
    examId,
    attemptNumber,
    status: result === "pending" ? "submitted" : "verified",
    submittedAt: now,
    source: "paper",
    proofFile,
    externalLicenseNumber: exam.category === "rt" && licenseNumber ? licenseNumber : null,
    ...(result === "pending"
      ? {}
      : { passed: result === "passed", verifiedAt: now, verifiedByUserId: staff.id }),
  });

  revalidatePath(`/instructor/students/${studentId}`);
  revalidatePath(`/instructor/students/${studentId}/exams/${examId}`);
  revalidatePath("/instructor");
  revalidatePath("/student");
  revalidatePath(`/student/exams/${examId}`);
  return { success: true };
}

/** CFI/Admin reviews a paper submission and decides pass/fail -- the
 * counterpart to verifyExamAttempt above, but for a "paper" attempt
 * `passed` isn't already computed, so the reviewer sets it explicitly
 * instead of just confirming a number. Same permission level as
 * verifying an online attempt. */
export async function verifyPaperExam(attemptId: string, passed: boolean) {
  const instructor = await requireInstructor();

  const [attempt] = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.id, attemptId))
    .limit(1);
  if (!attempt || attempt.status !== "submitted" || attempt.source !== "paper") return;

  await db
    .update(examAttempts)
    .set({
      status: "verified",
      passed,
      verifiedAt: new Date(),
      verifiedByUserId: instructor.id,
    })
    .where(eq(examAttempts.id, attemptId));

  revalidatePath(`/instructor/students/${attempt.studentId}`);
  revalidatePath(`/instructor/students/${attempt.studentId}/exams/${attempt.examId}`);
  revalidatePath("/instructor");
  revalidatePath("/student");
}

/** "V24" item 73 (28 Sep 2026 renumbering -- Riaan: "Instructor must be able
 * to delete the exam and/or upload a new one"): removes a student's paper
 * submission outright (wrong file, wrong exam, duplicate, etc.) so the
 * student can submit fresh -- submitPaperExam only blocks a new submission
 * while a non-failed attempt exists, and this clears that. Deliberately
 * scoped to "paper" attempts only -- an online attempt's answers/score are
 * a real exam record, not something a bad upload can accidentally corrupt,
 * so this action doesn't touch those. Only removes the database row; the
 * uploaded file itself is left on disk (harmless, same as every other
 * delete action in this app). */
export async function deletePaperExamAttempt(attemptId: string) {
  const instructor = await requireInstructor();

  const [attempt] = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.id, attemptId))
    .limit(1);
  if (!attempt || attempt.source !== "paper") return;

  await db.delete(examAttempts).where(eq(examAttempts.id, attemptId));

  revalidatePath(`/instructor/students/${attempt.studentId}`);
  revalidatePath(`/instructor/students/${attempt.studentId}/exams/${attempt.examId}`);
  revalidatePath("/instructor");
  revalidatePath("/student");
  revalidatePath(`/student/exams/${attempt.examId}`);
}

export type ReplacePaperProofState = { error: string } | { success: true } | undefined;

/** "V24" item 73, the other half -- instead of deleting and making the
 * student redo the whole submission, the reviewer swaps in a corrected
 * scan/photo directly (e.g. the first upload was blurry, cut off, or the
 * wrong page). If the attempt had already been verified, replacing the
 * file resets it back to "submitted" -- a decision made against the old
 * file shouldn't silently keep standing once the file behind it has
 * changed; the reviewer just re-marks it against the new one. */
export async function replacePaperExamProof(
  attemptId: string,
  _prevState: ReplacePaperProofState,
  formData: FormData
): Promise<ReplacePaperProofState> {
  const instructor = await requireInstructor();

  const [attempt] = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.id, attemptId))
    .limit(1);
  if (!attempt || attempt.source !== "paper") return { error: "Attempt not found." };

  const file = formData.get("proofFile");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a replacement photo or scan to upload." };
  }

  let proofFile: string | null;
  try {
    proofFile = await saveUpload(attempt.studentId, `paper-exam-${attempt.examId}`, file);
  } catch (err) {
    return { error: err instanceof UploadError ? err.message : "Upload failed." };
  }
  if (!proofFile) return { error: "Choose a replacement photo or scan to upload." };

  const wasVerified = attempt.status === "verified";
  await db
    .update(examAttempts)
    .set({
      proofFile,
      ...(wasVerified
        ? { status: "submitted", passed: null, verifiedAt: null, verifiedByUserId: null }
        : {}),
    })
    .where(eq(examAttempts.id, attemptId));

  revalidatePath(`/instructor/students/${attempt.studentId}`);
  revalidatePath(`/instructor/students/${attempt.studentId}/exams/${attempt.examId}`);
  revalidatePath("/instructor");
  revalidatePath("/student");
  return { success: true };
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
