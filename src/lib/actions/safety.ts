"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { safetyNotices, siteSettings, users } from "@/db/schema";
import { getCurrentUser, requireCFI } from "@/lib/auth/dal";
import { saveUpload, UploadError } from "@/lib/uploads";
import { logActivity } from "@/lib/activity-log";
import { canSendSafetyNotices, sendSafetyNoticeWhatsApps, snRef } from "@/lib/safety-notices";

export type SafetyState = { error?: string; success?: string } | undefined;

/** Batch 108 (Riaan, 27 Nov 2026): CFI / Safety Officer sends a numbered
 * safety notice -- title, subject, description, optional file -- and every
 * student and pilot gets it by WhatsApp. */
export async function createSafetyNotice(_prev: SafetyState, formData: FormData): Promise<SafetyState> {
  const user = await getCurrentUser();
  if (!user || !(await canSendSafetyNotices(user))) return { error: "Only the CFI or the Safety Officer can send safety notices." };
  const title = String(formData.get("title") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!title || !subject || !description) return { error: "Fill in the title, subject and description." };
  if (title.length > 150 || subject.length > 200) return { error: "The title or subject is too long." };
  // Batch 109: "Save only" puts it on everyone's screen without sending WhatsApps.
  const saveOnly = String(formData.get("mode") ?? "") === "save";

  const fileInput = formData.get("file");
  let file: string | null = null;
  let fileOriginalName: string | null = null;
  if (fileInput instanceof File && fileInput.size > 0) {
    try {
      file = await saveUpload("safety-notices", "safety", fileInput);
      fileOriginalName = fileInput.name.slice(0, 200);
    } catch (err) {
      if (err instanceof UploadError) return { error: err.message };
      throw err;
    }
  }

  const [last] = await db.select({ n: safetyNotices.number }).from(safetyNotices).orderBy(desc(safetyNotices.number)).limit(1);
  const number = (last?.n ?? 0) + 1;
  const [row] = await db
    .insert(safetyNotices)
    .values({
      number, title, subject, description, file, fileOriginalName,
      createdAt: new Date(), createdByUserId: user.id, createdByName: user.name,
      ...(saveOnly ? { whatsappSkipped: true, sendDone: true } : {}),
    })
    .returning({ id: safetyNotices.id });
  await logActivity(user, saveOnly ? "safety_notice_saved" : "safety_notice", null, `${snRef(number)}: ${title}`);

  // Send after the page has answered -- it can take a few minutes for everyone.
  if (!saveOnly) after(() => sendSafetyNoticeWhatsApps(row.id).catch((e) => console.error("[safety notice]", e)));

  revalidateSafety();
  if (saveOnly) return { success: `${snRef(number)} saved. It shows on everyone's dashboard; no WhatsApps were sent.` };
  return { success: `${snRef(number)} saved. The WhatsApps are going out now (one every second or so) - refresh to see the count.` };
}

function revalidateSafety() {
  revalidatePath("/instructor/safety");
  revalidatePath("/safety");
  revalidatePath("/student");
  revalidatePath("/pilot");
}

/** Batch 109: send the WhatsApps later for a notice that was saved only. */
export async function sendSavedSafetyNotice(_prev: SafetyState, formData: FormData): Promise<SafetyState> {
  const user = await getCurrentUser();
  if (!user || !(await canSendSafetyNotices(user))) return { error: "Only the CFI or the Safety Officer can send safety notices." };
  const id = String(formData.get("id") ?? "");
  const [n] = await db
    .select({ id: safetyNotices.id, number: safetyNotices.number, title: safetyNotices.title, skipped: safetyNotices.whatsappSkipped })
    .from(safetyNotices)
    .where(eq(safetyNotices.id, id))
    .limit(1);
  if (!n) return { error: "Notice not found." };
  if (!n.skipped) return { error: `${snRef(n.number)} has already been sent.` };
  // Compare-and-set so a double click can't send it twice.
  const claimed = await db
    .update(safetyNotices)
    .set({ whatsappSkipped: false, sendDone: false, sentOk: 0, sentFailed: 0 })
    .where(and(eq(safetyNotices.id, n.id), eq(safetyNotices.whatsappSkipped, true)))
    .returning({ id: safetyNotices.id });
  if (claimed.length === 0) return { error: `${snRef(n.number)} has already been sent.` };
  await logActivity(user, "safety_notice_whatsapp", null, `${snRef(n.number)}: ${n.title}`);
  after(() => sendSafetyNoticeWhatsApps(n.id).catch((e) => console.error("[safety notice]", e)));
  revalidateSafety();
  return { success: `${snRef(n.number)}: WhatsApps going out now.` };
}

export async function setSafetyOfficer(_prev: SafetyState, formData: FormData): Promise<SafetyState> {
  const cfi = await requireCFI();
  const id = String(formData.get("safetyOfficerUserId") ?? "").trim() || null;
  if (id) {
    const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
    if (!u || (u.role !== "cfi" && u.role !== "instructor")) return { error: "Choose an instructor." };
  }
  await db
    .insert(siteSettings)
    .values({ id: "singleton", safetyOfficerUserId: id })
    .onConflictDoUpdate({ target: siteSettings.id, set: { safetyOfficerUserId: id, updatedAt: new Date() } });
  await logActivity(cfi, "safety_officer", id, id ? "Set as Safety Officer" : "Safety Officer cleared");
  revalidatePath("/instructor/settings");
  return { success: "Saved." };
}
