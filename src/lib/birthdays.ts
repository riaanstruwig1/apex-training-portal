import "server-only";
import { and, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { pilotProfiles, siteSettings, studentProfiles, users } from "@/db/schema";
import { normalizePhone, formatPhone, HUB_URL } from "@/lib/invite-message";
import { sendWhatsAppText, sendWhatsAppToChat, isWhatsAppConfigured } from "@/lib/whatsapp";

/**
 * Birthday WhatsApp (20 Oct 2026, batch 78). Riaan: "a Whatsapp that goes
 * out to Henna, 0725614474 ... birthdays, day before and on the day at 8am
 * of all pilots and students on portal".
 *
 * Every day at 08:00 South African time the Hub WhatsApps the recipient(s)
 * set under Instructor -> Settings a list of TODAY's and TOMORROW's
 * birthdays (active students and pilots with a date of birth on file).
 * Nothing is sent on a day with no birthdays in either list. The daily run
 * is triggered by the scheduler in src/instrumentation-node.ts, which calls
 * /api/cron/birthdays every few minutes; this module decides whether it is
 * time and makes sure it only sends once a day.
 */

const SINGLETON_ID = "singleton";
export const DEFAULT_BIRTHDAY_TO = "0725614474";
export const SEND_HOUR_SA = 8;

// South Africa has no daylight saving -- always UTC+2.
const SA_OFFSET_MS = 2 * 60 * 60 * 1000;

type SADate = { y: number; m: number; d: number }; // m = 1-12

/** The current date/time in South Africa as UTC fields. */
function saNow(now = new Date()): Date {
  return new Date(now.getTime() + SA_OFFSET_MS);
}

export function saDateKey(now = new Date()): string {
  return saNow(now).toISOString().slice(0, 10);
}

function addDays(base: SADate, days: number): SADate {
  const t = new Date(Date.UTC(base.y, base.m - 1, base.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function label(d: SADate): string {
  const wd = new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay();
  return `${DAY_NAMES[wd]} ${d.d} ${MONTH_NAMES[d.m - 1]}`;
}

export type BirthdayPerson = {
  userId: string;
  name: string;
  /** Nickname if set, else the first word of the name (group wishes). */
  firstName: string;
  role: "Student" | "Pilot";
  phone: string | null; // display form
  month: number; // 1-12
  day: number;
  birthYear: number;
};

export type UpcomingBirthday = BirthdayPerson & {
  date: SADate;
  dateLabel: string;
  turns: number;
  inDays: number;
};

/** Active students and pilots who have a date of birth on file. Archived
 * student/pilot profiles are left out. Separate queries rather than one
 * join -- see the same-named-column trap in this sqlite-proxy setup. */
export async function getBirthdayPeople(): Promise<BirthdayPerson[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      nickname: users.nickname,
      role: users.role,
      dob: users.dob,
      phone: users.phone,
    })
    .from(users)
    .where(
      and(
        inArray(users.role, ["student", "pilot"]),
        eq(users.accountStatus, "active"),
        isNotNull(users.dob)
      )
    );
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [archivedStudents, archivedPilots] = await Promise.all([
    db
      .select({ userId: studentProfiles.userId })
      .from(studentProfiles)
      .where(and(inArray(studentProfiles.userId, ids), eq(studentProfiles.status, "archived"))),
    db
      .select({ userId: pilotProfiles.userId })
      .from(pilotProfiles)
      .where(and(inArray(pilotProfiles.userId, ids), eq(pilotProfiles.status, "archived"))),
  ]);
  const archived = new Set([...archivedStudents, ...archivedPilots].map((r) => r.userId));

  const people: BirthdayPerson[] = [];
  for (const r of rows) {
    if (archived.has(r.id) || !r.dob) continue;
    // DOB is stored as UTC midnight of the date picked (new Date("YYYY-MM-DD")).
    // Add 12h before reading so a value saved at local midnight still lands on
    // the right calendar day.
    const dob = new Date(r.dob.getTime() + 12 * 60 * 60 * 1000);
    const norm = normalizePhone(r.phone);
    people.push({
      userId: r.id,
      name: r.name,
      firstName: (r.nickname?.trim() || r.name.trim().split(/\s+/)[0] || r.name).trim(),
      role: r.role === "pilot" ? "Pilot" : "Student",
      phone: norm ? formatPhone(norm) : r.phone || null,
      month: dob.getUTCMonth() + 1,
      day: dob.getUTCDate(),
      birthYear: dob.getUTCFullYear(),
    });
  }
  return people;
}

function birthdayIn(year: number, p: BirthdayPerson): SADate {
  // 29 Feb birthdays are celebrated on 28 Feb in non-leap years.
  if (p.month === 2 && p.day === 29 && !isLeap(year)) return { y: year, m: 2, d: 28 };
  return { y: year, m: p.month, d: p.day };
}

/** Everyone's next birthday from today (SA date), soonest first, within
 * `days` days (0 = today). */
export async function getUpcomingBirthdays(days: number, now = new Date()): Promise<UpcomingBirthday[]> {
  const t = saNow(now);
  const today: SADate = { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  const todayMs = Date.UTC(today.y, today.m - 1, today.d);
  const people = await getBirthdayPeople();
  const out: UpcomingBirthday[] = [];
  for (const p of people) {
    let date = birthdayIn(today.y, p);
    let ms = Date.UTC(date.y, date.m - 1, date.d);
    if (ms < todayMs) {
      date = birthdayIn(today.y + 1, p);
      ms = Date.UTC(date.y, date.m - 1, date.d);
    }
    const inDays = Math.round((ms - todayMs) / 86400000);
    if (inDays > days) continue;
    out.push({ ...p, date, dateLabel: label(date), turns: date.y - p.birthYear, inDays });
  }
  out.sort((a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name));
  return out;
}

function line(b: UpcomingBirthday): string {
  const turns = b.turns > 0 && b.turns < 120 ? ` turns ${b.turns}` : "";
  const phone = b.phone ? ` - ${b.phone}` : "";
  return `• ${b.name} (${b.role})${turns}${phone}`;
}

export function buildBirthdayMessage(
  upcoming: UpcomingBirthday[],
  opts: { test?: boolean; now?: Date } = {}
): string {
  const t = saNow(opts.now);
  const today: SADate = { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  const tomorrow = addDays(today, 1);
  const todays = upcoming.filter((b) => b.inDays === 0);
  const tomorrows = upcoming.filter((b) => b.inDays === 1);

  const parts: string[] = [];
  if (opts.test) {
    parts.push(
      "*TEST message* from the Apex Flight Hub.",
      `From now on you'll get this every day at 0${SEND_HOUR_SA}:00 when a student or pilot has a birthday today or tomorrow.`,
      ""
    );
  }
  parts.push("🎂 *Apex Flight Hub - Birthdays*", "");
  parts.push(`*Today, ${label(today)}:*`);
  parts.push(...(todays.length ? todays.map(line) : ["No birthdays"]));
  parts.push("");
  parts.push(`*Tomorrow, ${label(tomorrow)}:*`);
  parts.push(...(tomorrows.length ? tomorrows.map(line) : ["No birthdays"]));

  if (opts.test) {
    const next = upcoming.filter((b) => b.inDays > 1).slice(0, 3);
    parts.push("");
    parts.push("*Coming up next:*");
    parts.push(...(next.length ? next.map((b) => `${line(b)} on ${b.dateLabel}`) : ["None on file yet"]));
  }
  parts.push("", HUB_URL);
  return parts.join("\n");
}

export type BirthdaySettings = {
  to: string;
  enabled: boolean;
  lastSentOn: string | null;
};

export async function getBirthdaySettings(): Promise<BirthdaySettings> {
  const [row] = await db
    .select({
      to: siteSettings.birthdayWhatsappTo,
      enabled: siteSettings.birthdayWhatsappEnabled,
      lastSentOn: siteSettings.birthdayLastSentOn,
    })
    .from(siteSettings)
    .where(eq(siteSettings.id, SINGLETON_ID))
    .limit(1);
  return {
    to: row?.to ?? DEFAULT_BIRTHDAY_TO,
    enabled: row?.enabled ?? true,
    lastSentOn: row?.lastSentOn ?? null,
  };
}

/** "072 561 4474, 082..." -> list of normalized numbers (bad ones dropped). */
export function parseRecipients(raw: string): string[] {
  const out: string[] = [];
  for (const part of raw.split(/[,;\n]+/)) {
    const n = normalizePhone(part.trim());
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

export type BirthdayRunResult =
  | { status: "skipped"; reason: string }
  | { status: "sent"; recipients: number; failures: string[]; birthdays: number };

async function sendToAll(recipients: string[], message: string): Promise<string[]> {
  const failures: string[] = [];
  for (const phone of recipients) {
    const res = await sendWhatsAppText(phone, message);
    if (!res.ok) failures.push(`${formatPhone(phone)}: ${res.error}`);
  }
  return failures;
}

/** Sends the TEST message right now, whatever the time or day. */
export async function sendBirthdayTest(): Promise<BirthdayRunResult> {
  const settings = await getBirthdaySettings();
  const recipients = parseRecipients(settings.to);
  if (recipients.length === 0) return { status: "skipped", reason: "No valid recipient number saved." };
  if (!isWhatsAppConfigured()) {
    return { status: "skipped", reason: "WhatsApp isn't set up on this server (Green-API variables missing)." };
  }
  const upcoming = await getUpcomingBirthdays(366);
  const message = buildBirthdayMessage(upcoming, { test: true });
  const failures = await sendToAll(recipients, message);
  return {
    status: "sent",
    recipients: recipients.length - failures.length,
    failures,
    birthdays: upcoming.filter((b) => b.inDays <= 1).length,
  };
}

/** The daily run. Safe to call as often as you like: it only sends once
 * per SA calendar day, at/after 08:00 SA time. */
export async function runDailyBirthdayCheck(now = new Date()): Promise<BirthdayRunResult> {
  const settings = await getBirthdaySettings();
  if (!settings.enabled) return { status: "skipped", reason: "Turned off in Settings." };
  if (saNow(now).getUTCHours() < SEND_HOUR_SA) return { status: "skipped", reason: "Before 08:00." };
  const today = saDateKey(now);
  if (settings.lastSentOn === today) return { status: "skipped", reason: "Already done today." };
  if (!isWhatsAppConfigured()) return { status: "skipped", reason: "WhatsApp not configured." };

  // Claim today first so two overlapping runs can't both send.
  await db.insert(siteSettings).values({ id: SINGLETON_ID }).onConflictDoNothing();
  const claimed = await db
    .update(siteSettings)
    .set({ birthdayLastSentOn: today })
    .where(
      and(
        eq(siteSettings.id, SINGLETON_ID),
        or(isNull(siteSettings.birthdayLastSentOn), ne(siteSettings.birthdayLastSentOn, today))
      )
    )
    .returning({ id: siteSettings.id });
  if (claimed.length === 0) return { status: "skipped", reason: "Already done today." };

  const upcoming = await getUpcomingBirthdays(1, now);
  if (upcoming.length === 0) return { status: "skipped", reason: "No birthdays today or tomorrow." };

  const recipients = parseRecipients(settings.to);
  if (recipients.length === 0) return { status: "skipped", reason: "No valid recipient number saved." };
  const failures = await sendToAll(recipients, buildBirthdayMessage(upcoming, { now }));
  if (failures.length === recipients.length) {
    // Nothing went out -- release the day so the next run tries again.
    await db
      .update(siteSettings)
      .set({ birthdayLastSentOn: null })
      .where(eq(siteSettings.id, SINGLETON_ID));
    console.error("[birthdays] all sends failed:", failures.join("; "));
  }
  return { status: "sent", recipients: recipients.length - failures.length, failures, birthdays: upcoming.length };
}

// ---------------------------------------------------------------------------
// Batch 82 (Riaan, 22 Oct 2026): "send out the birthday wish for the DAY on
// the WhatsApp group ... vary the time between 8am and 10am ... vary the text
// between three or four types". Only on the day itself (Henna's 08:00 list
// for today + tomorrow is separate and unchanged). One message per person.
// ---------------------------------------------------------------------------

export const DEFAULT_GROUP_WISHES = [
  "Happy birthday, {name}! Have a spoilt day and a blessed year ahead. From all of us at Team Apex.",
  "Happy birthday {name}! Wishing you blue skies, smooth air and a fantastic year ahead. - The Apex Team",
  "Today we celebrate {name}! Happy birthday from the whole Apex Team. Enjoy your day, and many happy landings this year.",
  "Happy birthday, {name}! May your day be spoilt rotten and your year full of great flying. Best wishes from the Apex Team.",
];

/** Minutes between two people's wishes when several share a birthday. */
const GROUP_GAP_MIN = 4;
/** Don't post wishes after this hour (e.g. server down all morning). */
const GROUP_LATEST_HOUR = 20;

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Today's start time for the group wishes, minutes after midnight SA:
 * a random-looking but fixed (per date) time from 08:00 to 09:59. */
export function groupWishStartMinute(dateKey: string): number {
  return 8 * 60 + (hash(`${dateKey}|apex-wish`) % 120);
}

export function fmtMinute(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function pickWish(templates: string[], dateKey: string, userId: string, firstName: string): string {
  const list = templates.filter((t) => t.trim());
  const pool = list.length ? list : DEFAULT_GROUP_WISHES;
  return pool[hash(`${dateKey}|${userId}`) % pool.length].replaceAll("{name}", firstName);
}

export type GroupWishSettings = {
  chatId: string | null;
  groupName: string | null;
  enabled: boolean;
  templates: string[];
  sent: string | null;
};

export async function getGroupWishSettings(): Promise<GroupWishSettings> {
  const [row] = await db
    .select({
      chatId: siteSettings.birthdayGroupChatId,
      groupName: siteSettings.birthdayGroupName,
      enabled: siteSettings.birthdayGroupEnabled,
      templates: siteSettings.birthdayGroupTemplates,
      sent: siteSettings.birthdayGroupSent,
    })
    .from(siteSettings)
    .where(eq(siteSettings.id, SINGLETON_ID))
    .limit(1);
  let templates = DEFAULT_GROUP_WISHES;
  try {
    const parsed = row?.templates ? JSON.parse(row.templates) : null;
    if (Array.isArray(parsed) && parsed.some((t) => typeof t === "string" && t.trim())) templates = parsed;
  } catch {
    /* keep defaults */
  }
  return {
    chatId: row?.chatId ?? null,
    groupName: row?.groupName ?? null,
    enabled: row?.enabled ?? false,
    templates,
    sent: row?.sent ?? null,
  };
}

/** Today's planned wishes: who, when (SA time), which text, already sent? */
export async function getTodaysGroupWishPlan(now = new Date()) {
  const settings = await getGroupWishSettings();
  const dateKey = saDateKey(now);
  const start = groupWishStartMinute(dateKey);
  const sentIds = settings.sent?.startsWith(`${dateKey}|`) ? settings.sent.slice(dateKey.length + 1).split(",").filter(Boolean) : [];
  const todays = (await getUpcomingBirthdays(0, now)).filter((b) => b.inDays === 0);
  return {
    settings,
    dateKey,
    start,
    items: todays.map((b, i) => ({
      person: b,
      minute: start + i * GROUP_GAP_MIN,
      text: pickWish(settings.templates, dateKey, b.userId, b.firstName),
      sent: sentIds.includes(b.userId),
    })),
    sentIds,
  };
}

/** Called by the 5-minute scheduler. Posts each due wish once. */
export async function runGroupBirthdayWishes(now = new Date()): Promise<{ sent: number; skipped?: string; failures: string[] }> {
  const plan = await getTodaysGroupWishPlan(now);
  const { settings, dateKey } = plan;
  if (!settings.enabled) return { sent: 0, skipped: "Turned off.", failures: [] };
  if (!settings.chatId) return { sent: 0, skipped: "No group chosen.", failures: [] };
  if (!isWhatsAppConfigured()) return { sent: 0, skipped: "WhatsApp not configured.", failures: [] };
  const t = saNow(now);
  const minuteNow = t.getUTCHours() * 60 + t.getUTCMinutes();
  if (t.getUTCHours() >= GROUP_LATEST_HOUR) return { sent: 0, skipped: "Too late in the day.", failures: [] };

  const failures: string[] = [];
  let sent = 0;
  let sentIds = [...plan.sentIds];
  let stored = settings.sent;
  for (const item of plan.items) {
    if (item.sent || sentIds.includes(item.person.userId) || item.minute > minuteNow) continue;
    // Claim this person first (compare-and-set on the stored list) so two
    // overlapping runs can't both post the same wish.
    const next = `${dateKey}|${[...sentIds, item.person.userId].join(",")}`;
    await db.insert(siteSettings).values({ id: SINGLETON_ID }).onConflictDoNothing();
    const claimed = await db
      .update(siteSettings)
      .set({ birthdayGroupSent: next })
      .where(
        and(
          eq(siteSettings.id, SINGLETON_ID),
          stored === null ? isNull(siteSettings.birthdayGroupSent) : eq(siteSettings.birthdayGroupSent, stored)
        )
      )
      .returning({ id: siteSettings.id });
    if (claimed.length === 0) break; // another run got there first
    stored = next;
    sentIds = [...sentIds, item.person.userId];
    const res = await sendWhatsAppToChat(settings.chatId, item.text);
    if (res.ok) {
      sent++;
    } else {
      failures.push(`${item.person.name}: ${res.error}`);
      // Release this person so a later run tries again.
      sentIds = sentIds.filter((id) => id !== item.person.userId);
      const back = `${dateKey}|${sentIds.join(",")}`;
      await db.update(siteSettings).set({ birthdayGroupSent: back }).where(eq(siteSettings.id, SINGLETON_ID));
      stored = back;
      break;
    }
  }
  return { sent, failures };
}
