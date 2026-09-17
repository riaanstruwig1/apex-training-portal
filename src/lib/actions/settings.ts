"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { requireCFI } from "@/lib/auth/dal";

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
