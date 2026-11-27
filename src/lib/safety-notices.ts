import "server-only";
import { desc, eq, inArray, and } from "drizzle-orm";
import { db } from "@/db";
import { safetyNotices, siteSettings, studentProfiles, users } from "@/db/schema";
import { HUB_URL, normalizePhone } from "@/lib/invite-message";
import { sendWhatsAppText } from "@/lib/whatsapp";

export type SafetyNotice = typeof safetyNotices.$inferSelect;

export function homeFor(role: string) {
  return role === "student" ? "/student" : role === "pilot" ? "/pilot" : role === "admin" ? "/admin" : "/instructor/dashboard";
}

export const snRef = (n: number) => `SN-${String(n).padStart(3, "0")}`;

export function fmtSaDate(d: Date): string {
  return d.toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg", day: "2-digit", month: "short", year: "numeric" });
}

export async function getSafetyNotices(): Promise<SafetyNotice[]> {
  return db.select().from(safetyNotices).orderBy(desc(safetyNotices.number));
}

export async function getLatestSafetyNotice(): Promise<SafetyNotice | null> {
  const [row] = await db.select().from(safetyNotices).orderBy(desc(safetyNotices.number)).limit(1);
  return row ?? null;
}

export async function getSafetyNotice(number: number): Promise<SafetyNotice | null> {
  const [row] = await db.select().from(safetyNotices).where(eq(safetyNotices.number, number)).limit(1);
  return row ?? null;
}

export async function getSafetyOfficerId(): Promise<string | null> {
  const [row] = await db.select({ id: siteSettings.safetyOfficerUserId }).from(siteSettings).where(eq(siteSettings.id, "singleton")).limit(1);
  return row?.id ?? null;
}

/** The CFI and the Safety Officer (Settings) may send safety notices. */
export async function canSendSafetyNotices(user: { id: string; role: string }): Promise<boolean> {
  if (user.role === "cfi") return true;
  return (await getSafetyOfficerId()) === user.id;
}

/** Everyone who gets the WhatsApp: every active student, pilot, instructor
 * and CFI with a cell number (demo logins left out), one message per number. */
async function recipientPhones(): Promise<string[]> {
  const people = await db
    .select({ id: users.id, phone: users.phone, email: users.email })
    .from(users)
    .where(and(inArray(users.role, ["student", "pilot", "instructor", "cfi"]), eq(users.accountStatus, "active")));
  const sp = await db.select({ userId: studentProfiles.userId, phone: studentProfiles.phone }).from(studentProfiles);
  const spPhone = new Map(sp.map((p) => [p.userId, p.phone]));
  const out = new Set<string>();
  for (const p of people) {
    if (p.email.toLowerCase().endsWith("@apexhub.demo")) continue;
    const n = normalizePhone(p.phone) ?? normalizePhone(spPhone.get(p.id));
    if (n) out.add(n);
  }
  return [...out];
}

export function safetyMessage(n: SafetyNotice): string {
  const desc = n.description.length > 700 ? n.description.slice(0, 700) + "..." : n.description;
  return (
    `⚠️ *APEX SAFETY NOTICE ${snRef(n.number)}* - ${fmtSaDate(n.createdAt)}\n\n` +
    `*${n.title}*\nSubject: ${n.subject}\n\n${desc}\n\n` +
    (n.file ? "A document is attached to this notice in the Hub.\n" : "") +
    `Read it in the Apex Flight Hub: ${HUB_URL}/safety/${n.number}\n- Team Apex`
  );
}

/** Sends the notice to everyone, one by one (a short pause between sends so
 * WhatsApp doesn't see a burst), and records how many went out. */
export async function sendSafetyNoticeWhatsApps(noticeId: string): Promise<void> {
  const [n] = await db.select().from(safetyNotices).where(eq(safetyNotices.id, noticeId)).limit(1);
  if (!n) return;
  const phones = await recipientPhones();
  await db.update(safetyNotices).set({ recipients: phones.length }).where(eq(safetyNotices.id, noticeId));
  const msg = safetyMessage(n);
  let ok = 0;
  let failed = 0;
  for (const phone of phones) {
    const r = await sendWhatsAppText(phone, msg).catch((e) => ({ ok: false as const, error: String(e) }));
    if (r.ok) ok++;
    else {
      failed++;
      console.error("[safety notice WhatsApp]", phone.slice(0, 5) + "...", r.error);
    }
    if ((ok + failed) % 10 === 0) await db.update(safetyNotices).set({ sentOk: ok, sentFailed: failed }).where(eq(safetyNotices.id, noticeId));
    await new Promise((res) => setTimeout(res, 1200));
  }
  await db.update(safetyNotices).set({ sentOk: ok, sentFailed: failed, sendDone: true }).where(eq(safetyNotices.id, noticeId));
}
