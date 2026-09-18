"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { studyMaterials } from "@/db/schema";
import { requireCFI } from "@/lib/auth/dal";
import {
  saveStudyMaterialFile,
  deleteStudyMaterialFile,
  StudyMaterialUploadError,
} from "@/lib/study-material-uploads";

export type StudyMaterialSlot = {
  id: string;
  slot: number;
  title: string | null;
  filename: string | null;
  originalName: string | null;
  fileSize: number | null;
  uploadedAt: Date | null;
};

/** All 8 slots (1-8), in order -- synthesizes an empty placeholder for any
 * slot with no row yet, so callers never have to handle "row missing"
 * separately from "row present but empty". */
export async function getStudyMaterials(): Promise<StudyMaterialSlot[]> {
  const rows = await db.select().from(studyMaterials);
  const bySlot = new Map(rows.map((r) => [r.slot, r]));

  return Array.from({ length: 8 }, (_, i) => {
    const slot = i + 1;
    const row = bySlot.get(slot);
    return {
      id: row?.id ?? `empty-${slot}`,
      slot,
      title: row?.title ?? null,
      filename: row?.filename ?? null,
      originalName: row?.originalName ?? null,
      fileSize: row?.fileSize ?? null,
      uploadedAt: row?.uploadedAt ?? null,
    };
  });
}

export type SaveSlotState = { error: string } | { success: true } | undefined;

/** CFI-only: sets or replaces one slot's title and (optionally) its file.
 * A title-only edit -- no new file chosen -- keeps whatever file is
 * already in that slot. The first upload for a slot needs both. */
export async function saveStudyMaterialSlot(
  _prevState: SaveSlotState,
  formData: FormData
): Promise<SaveSlotState> {
  const cfi = await requireCFI();

  const slot = Number(formData.get("slot"));
  const title = String(formData.get("title") ?? "").trim();
  if (!Number.isInteger(slot) || slot < 1 || slot > 8) {
    return { error: "Invalid slot." };
  }
  if (!title) return { error: "Give this item a title." };

  const fileInput = formData.get("file");

  try {
    const [existing] = await db
      .select()
      .from(studyMaterials)
      .where(eq(studyMaterials.slot, slot))
      .limit(1);

    let fileFields: {
      filename: string;
      originalName: string;
      fileSize: number;
      uploadedAt: Date;
      uploadedByUserId: string;
    } | null = null;

    if (fileInput instanceof File && fileInput.size > 0) {
      const saved = await saveStudyMaterialFile(fileInput);
      fileFields = { ...saved, uploadedAt: new Date(), uploadedByUserId: cfi.id };
      // Replace, don't accumulate -- remove the old file from disk only
      // once the new one is safely written.
      if (existing?.filename) await deleteStudyMaterialFile(existing.filename);
    } else if (!existing?.filename) {
      return { error: "Choose a file to upload." };
    }

    if (existing) {
      await db
        .update(studyMaterials)
        .set({ title, ...(fileFields ?? {}) })
        .where(eq(studyMaterials.id, existing.id));
    } else {
      await db.insert(studyMaterials).values({
        slot,
        title,
        filename: fileFields!.filename,
        originalName: fileFields!.originalName,
        fileSize: fileFields!.fileSize,
        uploadedAt: fileFields!.uploadedAt,
        uploadedByUserId: fileFields!.uploadedByUserId,
      });
    }
  } catch (err) {
    if (err instanceof StudyMaterialUploadError) return { error: err.message };
    throw err;
  }

  revalidatePath("/instructor/study-material");
  revalidatePath("/student");
  return { success: true };
}

/** CFI-only: clears a slot back to empty, removing its file from disk. */
export async function deleteStudyMaterialSlot(slot: number) {
  await requireCFI();

  const [existing] = await db
    .select()
    .from(studyMaterials)
    .where(eq(studyMaterials.slot, slot))
    .limit(1);
  if (!existing) return;

  if (existing.filename) await deleteStudyMaterialFile(existing.filename);
  await db.delete(studyMaterials).where(eq(studyMaterials.id, existing.id));

  revalidatePath("/instructor/study-material");
  revalidatePath("/student");
}
