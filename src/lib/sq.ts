import "server-only";
import { desc, eq, inArray, and, count } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings, sirslEntries, users, qsActions, occurrenceReports, audits } from "@/db/schema";
import { normalizePhone } from "@/lib/invite-message";
import { sendWhatsAppText } from "@/lib/whatsapp";

/**
 * Batch 111 (Riaan, 27 Nov 2026): Safety (SO) and Quality (QA) modules, from the
 * DTO Procedures Manual (MOP) sections 13 and 14. SO and QA are two separate
 * persons / functions (Settings). One shared flow:
 *   SO or QA raises an action / finding -> CFI completes and submits ->
 *   the SO (safety) or QA (quality) signs it off -> written to the SIRSL.
 */

export type SqUser = { id: string; name: string; role: string };

export async function getQualityPersonId(): Promise<string | null> {
  const [r] = await db.select({ id: siteSettings.qualityPersonUserId }).from(siteSettings).where(eq(siteSettings.id, "singleton")).limit(1);
  return r?.id ?? null;
}
async function getSoId(): Promise<string | null> {
  const [r] = await db.select({ id: siteSettings.safetyOfficerUserId }).from(siteSettings).where(eq(siteSettings.id, "singleton")).limit(1);
  return r?.id ?? null;
}

export type SqRoles = { cfi: boolean; so: boolean; qa: boolean; soId: string | null; qaId: string | null };

export async function getSqRoles(user: { id: string; role: string }): Promise<SqRoles> {
  const [soId, qaId] = await Promise.all([getSoId(), getQualityPersonId()]);
  return { cfi: user.role === "cfi", so: soId === user.id, qa: qaId === user.id, soId, qaId };
}

export async function nextNumber(table: "sirsl" | "occurrence" | "audit" | "safety_action" | "finding"): Promise<number> {
  if (table === "sirsl") {
    const [r] = await db.select({ n: sirslEntries.number }).from(sirslEntries).orderBy(desc(sirslEntries.number)).limit(1);
    return (r?.n ?? 0) + 1;
  }
  if (table === "occurrence") {
    const [r] = await db.select({ n: occurrenceReports.number }).from(occurrenceReports).orderBy(desc(occurrenceReports.number)).limit(1);
    return (r?.n ?? 0) + 1;
  }
  if (table === "audit") {
    const [r] = await db.select({ n: audits.number }).from(audits).orderBy(desc(audits.number)).limit(1);
    return (r?.n ?? 0) + 1;
  }
  const area = table === "finding" ? "quality" : "safety";
  const [r] = await db.select({ n: qsActions.number }).from(qsActions).where(eq(qsActions.area, area)).orderBy(desc(qsActions.number)).limit(1);
  return (r?.n ?? 0) + 1;
}

export const occRef = (n: number) => `OCC-${String(n).padStart(3, "0")}`;
export const auditRef = (n: number) => `AUD-${String(n).padStart(3, "0")}`;
export const actionRef = (area: string, n: number) => `${area === "quality" ? "FND" : "SAF"}-${String(n).padStart(3, "0")}`;
export const sirslRef = (n: number) => `LOG-${String(n).padStart(4, "0")}`;

export async function addSirsl(e: {
  area: "safety" | "quality" | "general";
  event: string;
  action?: string | null;
  completedAt?: Date | null;
  comments?: string | null;
  by?: { id: string; name: string } | null;
  refType?: string;
  refId?: string;
  date?: Date;
}): Promise<void> {
  try {
    const number = await nextNumber("sirsl");
    await db.insert(sirslEntries).values({
      number,
      entryDate: e.date ?? new Date(),
      area: e.area,
      event: e.event,
      action: e.action ?? null,
      completedAt: e.completedAt ?? null,
      comments: e.comments ?? null,
      byName: e.by?.name ?? null,
      byUserId: e.by?.id ?? null,
      refType: e.refType ?? null,
      refId: e.refId ?? null,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("[sirsl]", err);
  }
}

/** Best-effort WhatsApp to people in the Hub; never fails the real action. */
export async function notifyUsers(userIds: (string | null | undefined)[], text: string): Promise<void> {
  try {
    const ids = [...new Set(userIds.filter((x): x is string => !!x))];
    if (ids.length === 0) return;
    const rows = await db.select({ phone: users.phone, email: users.email }).from(users).where(inArray(users.id, ids));
    for (const r of rows) {
      if (r.email.toLowerCase().endsWith("@apexhub.demo")) continue;
      const n = normalizePhone(r.phone);
      if (n) await sendWhatsAppText(n, text);
    }
  } catch (err) {
    console.error("[sq notify]", err);
  }
}

export async function getCfiIds(): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "cfi"), eq(users.accountStatus, "active")));
  return rows.map((r) => r.id);
}

export function fmtDate(d: Date | null | undefined): string {
  if (!d) return "--";
  return d.toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "--";
  return d.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const ACTION_STATUS_LABEL: Record<string, string> = {
  draft: "Draft (audit not completed)",
  with_cfi: "With the CFI",
  submitted: "Waiting for sign-off",
  closed: "Closed",
};

/** Counts for the menu badges: what is waiting on this person. */
export async function countWaiting(user: { id: string; role: string }): Promise<number> {
  const roles = await getSqRoles(user);
  let total = 0;
  if (roles.cfi) {
    const [r] = await db.select({ c: count() }).from(qsActions).where(eq(qsActions.status, "with_cfi"));
    total += r?.c ?? 0;
  }
  if (roles.so) {
    const [r] = await db.select({ c: count() }).from(qsActions).where(and(eq(qsActions.status, "submitted"), eq(qsActions.area, "safety")));
    total += r?.c ?? 0;
  }
  if (roles.qa) {
    const [r] = await db.select({ c: count() }).from(qsActions).where(and(eq(qsActions.status, "submitted"), eq(qsActions.area, "quality")));
    total += r?.c ?? 0;
  }
  return total;
}
