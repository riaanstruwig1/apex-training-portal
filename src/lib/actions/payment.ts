"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { studentProfiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { saveUpload, UploadError } from "@/lib/uploads";

/**
 * Proof-of-Payment upload + "request an invoice" for students (chat
 * request, 16 Sep 2026): "a place on the student application to Upload for
 * safekeeping his POP paymenet of student training. and if not yet paid the
 * bank details. or request for INV". Per Riaan's own follow-up answers:
 * no bank details are stored/shown in-app -- an unpaid student instead sees
 * a "contact the office" note -- and "request an invoice" is a simple
 * one-click flag for the office to see, not a generated document or a
 * Shopify integration (that sync is still pending, see the "Add a student"
 * form's own note).
 */
export type PopFormState =
  | { error: string; success?: never }
  | { error?: never; success: true }
  | undefined;

export async function uploadOwnPop(
  _prevState: PopFormState,
  formData: FormData
): Promise<PopFormState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { error: "Not available for this account type." };
  }

  const fileInput = formData.get("popFile");
  if (!(fileInput instanceof File) || fileInput.size === 0) {
    return { error: "Choose a file to upload." };
  }

  let filename: string | null;
  try {
    filename = await saveUpload(user.id, "pop", fileInput);
  } catch (err) {
    if (err instanceof UploadError) return { error: err.message };
    throw err;
  }
  if (!filename) return { error: "Choose a file to upload." };

  await db
    .update(studentProfiles)
    .set({
      popFile: filename,
      popUploadedAt: new Date(),
      // A fresh POP supersedes an earlier invoice request -- they've now
      // paid (or at least have something on file), so the "awaiting
      // invoice" flag no longer applies.
      invoiceRequestedAt: null,
    })
    .where(eq(studentProfiles.userId, user.id));

  revalidatePath("/student");
  revalidatePath("/student/profile");
  revalidatePath(`/admin/applicants/${user.id}`);
  return { success: true };
}

export async function requestOwnInvoice(): Promise<PopFormState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { error: "Not available for this account type." };
  }

  await db
    .update(studentProfiles)
    .set({ invoiceRequestedAt: new Date() })
    .where(eq(studentProfiles.userId, user.id));

  revalidatePath("/student");
  revalidatePath("/student/profile");
  revalidatePath(`/admin/applicants/${user.id}`);
  return { success: true };
}
