"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { requireCFI } from "@/lib/auth/dal";
import { saveFormsProcedureFile, deleteFormsProcedureFile } from "@/lib/forms-procedures-uploads";

const SINGLETON_ID = "singleton";

export type SettingsState = { error?: string; saved?: boolean } | undefined;

/** Instructor updates the standard radio call script every student sees
 * (Dashboard + Logbook footer). One script for the whole school -- not
 * per-student. */
export async function updateRadioCallScript(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  await requireCFI();

  const radioCallScript = (formData.get("radioCallScript") as string | null)?.trim() || null;

  await db
    .insert(siteSettings)
    .values({ id: SINGLETON_ID, radioCallScript })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: { radioCallScript, updatedAt: new Date() },
    });

  revalidatePath("/instructor/settings");
  revalidatePath("/student");
  revalidatePath("/student/exercises");
  revalidatePath("/student/logbook");

  return { saved: true };
}

function normalizeUrl(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

/** CFI updates the student-portal notification bar (28 Sep 2026): a
 * message, an optional renameable button that links to either an uploaded
 * doc or a plain hyperlink (whichever was set most recently -- the two
 * are mutually exclusive, since one button can only go one place), and a
 * show/hide toggle. Reuses the Forms & Procedures upload folder/route for
 * the optional doc -- same kind of thing (a CFI-uploaded file shown to
 * every student), no need for a second storage location. */
export async function updateStudentNotice(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  await requireCFI();

  const [current] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, SINGLETON_ID))
    .limit(1);

  const noticeMessage = (formData.get("noticeMessage") as string | null)?.trim() || null;
  const noticeButtonLabel = (formData.get("noticeButtonLabel") as string | null)?.trim() || null;
  const linkUrlInput = (formData.get("noticeLinkUrl") as string | null)?.trim() || "";
  const removeFile = formData.get("removeFile") === "on";
  const noticeVisible = formData.get("noticeVisible") === "on";
  const file = formData.get("noticeFile");

  // File and link are mutually exclusive -- whichever the CFI just set
  // wins, and replaces whatever was there before (including deleting an
  // old uploaded file so it doesn't linger on disk unreferenced).
  let attachmentUpdate: Partial<typeof siteSettings.$inferInsert> = {};
  if (file instanceof File && file.size > 0) {
    if (current?.noticeFile) await deleteFormsProcedureFile(current.noticeFile);
    try {
      const saved = await saveFormsProcedureFile(file);
      attachmentUpdate = {
        noticeFile: saved.filename,
        noticeFileOriginalName: saved.originalName,
        noticeLinkUrl: null,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Upload failed." };
    }
  } else if (removeFile) {
    if (current?.noticeFile) await deleteFormsProcedureFile(current.noticeFile);
    attachmentUpdate = { noticeFile: null, noticeFileOriginalName: null };
  } else if (linkUrlInput) {
    if (current?.noticeFile) await deleteFormsProcedureFile(current.noticeFile);
    attachmentUpdate = {
      noticeLinkUrl: normalizeUrl(linkUrlInput),
      noticeFile: null,
      noticeFileOriginalName: null,
    };
  }
  // Otherwise: link field left blank, no new file, not removing -- leave
  // whatever attachment (file or link) was already there untouched.

  await db
    .insert(siteSettings)
    .values({
      id: SINGLETON_ID,
      noticeMessage,
      noticeButtonLabel,
      noticeVisible,
      ...attachmentUpdate,
    })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: {
        noticeMessage,
        noticeButtonLabel,
        noticeVisible,
        ...attachmentUpdate,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/instructor/settings");
  revalidatePath("/student");
  revalidatePath("/student/exercises");
  revalidatePath("/student/logbook");
  revalidatePath("/student/forms-procedures");
  revalidatePath("/student/profile");
  revalidatePath("/student/profile/view");
  revalidatePath("/student/portfolio/print");

  return { saved: true };
}
