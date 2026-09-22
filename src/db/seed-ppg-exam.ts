/**
 * Seeds ONLY the PPG Theoretical Knowledge Test exam -- narrower than
 * `npm run db:seed`, deliberately. That script's syllabus (sections/
 * exercises) inserts have no conflict guard, so re-running it against a
 * database that's already been seeded once (true in production, which
 * already has real students against the real syllabus) would DUPLICATE
 * every section and exercise. This script never touches users, sections,
 * or exercises -- it only inserts the one exam, and does so the same
 * onConflictDoNothing-guarded way seed.ts's exam loop does, so it's safe
 * to run more than once: if the exam already exists (matched by slug),
 * this is a no-op.
 *
 * Run with: npm run db:seed-ppg-exam
 */
import "dotenv/config";
import { db } from "./index";
import { exams, examSections, examQuestions, examOptions } from "./schema";
import ppgTheoreticalKnowledge from "./exam-data/ppg-theoretical-knowledge.json";

type ParsedOption = {
  label: "A" | "B" | "C" | "D";
  text?: string | null;
  image?: string | null;
  correct: boolean;
};
type ParsedQuestion = {
  code: string;
  prompt: string;
  print_prompt?: string | null;
  marks: number;
  type: "text" | "image";
  options: ParsedOption[];
  stem_image?: string | null;
};
type ParsedSection = { letter: string; name: string; questions: ParsedQuestion[] };
type ParsedExam = { sections: ParsedSection[] };

async function main() {
  const content = ppgTheoreticalKnowledge as ParsedExam;

  const [exam] = await db
    .insert(exams)
    .values({
      slug: "ppg-theoretical-knowledge",
      title: "PPG Theoretical Knowledge Test",
      subtitle: "Last Updated 2020-02-03 (Basjan/Riaan)",
      category: "ppg",
      passPercent: 85,
      mustPassSections: "B",
      timeLimitMinutes: 90,
      retryCooldownDays: null,
      order: 2,
    })
    .onConflictDoNothing()
    .returning();

  if (!exam) {
    console.log('PPG exam already exists (slug "ppg-theoretical-knowledge") -- nothing to do.');
    return;
  }

  for (let sIdx = 0; sIdx < content.sections.length; sIdx++) {
    const s = content.sections[sIdx];
    const totalMarks = s.questions.reduce((sum, q) => sum + q.marks, 0);
    const [section] = await db
      .insert(examSections)
      .values({
        examId: exam.id,
        code: s.letter,
        name: s.name,
        order: sIdx + 1,
        totalMarks,
      })
      .returning();

    for (let qIdx = 0; qIdx < s.questions.length; qIdx++) {
      const q = s.questions[qIdx];
      const [question] = await db
        .insert(examQuestions)
        .values({
          sectionId: section.id,
          code: q.code,
          prompt: q.prompt,
          printPrompt: q.print_prompt ?? null,
          marks: q.marks,
          order: qIdx + 1,
          stemImage: q.stem_image ?? null,
        })
        .returning();

      for (let oIdx = 0; oIdx < q.options.length; oIdx++) {
        const o = q.options[oIdx];
        await db.insert(examOptions).values({
          questionId: question.id,
          label: o.label,
          text: o.text ?? null,
          image: o.image ?? null,
          isCorrect: o.correct,
          order: oIdx + 1,
        });
      }
    }
  }

  console.log(`Seeded exam: ${exam.title} (${content.sections.reduce((n, s) => n + s.questions.length, 0)} questions).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
