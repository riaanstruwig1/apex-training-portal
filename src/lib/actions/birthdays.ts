"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { requireCFI } from "@/lib/auth/dal";
import {
  DEFAULT_GROUP_WISHES,
  getBirthdaySettings,
  parseRecipients,
  pickWish,
  saDateKey,
  sendBirthdayTest,
} from "@/lib/birthdays";
import { listWhatsAppGroups, sendWhatsAppText, type WhatsAppGroup } from "@/lib/whatsapp";

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


// ---- Batch 82: birthday wishes in the Team Apex WhatsApp group ----

export type GroupListState = { groups?: WhatsAppGroup[]; error?: string } | undefined;

/** Lists the WhatsApp groups the Hub's number is in, to pick Team Apex. */
export async function loadWhatsAppGroups(_prev: GroupListState, _fd: FormData): Promise<GroupListState> {
  await requireCFI();
  const res = await listWhatsAppGroups();
  if (!res.ok) return { error: res.error };
  if (res.groups.length === 0) {
    return {
      error:
        "No groups found. Make sure the Hub's WhatsApp number is a member of the Team Apex group, then try again in a few minutes.",
    };
  }
  return { groups: res.groups };
}

/** CFI saves the group, on/off and the wishes. */
export async function updateGroupWishSettings(
  _prev: BirthdaySettingsState,
  formData: FormData
): Promise<BirthdaySettingsState> {
  await requireCFI();
  const groupRaw = String(formData.get("group") ?? "").trim();
  // "id|name" from the dropdown, or a pasted id ending @g.us
  const [chatIdRaw, ...nameParts] = groupRaw.split("|");
  const chatId = chatIdRaw?.trim() || null;
  const groupName = nameParts.join("|").trim() || null;
  if (chatId && !/@g\.us$/.test(chatId)) return { error: "That isn't a WhatsApp group id (it should end in @g.us)." };
  const enabled = formData.get("enabled") === "on";
  if (enabled && !chatId) return { error: "Choose the Team Apex group first, or untick the box." };
  const wishes = [1, 2, 3, 4].map((i) => String(formData.get(`wish${i}`) ?? "").trim()).filter(Boolean);
  if (wishes.length === 0) return { error: "Keep at least one birthday wish." };
  if (wishes.some((w) => !w.includes("{name}"))) return { error: "Every wish needs {name} where the person's name goes." };
  if (wishes.some((w) => w.length > 1000)) return { error: "A wish is too long for WhatsApp." };
  const templates = JSON.stringify(wishes);
  const set = {
    birthdayGroupChatId: chatId,
    birthdayGroupName: chatId ? groupName : null,
    birthdayGroupEnabled: enabled,
    birthdayGroupTemplates: wishes.join("\n") === DEFAULT_GROUP_WISHES.join("\n") ? null : templates,
  };
  await db
    .insert(siteSettings)
    .values({ id: "singleton", ...set })
    .onConflictDoUpdate({ target: siteSettings.id, set: { ...set, updatedAt: new Date() } });
  revalidatePath("/instructor/settings");
  return { saved: true };
}

/** Sends one sample group wish to the birthday-list number(s) (Henna), not
 * to the group, so the CFI can see how it looks. */
export async function sendGroupWishTest(
  _prev: BirthdaySettingsState,
  formData: FormData
): Promise<BirthdaySettingsState> {
  await requireCFI();
  const settings = await getBirthdaySettings();
  const to = parseRecipients(settings.to);
  if (to.length === 0) return { error: "Save a number under 'Send to' above first." };
  const wishes = [1, 2, 3, 4].map((i) => String(formData.get(`wish${i}`) ?? "").trim()).filter(Boolean);
  const text = pickWish(wishes, saDateKey(), String(Date.now()), "Tom");
  const res = await sendWhatsAppText(to[0], `TEST (this is how a birthday wish looks in the group):\n\n${text}`);
  return res.ok ? { message: `Sample wish sent to ${settings.to.split(",")[0].trim()}.` } : { error: res.error };
}
