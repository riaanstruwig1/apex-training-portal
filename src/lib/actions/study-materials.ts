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
  /** Link-instead-of-upload option, added 30 Sep 2026 after a CFI's slide
   * deck turned out to be ~330MB -- far past the 50MB upload cap, and not
   * something worth hosting/re-downloading per student anyway. Mutually
   * exclusive with filename/originalName/fileSize -- whichever the CFI set
   * most recently wins. */
  linkUrl: string | null;
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
      linkUrl: row?.linkUrl ?? null,
    };
  });
}

export type SaveSlotState = { error: string } | { success: true } | undefined;

function normalizeUrl(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

/** CFI-only: sets or replaces one slot's title and (optionally) its file or
 * link. A title-only edit -- no new file chosen and no link typed -- keeps
 * whatever file/link is already in that slot. The first save for a slot
 * needs one of: a file, or a link. File and link are mutually exclusive --
 * whichever was set most recently wins, same pattern as the student-notice
 * bar's noticeFile/noticeLinkUrl (lib/actions/settings.ts). A link is the
 * better choice for anything too big to sanely host here (e.g. a slide
 * deck with embedded video) -- point it at Google Drive/OneDrive/YouTube
 * instead. */
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
  const linkInput = String(formData.get("linkUrl") ?? "").trim();

  try {
    const [existing] = await db
      .select()
      .from(studyMaterials)
      .where(eq(studyMaterials.slot, slot))
      .limit(1);

    let attachmentFields: {
      filename: string | null;
      originalName: string | null;
      fileSize: number | null;
      uploadedAt: Date | null;
      uploadedByUserId: string | null;
      linkUrl: string | null;
    } | null = null;

    if (fileInput instanceof File && fileInput.size > 0) {
      const saved = await saveStudyMaterialFile(fileInput);
      attachmentFields = {
        ...saved,
        uploadedAt: new Date(),
        uploadedByUserId: cfi.id,
        linkUrl: null,
      };
      // Replace, don't accumulate -- remove the old file from disk only
      // once the new one is safely written.
      if (existing?.filename) await deleteStudyMaterialFile(existing.filename);
    } else if (linkInput) {
      if (existing?.filename) await deleteStudyMaterialFile(existing.filename);
      attachmentFields = {
        filename: null,
        originalName: null,
        fileSize: null,
        uploadedAt: new Date(),
        uploadedByUserId: cfi.id,
        linkUrl: normalizeUrl(linkInput),
      };
    } else if (!existing?.filename && !existing?.linkUrl) {
      return { error: "Choose a file to upload, or paste a link." };
    }

    if (existing) {
      await db
        .update(studyMaterials)
        .set({ title, ...(attachmentFields ?? {}) })
        .where(eq(studyMaterials.id, existing.id));
    } else {
      await db.insert(studyMaterials).values({
        slot,
        title,
        filename: attachmentFields!.filename,
        originalName: attachmentFields!.originalName,
        fileSize: attachmentFields!.fileSize,
        uploadedAt: attachmentFields!.uploadedAt,
        uploadedByUserId: attachmentFields!.uploadedByUserId,
        linkUrl: attachmentFields!.linkUrl,
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
