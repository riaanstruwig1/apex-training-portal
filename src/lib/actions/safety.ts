"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
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
    .values({ number, title, subject, description, file, fileOriginalName, createdAt: new Date(), createdByUserId: user.id, createdByName: user.name })
    .returning({ id: safetyNotices.id });
  await logActivity(user, "safety_notice", null, `${snRef(number)}: ${title}`);

  // Send after the page has answered -- it can take a few minutes for everyone.
  after(() => sendSafetyNoticeWhatsApps(row.id).catch((e) => console.error("[safety notice]", e)));

  revalidatePath("/instructor/safety");
  revalidatePath("/safety");
  revalidatePath("/student");
  revalidatePath("/pilot");
  return { success: `${snRef(number)} saved. The WhatsApps are going out now (one every second or so) - refresh to see the count.` };
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
