"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { contentItems, exercises } from "@/db/schema";
import { getCurrentUser, requireCFI } from "@/lib/auth/dal";
import {
  ContentItemUploadError,
  deleteContentItemFile,
  saveContentItemFile,
} from "@/lib/content-item-uploads";

export type ContentItemView = {
  id: string;
  title: string;
  body: string | null;
  filename: string | null;
  originalName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  linkUrl: string | null;
};

/** Sub-sections of one exercise, for its info overlay (line 70). Any
 * signed-in account (student, instructor, CFI) can read them. */
export async function getExerciseContent(exerciseId: string): Promise<ContentItemView[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      body: contentItems.body,
      filename: contentItems.filename,
      originalName: contentItems.originalName,
      mimeType: contentItems.mimeType,
      fileSize: contentItems.fileSize,
      linkUrl: contentItems.linkUrl,
    })
    .from(contentItems)
    .where(and(eq(contentItems.ownerType, "exercise"), eq(contentItems.ownerId, exerciseId)))
    .orderBy(asc(contentItems.order), asc(contentItems.createdAt));
}

export type AddContentState = { error: string } | { success: true } | undefined;

function normalizeUrl(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

/** CFI only: "Add+" a sub-section to an exercise -- a title plus any of a
 * note, a picture/document, or a link. */
export async function addExerciseContent(
  _prev: AddContentState,
  formData: FormData
): Promise<AddContentState> {
  const cfi = await requireCFI();
  const exerciseId = String(formData.get("exerciseId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const link = String(formData.get("linkUrl") ?? "").trim();
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;

  if (!title) return { error: "Give this sub-section a title." };
  if (!body && !link && !hasFile) return { error: "Add a note, a picture/document, or a link." };

  const [exercise] = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(eq(exercises.id, exerciseId))
    .limit(1);
  if (!exercise) return { error: "That exercise no longer exists." };

  let saved: Awaited<ReturnType<typeof saveContentItemFile>> | null = null;
  if (hasFile) {
    try {
      saved = await saveContentItemFile(file as File);
    } catch (err) {
      if (err instanceof ContentItemUploadError) return { error: err.message };
      throw err;
    }
  }

  const existing = await db
    .select({ order: contentItems.order })
    .from(contentItems)
    .where(and(eq(contentItems.ownerType, "exercise"), eq(contentItems.ownerId, exerciseId)));
  const nextOrder = existing.reduce((m, r) => Math.max(m, r.order), 0) + 1;

  await db.insert(contentItems).values({
    ownerType: "exercise",
    ownerId: exerciseId,
    title,
    body: body || null,
    linkUrl: link ? normalizeUrl(link) : null,
    filename: saved?.filename ?? null,
    originalName: saved?.originalName ?? null,
    mimeType: saved?.mimeType ?? null,
    fileSize: saved?.fileSize ?? null,
    order: nextOrder,
    createdByUserId: cfi.id,
  });

  revalidateExerciseViews();
  return { success: true };
}

/** CFI only: remove a sub-section (and its file). */
export async function deleteContentItem(itemId: string) {
  await requireCFI();
  const [item] = await db.select().from(contentItems).where(eq(contentItems.id, itemId)).limit(1);
  if (!item) return;
  if (item.filename) await deleteContentItemFile(item.filename);
  await db.delete(contentItems).where(eq(contentItems.id, itemId));
  revalidateExerciseViews();
}

function revalidateExerciseViews() {
  revalidatePath("/instructor/syllabus");
  revalidatePath("/instructor/students", "layout");
  revalidatePath("/student/exercises");
}
