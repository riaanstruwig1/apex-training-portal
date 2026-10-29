"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { formsProcedures, formsSendTabs } from "@/db/schema";
import { requireAdminOrCFI } from "@/lib/auth/dal";
import {
  saveFormsProcedureFile,
  deleteFormsProcedureFile,
  FormsProcedureUploadError,
} from "@/lib/forms-procedures-uploads";
import { normalizePhone, formatPhone } from "@/lib/invite-message";
import { sendWhatsAppFile } from "@/lib/whatsapp";
import { FORMS_SEND_NOTE, FORMS_SEND_SIGNOFF, loadFormsDocument } from "@/lib/forms-send";
import { DEFAULT_FORMS_CATEGORY, isFormsCategory } from "@/lib/forms-categories";

const MIN_SLOTS = 10;

export type FormsProcedureSlot = {
  id: string;
  slot: number;
  title: string | null;
  filename: string | null;
  originalName: string | null;
  fileSize: number | null;
  uploadedAt: Date | null;
  category: string;
};

/** At least 10 slots, in order -- synthesizes an empty placeholder for any
 * slot with no row yet, same as getStudyMaterials(). Unlike Study Material's
 * fixed cap of 8, this list is open-ended ("10 plus an add more" per
 * Riaan's spec): once every slot up to the current highest is filled,
 * addFormsProcedureSlot() below adds a genuine new row so the extra
 * capacity persists across reloads instead of resetting. */
export async function getFormsProcedures(): Promise<FormsProcedureSlot[]> {
  const rows = await db.select().from(formsProcedures);
  const bySlot = new Map(rows.map((r) => [r.slot, r]));
  const highestSlot = rows.reduce((max, r) => Math.max(max, r.slot), 0);
  const count = Math.max(MIN_SLOTS, highestSlot);

  return Array.from({ length: count }, (_, i) => {
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
      category: row?.category ?? DEFAULT_FORMS_CATEGORY,
    };
  });
}

/** CFI/Admin-only: adds one more genuinely-empty slot past whatever the
 * current highest slot number is (at least MIN_SLOTS), so "+ Add another
 * slot" grows the list for good rather than just widening the client-side
 * render. The new row has no title/filename -- it's a real placeholder,
 * distinguishable from the synthesized ones only in that it now persists. */
export async function addFormsProcedureSlot() {
  await requireAdminOrCFI();

  const rows = await db.select().from(formsProcedures);
  const highestSlot = rows.reduce((max, r) => Math.max(max, r.slot), 0);
  const nextSlot = Math.max(MIN_SLOTS, highestSlot) + 1;

  await db.insert(formsProcedures).values({ slot: nextSlot });
  revalidatePath("/admin/forms-procedures");
}

export type SaveSlotState = { error: string } | { success: true } | undefined;

/** CFI/Admin-only: sets or replaces one slot's title and (optionally) its
 * file. A title-only edit -- no new file chosen -- keeps whatever file is
 * already in that slot. The first upload for a slot needs both. */
