import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { studentProfiles } from "@/db/schema";
import { requireStudent } from "@/lib/auth/dal";
import { getExamDetail, getAttemptHistory, visibleExamCategories, type ExamCategory } from "@/lib/exams";
import { ensureAttempt } from "@/lib/actions/exams";
import ExamForm from "./exam-form";
import StartExamGate from "./start-exam-gate";

export default async function StudentExamPage(
  props: PageProps<"/student/exams/[examId]">
) {
  const { user } = await requireStudent();
  const { examId } = await props.params;

  // Timed exams (e.g. the RT exam's 60-minute clock) don't auto-start:
  // creating the attempt row is what starts the clock, so the student
  // has to see the warning and confirm first. Untimed exams (PG) keep
  // the old auto-start-on-visit behaviour.
  const peek = await getExamDetail(examId, user.id, false);
  if (!peek) notFound();

  // Defense in depth: the dashboard already hides exams outside the
  // student's training type, but that's just UI -- block a direct URL
  // too, so a PG-only student can't reach the PPT exam by guessing the
  // link. A category-less exam (not yet slotted into PG/PPG/PPT/RT)
  // always stays reachable.
  const [studentProfile] = await db
    .select({ trainingType: studentProfiles.trainingType })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, user.id))
    .limit(1);
  const visibleCategories = visibleExamCategories(studentProfile?.trainingType);
  if (
    peek.exam.category &&
    visibleCategories &&
    !visibleCategories.includes(peek.exam.category as ExamCategory)
  ) {
    notFound();
  }

  if (peek.exam.timeLimitMinutes && !peek.attempt) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{peek.exam.title}</h1>
          {peek.exam.subtitle && (
            <p className="text-sm text-slate-500">{peek.exam.subtitle}</p>
          )}
        </div>
        <StartExamGate
          examId={examId}
          timeLimitMinutes={peek.exam.timeLimitMinutes}
          retryCooldownDays={peek.exam.retryCooldownDays}
        />
      </div>
    );
  }

  // Creates the attempt row on first visit; a no-op afterwards. For a
  // timed exam this only runs once we already know an attempt exists
  // (the gate above handles first-start), so it never silently starts
  // the clock without the student having seen the warning.
  await ensureAttempt(examId);

  const detail = await getExamDetail(examId, user.id, false);
  if (!detail) notFound();

  // Once verified, reveal the student's own right/wrong marks (never the
  // correct answer for anything they got wrong -- see getExamDetail).
  const finalDetail =
    detail.attempt?.status === "verified"
      ? await getExamDetail(examId, user.id, true)
      : detail;
  if (!finalDetail) notFound();

  const history = await getAttemptHistory(user.id, examId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{finalDetail.exam.title}</h1>
        {finalDetail.exam.subtitle && (
          <p className="text-sm text-slate-500">{finalDetail.exam.subtitle}</p>
        )}
      </div>
      <ExamForm
        examId={examId}
        exam={finalDetail.exam}
        attempt={finalDetail.attempt}
        history={history}
      />
    </div>
  );
}
