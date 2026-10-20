"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { requireCFI } from "@/lib/auth/dal";
import { parseRecipients, sendBirthdayTest } from "@/lib/birthdays";

export type BirthdaySettingsState = { error?: string; saved?: boolean; message?: string } | undefined;

/** CFI saves who gets the daily birthday WhatsApp, and on/off (batch 78). */
export async function updateBirthdaySettings(
  _prev: BirthdaySettingsState,
  formData: FormData
): Promise<BirthdaySettingsState> {
  await requireCFI();
  const raw = ((formData.get("to") as string | null) ?? "").trim();
  const enabled = formData.get("enabled") === "on";
  const numbers = parseRecipients(raw);
  if (raw && numbers.length === 0) {
    return { error: "That doesn't look like a valid cell number. Use e.g. 072 561 4474." };
  }
  if (enabled && numbers.length === 0) {
    return { error: "Add at least one cell number, or untick the box to turn it off." };
  }
  const to = numbers
    .map((n) =>
      n.startsWith("27") && n.length === 11
        ? `0${n.slice(2, 4)} ${n.slice(4, 7)} ${n.slice(7)}`
        : `+${n}`
    )
    .join(", ");
  await db
    .insert(siteSettings)
    .values({ id: "singleton", birthdayWhatsappTo: to, birthdayWhatsappEnabled: enabled })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: { birthdayWhatsappTo: to, birthdayWhatsappEnabled: enabled, updatedAt: new Date() },
    });
  revalidatePath("/instructor/settings");
  return { saved: true };
}

/** "Send test now" -- sends the TEST birthday message straight away to the
 * saved number(s). */
export async function sendBirthdayTestNow(
  _prev: BirthdaySettingsState,
  _formData: FormData
): Promise<BirthdaySettingsState> {
  await requireCFI();
  const res = await sendBirthdayTest();
  if (res.status === "skipped") return { error: res.reason };
  if (res.recipients === 0) return { error: res.failures.join(" ") };
  return {
    message:
      `Test WhatsApp sent to ${res.recipients} number(s).` +
      (res.failures.length ? ` Failed: ${res.failures.join(" ")}` : ""),
  };
}

