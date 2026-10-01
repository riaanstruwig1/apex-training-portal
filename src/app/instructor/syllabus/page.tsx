import { asc } from "drizzle-orm";
import { db } from "@/db";
import { sections, exercises } from "@/db/schema";
import { requireCFI } from "@/lib/auth/dal";
import SyllabusEditor from "./syllabus-editor";
import { getExerciseContentCounts } from "@/lib/content-counts";
import { compareSections, suggestExerciseCode } from "@/lib/syllabus-tags";

export default async function SyllabusPage() {
  await requireCFI();

  const allSections = await db.select().from(sections).orderBy(asc(sections.order));
  const allExercises = await db.select().from(exercises).orderBy(asc(exercises.order));
  const infoCounts = await getExerciseContentCounts();

  const allCodes = allExercises.map((e) => e.code);
  // V24 item 75: shown grouped by training type, then phase, then the CFI's
  // own order -- the same order students and the CFI folio use.
  const sectionsWithExercises = [...allSections].sort(compareSections).map((s) => ({
    ...s,
    exercises: allExercises.filter((e) => e.sectionId === s.id),
    suggestedCode: suggestExerciseCode(s.trainingType, s.phase, allCodes),
  }));

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Manage syllabus</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Each section has a training type (PG / PPG / PPT, or applicable to all) and
        a phase. Students only see the sections for the training they signed up
        for, in order: Phase 1, Phase 2, Phase 3, then Conversion and Practical
        Theory. A student can&apos;t start a section until every exercise in the
        one before it is signed off. New exercises get
        a default code like <span className="font-mono">PPG-P1-Ex8</span> &mdash;
        change it if you need to.
      </p>
      <SyllabusEditor sections={sectionsWithExercises} infoCounts={infoCounts} />
    </div>
  );
}
