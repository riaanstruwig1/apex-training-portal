import { asc } from "drizzle-orm";
import { db } from "@/db";
import { sections, exercises } from "@/db/schema";
import { requireCFI } from "@/lib/auth/dal";
import SyllabusEditor from "./syllabus-editor";

export default async function SyllabusPage() {
  await requireCFI();

  const allSections = await db.select().from(sections).orderBy(asc(sections.order));
  const allExercises = await db.select().from(exercises).orderBy(asc(exercises.order));

  const sectionsWithExercises = allSections.map((s) => ({
    ...s,
    exercises: allExercises.filter((e) => e.sectionId === s.id),
  }));

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Manage syllabus</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Sections gate student progress: a student can&apos;t start a section
        until every exercise in the previous one is signed off. This was
        seeded from Appendix A of the DTO Procedures Manual as a starting
        grouping &mdash; reorder, rename, or add to it here to match how you
        actually teach.
      </p>
      <SyllabusEditor sections={sectionsWithExercises} />
    </div>
  );
}
