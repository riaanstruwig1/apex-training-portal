import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { studentProfiles } from "@/db/schema";
import { requireStudent } from "@/lib/auth/dal";
import { getExamsForStudent, visibleExamCategories, type ExamCategory } from "@/lib/exams";
import PaperExamForm from "./paper-exam-form";

/** V22-follow-up (25 Sep 2026, Riaan): some students already wrote the
 * Basic/PPG exam on paper, or already hold an SACAA radio licence from
 * outside this school -- this is where they submit proof instead of
 * taking the exam online. Deliberately a separate route from the online
 * exam page rather than a branch inside it: the online page auto-starts
 * an attempt (ensureAttempt) and drives a timed clock for the RT exam,
 * neither of which should ever fire just from visiting this page. */
export default async function PaperExamPage(
  props: PageProps<"/student/exams/[examId]/paper">
) {
  const { user } = await requireStudent();
  const { examId } = await props.params;

  const [studentProfile] = await db
    .select({ trainingType: studentProfiles.trainingType })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, user.id))
    .limit(1);

  const summaries = await getExamsForStudent(user.id, studentProfile?.trainingType);
  const summary = summaries.find((e) => e.examId === examId);
  if (!summary) notFound();

  // Same defense-in-depth as the online exam page: a category outside the
  // student's training type, or an exam already passed / mid-attempt,
  // isn't reachable here even by a direct link.
  const visibleCategories = visibleExamCategories(studentProfile?.trainingType);
  if (
    summary.category &&
    visibleCategories &&
    !visibleCategories.includes(summary.category as ExamCategory)
  ) {
    notFound();
  }
  if (!summary.canSubmitPaper) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{summary.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {summary.category === "rt"
            ? "Already hold an SACAA radio licence? Submit it here instead of writing the online exam."
            : "Already wrote this exam on paper? Submit it here instead of writing it online."}
        </p>
      </div>
      <PaperExamForm examId={examId} isRadio={summary.category === "rt"} />
    </div>
  );
}
