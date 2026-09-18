import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { exams, examSections, examQuestions, examOptions } from "@/db/schema";
import { requireCFI } from "@/lib/auth/dal";
import ExamContentEditor from "./exam-content-editor";
import ExamMetaEditor from "./exam-meta-editor";

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
        marks: q.marks,
        options: optionRows
          .filter((o) => o.questionId === q.id)
          .sort((a, b) => a.order - b.order)
          .map((o) => ({
            id: o.id,
            label: o.label,
            text: o.text,
            image: o.image,
            isCorrect: o.isCorrect,
          })),
      })),
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link href="/instructor/exams" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; All exams
        </Link>
      </div>
      <ExamMetaEditor
        exam={{
          id: exam.id,
          title: exam.title,
          subtitle: exam.subtitle,
          category: (exam.category as "pg" | "ppg" | "ppt" | "rt" | null) ?? "",
          passPercent: exam.passPercent,
          timeLimitMinutes: exam.timeLimitMinutes,
          retryCooldownDays: exam.retryCooldownDays,
          mustPassSections: exam.mustPassSections,
        }}
      />
      <div className="my-8 border-t border-slate-200" />
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Questions &amp; answers</h2>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Click a question to edit its wording, marks, or which answer is
        correct. Changing the correct answer only affects attempts taken
        from now on &mdash; a student&apos;s already-submitted result never
        changes.
      </p>
      <ExamContentEditor examId={examId} sections={sections} />
    </div>
  );
}
