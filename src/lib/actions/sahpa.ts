"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { studentProfiles } from "@/db/schema";
import { requireStudent } from "@/lib/auth/dal";

export type SahpaGateState = { error: string; success?: never } | { error?: never; success: true } | undefined;

/** A student must have a SAHPA number loaded before using the rest of the Hub. */
export async function saveOwnSahpaNumber(_prev: SahpaGateState, formData: FormData): Promise<SahpaGateState> {
  const { user } = await requireStudent();
  const number = String(formData.get("sahpaNumber") ?? "").trim();
  if (!number) return { error: "Enter your SAHPA membership number to continue." };
  const expiry = String(formData.get("sahpaExpiryDate") ?? "").trim();
  const set: { sahpaNumber: string; sahpaExpiryDate?: Date } = { sahpaNumber: number };
  if (expiry) {
    const d = new Date(expiry);
    if (!isNaN(d.getTime())) set.sahpaExpiryDate = d;
  }
  await db.update(studentProfiles).set(set).where(eq(studentProfiles.userId, user.id));
  revalidatePath("/student", "layout");
  revalidatePath("/instructor");
  return { success: true };
}
