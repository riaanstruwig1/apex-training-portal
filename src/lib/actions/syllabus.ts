"use server";

import { eq, asc } from "drizzle-orm";
import * as z from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { sections, exercises } from "@/db/schema";
import { requireCFI } from "@/lib/auth/dal";

async function assertInstructor() {
  await requireCFI();
}

export async function addSection(formData: FormData) {
  await assertInstructor();
  const name = z.string().trim().min(1).parse(formData.get("name"));
  const description = (formData.get("description") as string) || null;

  const existing = await db.select().from(sections);
  const nextOrder = existing.length + 1;

  await db.insert(sections).values({ name, description, order: nextOrder });
  revalidatePath("/instructor/syllabus");
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

export async function moveSection(sectionId: string, direction: "up" | "down") {
  await assertInstructor();
  const all = await db.select().from(sections).orderBy(asc(sections.order));
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
    const message = String(err);
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
