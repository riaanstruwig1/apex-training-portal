"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { formsProcedures, formsSendTabs } from "@/db/schema";
import { requireAdminOrCFI } from "@/lib/auth/dal";
import { normalizePhone, formatPhone } from "@/lib/invite-message";
import { sendWhatsAppFile } from "@/lib/whatsapp";
import { FORMS_SEND_NOTE, FORMS_SEND_SIGNOFF, loadFormsDocument } from "@/lib/forms-send";
import { logFormsSend } from "@/lib/forms-send-log";

/** Batch 87 (Riaan, 29 Oct 2026): six "send pack" tabs on the Forms &
 * procedures page. Each tab has a name, an optional message and a chosen
 * set of the documents already loaded; one Send puts all of them on
 * WhatsApp together. */
const SEND_TAB_COUNT = 6;

export type SendTab = {
  position: number;
  name: string | null; // null = tab not set up yet
  message: string | null;
  slots: number[]; // forms_procedures.slot numbers, in send order
};

function parseSlots(raw: string | null | undefined): number[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((n) => Number.isInteger(n) && n > 0) : [];
  } catch {
    return [];
  }
}

export async function getFormsSendTabs(): Promise<SendTab[]> {
  const rows = await db.select().from(formsSendTabs);
  const byPos = new Map(rows.map((r) => [r.position, r]));
  return Array.from({ length: SEND_TAB_COUNT }, (_, i) => {
    const r = byPos.get(i + 1);
    return {
      position: i + 1,
      name: r?.name ?? null,
      message: r?.message ?? null,
      slots: parseSlots(r?.slots),
    };
  });
}

export type SaveTabState = { error: string } | { success: true } | undefined;

/** CFI/Admin: sets up or changes one tab -- name, message and the ticked
 * documents (form fields "slot", one per ticked document, in screen order). */
export async function saveFormsSendTab(_prev: SaveTabState, formData: FormData): Promise<SaveTabState> {
  await requireAdminOrCFI();
  const position = Number(formData.get("position"));
  if (!Number.isInteger(position) || position < 1 || position > SEND_TAB_COUNT) return { error: "Invalid tab." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: "Give the tab a name, e.g. General notice to student." };
  const message = String(formData.get("message") ?? "").trim().slice(0, 600) || null;
  const picked = [...new Set(formData.getAll("slot").map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))];
  if (picked.length === 0) return { error: "Tick at least one document for this tab." };

  const values = { name, message, slots: JSON.stringify(picked), updatedAt: new Date() };
  const [existing] = await db.select().from(formsSendTabs).where(eq(formsSendTabs.position, position)).limit(1);
  if (existing) await db.update(formsSendTabs).set(values).where(eq(formsSendTabs.id, existing.id));
  else await db.insert(formsSendTabs).values({ position, ...values });

  revalidatePath("/admin/forms-procedures");
  return { success: true };
}

/** CFI/Admin: empties a tab (the documents themselves are not touched). */
export async function clearFormsSendTab(position: number) {
  await requireAdminOrCFI();
  await db.delete(formsSendTabs).where(eq(formsSendTabs.position, position));
  revalidatePath("/admin/forms-procedures");
}

export type SendTabState = { ok?: string; error?: string } | undefined;

/** CFI/Admin: WhatsApps every document in a tab to one person. WhatsApp
 * carries one file per message, so the documents go out back to back; the
 * first carries the tab name, the optional message, the list of documents
 * and the standard reference note. */
export async function sendFormsSendTabWhatsApp(_prev: SendTabState, formData: FormData): Promise<SendTabState> {
  const staff = await requireAdminOrCFI();
  const position = Number(formData.get("position"));
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const who = String(formData.get("name") ?? "").trim();
  if (!phone) return { error: "Choose a person or enter a valid cell number, e.g. 082 123 4567." };

  const [tab] = await db.select().from(formsSendTabs).where(eq(formsSendTabs.position, position)).limit(1);
  if (!tab) return { error: "This tab isn't set up yet." };
  const order = parseSlots(tab.slots);
  if (order.length === 0) return { error: "This tab has no documents. Use Edit to tick some." };

  const rows = await db.select().from(formsProcedures).where(inArray(formsProcedures.slot, order));
  const bySlot = new Map(rows.map((r) => [r.slot, r]));
  const docs = order
    .map((s) => bySlot.get(s))
    .filter((r): r is NonNullable<typeof r> => !!r?.filename)
    .map((r) => ({ title: r.title ?? r.originalName ?? "Document", filename: r.filename!, originalName: r.originalName }));
  if (docs.length === 0) return { error: "None of this tab's documents are on the list any more. Use Edit to choose again." };

  const files: ((typeof docs)[number] & { file: NonNullable<Awaited<ReturnType<typeof loadFormsDocument>>> })[] = [];
  for (const d of docs) {
    const f = await loadFormsDocument({ filename: d.filename, originalName: d.originalName, title: d.title });
    if (!f) return { error: `"${d.title}" couldn't be found on the server. Upload it again, then send.` };
    files.push({ ...d, file: f });
  }

  const list = files.map((f, i) => `${i + 1}. ${f.title}`).join("\n");
  const first =
    `*${tab.name}*\n\n` +
    (tab.message ? `${tab.message}\n\n` : "") +
    `Documents (${files.length}):\n${list}\n\n${FORMS_SEND_NOTE}\n\n${FORMS_SEND_SIGNOFF}`;

  const log = (status: "sent" | "partial" | "failed", detail: string | null) =>
    logFormsSend({
      sentBy: { id: staff.id, name: staff.name ?? null },
      recipientName: who || null,
      phone,
      kind: "pack",
      title: tab.name,
      documents: files.map((f) => f.title),
      status,
      detail,
    });

  let sent = 0;
  for (let i = 0; i < files.length; i++) {
    const caption = i === 0 ? first : `*${files[i].title}* (${i + 1} of ${files.length})`;
    const res = await sendWhatsAppFile(phone, files[i].file, caption);
    if (!res.ok) {
      const error = `${sent > 0 ? `Sent ${sent} of ${files.length}, then stopped. ` : ""}${files[i].title}: ${res.error}`;
      await log(sent > 0 ? "partial" : "failed", error);
      revalidatePath("/admin/forms-procedures");
      return { error };
    }
    sent++;
    // A short gap keeps the documents in order on the phone.
    if (i < files.length - 1) await new Promise((r) => setTimeout(r, 1200));
  }
  await log("sent", null);
  revalidatePath("/admin/forms-procedures");
  const to = who ? `${who} (${formatPhone(phone)})` : formatPhone(phone);
  return { ok: `Sent "${tab.name}" -- ${files.length} document${files.length === 1 ? "" : "s"} -- to ${to}.` };
}