export async function saveFormsProcedureSlot(
  _prevState: SaveSlotState,
  formData: FormData
): Promise<SaveSlotState> {
  const staff = await requireAdminOrCFI();

  const slot = Number(formData.get("slot"));
  const title = String(formData.get("title") ?? "").trim();
  if (!Number.isInteger(slot) || slot < 1) {
    return { error: "Invalid slot." };
  }
  if (!title) return { error: "Give this item a title." };
  const categoryRaw = formData.get("category");
  const category = isFormsCategory(categoryRaw) ? categoryRaw : DEFAULT_FORMS_CATEGORY;

  const fileInput = formData.get("file");

  try {
    const [existing] = await db
      .select()
      .from(formsProcedures)
      .where(eq(formsProcedures.slot, slot))
      .limit(1);

    let fileFields: {
      filename: string;
      originalName: string;
      fileSize: number;
      uploadedAt: Date;
      uploadedByUserId: string;
    } | null = null;

    if (fileInput instanceof File && fileInput.size > 0) {
      const saved = await saveFormsProcedureFile(fileInput);
      fileFields = { ...saved, uploadedAt: new Date(), uploadedByUserId: staff.id };
      // Replace, don't accumulate -- remove the old file from disk only
      // once the new one is safely written.
      if (existing?.filename) await deleteFormsProcedureFile(existing.filename);
    } else if (!existing?.filename) {
      return { error: "Choose a file to upload." };
    }

    if (existing) {
      await db
        .update(formsProcedures)
        .set({ title, category, ...(fileFields ?? {}) })
        .where(eq(formsProcedures.id, existing.id));
    } else {
      await db.insert(formsProcedures).values({
        slot,
        title,
        category,
        filename: fileFields!.filename,
        originalName: fileFields!.originalName,
        fileSize: fileFields!.fileSize,
        uploadedAt: fileFields!.uploadedAt,
        uploadedByUserId: fileFields!.uploadedByUserId,
      });
    }
  } catch (err) {
    if (err instanceof FormsProcedureUploadError) return { error: err.message };
    throw err;
  }

  revalidatePath("/admin/forms-procedures");
  revalidatePath("/student/forms-procedures");
  revalidatePath("/pilot/forms-procedures");
  return { success: true };
}

/** CFI/Admin-only: clears a slot back to empty, removing its file from
 * disk and its row from the database -- same as deleteStudyMaterialSlot().
 * getFormsProcedures() still renders that slot number as an empty
 * placeholder afterwards since it pads by the highest slot seen, not by
 * row count. */
export async function deleteFormsProcedureSlot(slot: number) {
  await requireAdminOrCFI();

  const [existing] = await db
    .select()
    .from(formsProcedures)
    .where(eq(formsProcedures.slot, slot))
    .limit(1);
  if (!existing) return;

  if (existing.filename) await deleteFormsProcedureFile(existing.filename);
  await db.delete(formsProcedures).where(eq(formsProcedures.id, existing.id));

  // Batch 87: drop the cleared document from any send-pack tab, so a new
  // document that later takes this slot number isn't sent by mistake.
  const tabs = await db.select().from(formsSendTabs);
  for (const t of tabs) {
    let list: number[] = [];
    try {
      list = JSON.parse(t.slots);
    } catch {}
    if (Array.isArray(list) && list.includes(slot)) {
      await db
        .update(formsSendTabs)
        .set({ slots: JSON.stringify(list.filter((n) => n !== slot)) })
        .where(eq(formsSendTabs.id, t.id));
    }
  }

  revalidatePath("/admin/forms-procedures");
  revalidatePath("/student/forms-procedures");
  revalidatePath("/pilot/forms-procedures");
}

export type SendFormState = { ok?: string; error?: string } | undefined;

/** CFI/Admin: WhatsApp a Forms & procedures document (as the file itself)
 * to a student/pilot or any cell number, with the fixed reference note as
 * the caption (batch 82, Riaan 26 Oct 2026). */
export async function sendFormsProcedureWhatsApp(
  _prev: SendFormState,
  formData: FormData
): Promise<SendFormState> {
  await requireAdminOrCFI();

  const slotNo = Number(formData.get("slot"));
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  if (!phone) return { error: "Choose a person or enter a valid cell number, e.g. 082 123 4567." };

  const [row] = await db.select().from(formsProcedures).where(eq(formsProcedures.slot, slotNo)).limit(1);
  if (!row?.filename) return { error: "This slot has no document to send." };

  const file = await loadFormsDocument({ filename: row.filename, originalName: row.originalName, title: row.title });
  if (!file) return { error: "The document file couldn't be found on the server. Upload it again with Edit." };
  const caption = `${row.title ? `*${row.title}*\n\n` : ""}${FORMS_SEND_NOTE}\n\n${FORMS_SEND_SIGNOFF}`;
  const res = await sendWhatsAppFile(phone, file, caption);
  if (!res.ok) return { error: res.error };
  return { ok: `Sent "${row.title ?? file.fileName}" to ${name ? `${name} (${formatPhone(phone)})` : formatPhone(phone)}.` };
}
