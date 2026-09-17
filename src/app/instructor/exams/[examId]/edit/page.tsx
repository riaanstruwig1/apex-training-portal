import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { exams, examSections, examQuestions, examOptions } from "@/db/schema";
import { requireCFI } from "@/lib/auth/dal";
import ExamContentEditor from "./exam-content-editor";

export default async function ExamEditPage(
  props: PageProps<"/instructor/exams/[examId]/edit">
) {
  await requireCFI();
  const { examId } = await props.params;

  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) notFound();

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

  const sections = sectionRows.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    questions: questionRows
      .filter((q) => q.sectionId === s.id)
      .map((q) => ({
        id: q.id,
        code: q.code,
        prompt: q.prompt,
        options: optionRows
          .filter((o) => o.questionId === q.id)
          .sort((a, b) => a.order - b.order)
          .map((o) => ({ id: o.id, label: o.label, text: o.text, image: o.image, isCorrect: o.isCorrect })),
      })),
  }));

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">{exam.title}</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Click a question to fix its wording. Only the text of the question
        and its answers can change here &mdash; order, marks, images, and
        which answer is correct are locked to protect scoring.
      </p>
      <ExamContentEditor examId={examId} sections={sections} />
    </div>
  );
}
