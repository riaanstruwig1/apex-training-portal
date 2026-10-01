"use server";

import { eq, asc, and } from "drizzle-orm";
import * as z from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { sections, exercises } from "@/db/schema";
import { requireCFI } from "@/lib/auth/dal";
import { isSectionPhase, isSectionTrainingType } from "@/lib/syllabus-tags";

async function assertInstructor() {
  await requireCFI();
}

export async function addSection(formData: FormData) {
  await assertInstructor();
  const name = z.string().trim().min(1).parse(formData.get("name"));
  const description = (formData.get("description") as string) || null;
  // V24 item 75: every section is tagged with a training type + phase.
  const trainingTypeRaw = formData.get("trainingType");
  const phaseRaw = formData.get("phase");
  const trainingType = isSectionTrainingType(trainingTypeRaw) ? trainingTypeRaw : "all";
  const phase = isSectionPhase(phaseRaw) ? phaseRaw : "p1";

  const existing = await db.select({ order: sections.order }).from(sections);
  const nextOrder = existing.reduce((m, s) => Math.max(m, s.order), 0) + 1;

  await db.insert(sections).values({ name, description, order: nextOrder, trainingType, phase });
  revalidatePath("/instructor/syllabus");
}

/** V24 item 75: change a section's training type / phase from the two
 * dropdowns on Manage Syllabus. Existing exercise codes are left alone --
 * only the suggested code for NEW exercises follows the new tags. */
export async function updateSectionTags(sectionId: string, trainingType: string, phase: string) {
  await assertInstructor();
  if (!isSectionTrainingType(trainingType) || !isSectionPhase(phase)) return;
  await db.update(sections).set({ trainingType, phase }).where(eq(sections.id, sectionId));
  revalidatePath("/instructor/syllabus");
  revalidatePath("/instructor");
  revalidatePath("/student");
  revalidatePath("/student/exercises");
}

export async function updateSection(
  sectionId: string,
  name: string,
  description: string
) {
  await assertInstructor();
  await db
    .update(sections)
    .set({ name: name.trim(), description: description.trim() || null })
    .where(eq(sections.id, sectionId));
  revalidatePath("/instructor/syllabus");
}

/** Moves a section up/down among the sections with the same training type
 * and phase -- that's the only order that's visible anywhere now (V24 item
 * 75), since display is grouped by training type, then phase. */
export async function moveSection(sectionId: string, direction: "up" | "down") {
  await assertInstructor();
  const [target] = await db.select().from(sections).where(eq(sections.id, sectionId)).limit(1);
  if (!target) return;
  const all = await db
    .select()
    .from(sections)
    .where(and(eq(sections.trainingType, target.trainingType), eq(sections.phase, target.phase)))
    .orderBy(asc(sections.order));
  const idx = all.findIndex((s) => s.id === sectionId);
  if (idx === -1) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;

  const a = all[idx];
  const b = all[swapIdx];
  await db.update(sections).set({ order: b.order }).where(eq(sections.id, a.id));
  await db.update(sections).set({ order: a.order }).where(eq(sections.id, b.id));
  revalidatePath("/instructor/syllabus");
}

const NewExerciseSchema = z.object({
  code: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
});

export type AddExerciseResult = { error: string } | { success: true };

// Exercise codes are unique across the ENTIRE syllabus, not just within one
// section (see the `exercises_code_unique` index in db/schema.ts). A custom
// syllabus that reuses a code in more than one section/phase hits that
// constraint at the database level -- caught here so it shows a friendly
// message instead of crashing the whole page.
export async function addExercise(
  sectionId: string,
  formData: FormData
): Promise<AddExerciseResult> {
  await assertInstructor();
  const parsed = NewExerciseSchema.parse({
    code: formData.get("code"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  });

  const existing = await db
    .select()
    .from(exercises)
    .where(eq(exercises.sectionId, sectionId));
  const nextOrder = existing.length + 1;

  try {
    await db.insert(exercises).values({
      sectionId,
      code: parsed.code,
      title: parsed.title,
      description: parsed.description || null,
      order: nextOrder,
    });
  } catch (err) {
    // node:sqlite throws the actual "UNIQUE constraint failed" text on
    // `err.cause`, not on the outer Drizzle "Failed query" error -- check
    // both so this keeps working if that wrapping ever changes.
    const message = `${String(err)} ${String((err as { cause?: unknown })?.cause ?? "")}`;
    if (message.includes("UNIQUE constraint failed") && message.includes("exercises.code")) {
      return {
        error: `Code "${parsed.code}" is already used somewhere else in the syllabus -- exercise codes must be unique across every section, not just this one. Try a different code (e.g. "${parsed.code}-2").`,
      };
    }
    return { error: "Something went wrong adding this exercise. Please try again." };
  }

  revalidatePath("/instructor/syllabus");
  return { success: true };
}

export type UpdateExerciseResult = { error: string } | { success: true };

// Same unique-code handling as addExercise above -- editing an exercise's
// code can collide with another exercise elsewhere in the syllabus just as
// easily as adding a new one can.
export async function updateExercise(
  exerciseId: string,
  formData: FormData
): Promise<UpdateExerciseResult> {
  await assertInstructor();
  const parsed = NewExerciseSchema.parse({
    code: formData.get("code"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  });

  try {
    await db
      .update(exercises)
      .set({
        code: parsed.code,
        title: parsed.title,
        description: parsed.description || null,
      })
      .where(eq(exercises.id, exerciseId));
  } catch (err) {
    const message = `${String(err)} ${String((err as { cause?: unknown })?.cause ?? "")}`;
    if (message.includes("UNIQUE constraint failed") && message.includes("exercises.code")) {
      return {
        error: `Code "${parsed.code}" is already used somewhere else in the syllabus -- exercise codes must be unique across every section, not just this one.`,
      };
    }
    return { error: "Something went wrong updating this exercise. Please try again." };
  }

  revalidatePath("/instructor/syllabus");
  return { success: true };
}

export async function deleteExercise(exerciseId: string) {
  await assertInstructor();
  await db.delete(exercises).where(eq(exercises.id, exerciseId));
  revalidatePath("/instructor/syllabus");
}

export async function deleteSection(sectionId: string) {
  await assertInstructor();
  await db.delete(sections).where(eq(sections.id, sectionId));
  revalidatePath("/instructor/syllabus");
}
