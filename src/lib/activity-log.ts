import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, users } from "@/db/schema";

/**
 * Batch 97 (Riaan, 24 Nov 2026): instructors now review and sign off
 * students like the CFI -- "but keep a LOG of changes and who log in and who
 * did what and who sign off". Every call is best effort: logging never makes
 * the real action fail.
 */
export const ACTIVITY_LABELS: Record<string, string> = {
  login: "Logged in",
  signup: "New sign-up",
  approve_signup: "Approved sign-up",
  reject_signup: "Rejected sign-up",
  edit_training_type: "Changed training type",
  edit_profile: "Edited profile",
  edit_pilot_details: "Edited pilot details",
  edit_student_details: "Edited student details",
  edit_signup_date: "Changed sign-up date",
  reset_password: "Reset password",
  exercise: "Exercise status",
  logbook_countersign: "Countersigned logbook",
  exam_marked: "Marked exam",
  paper_exam: "Uploaded paper exam",
  signoff: "Signed off student (Solo wings)",
  renewal_signoff: "Renewal skill test signed off",
  regenerate_pack: "Regenerated submission pack",
  caa_licence: "Added SACAA licence",
  pop_upload: "Uploaded proof of payment",
  endorsement: "Student endorsement",
  safety_notice: "Sent safety notice",
  safety_notice_saved: "Saved safety notice (no WhatsApp)",
  safety_notice_whatsapp: "Sent safety notice WhatsApps",
  safety_officer: "Safety Officer changed",
  phase2_approve: "Approved Phase 2",
  phase2_decline: "Declined Phase 2",
  archive_student: "Archived student",
  restore_student: "Restored student",
  delete_student: "Deleted student",
};

type Actor = { id: string; name?: string | null; role?: string | null } | null | undefined;

export async function logActivity(
  actor: Actor,
  action: keyof typeof ACTIVITY_LABELS | string,
  targetUserId?: string | null,
  details?: string | null
): Promise<void> {
  try {
    let actorName = actor?.name ?? null;
    let actorRole = actor?.role ?? null;
    const ids = [actor?.id, targetUserId].filter((x): x is string => !!x);
    const people = ids.length
      ? await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(inArray(users.id, ids))
      : [];
    const a = people.find((p) => p.id === actor?.id);
    if (a) {
      actorName = actorName ?? a.name;
      actorRole = actorRole ?? a.role;
    }
    const t = people.find((p) => p.id === targetUserId);
    await db.insert(activityLog).values({
      at: new Date(),
      actorId: a ? a.id : null,
      actorName,
      actorRole,
      action: String(action),
      targetUserId: t ? t.id : null,
      targetName: t?.name ?? null,
      details: details ? String(details).slice(0, 500) : null,
    });
  } catch (err) {
    console.error("[activity log]", err);
  }
}

export type ActivityRow = typeof activityLog.$inferSelect & { label: string };

export async function getActivityLog(opts: { limit?: number; actorId?: string; action?: string } = {}): Promise<ActivityRow[]> {
  const conds = [];
  if (opts.actorId) conds.push(eq(activityLog.actorId, opts.actorId));
  if (opts.action) conds.push(eq(activityLog.action, opts.action));
  const rows = await db
    .select()
    .from(activityLog)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(activityLog.at))
    .limit(opts.limit ?? 500);
  return rows.map((r) => ({ ...r, label: ACTIVITY_LABELS[r.action] ?? r.action }));
}

export const ROLE_LABELS: Record<string, string> = {
  cfi: "CFI",
  instructor: "Instructor",
  admin: "Admin",
  student: "Student",
  pilot: "Pilot",
};

/** "24 Nov 2026, 14:05" in South African time. */
export function activityTime(d: Date): string {
  return d.toLocaleString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Everyone who appears as "who" in the log, for the filter drop-down. */
export async function getActivityActors(): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .selectDistinct({ id: activityLog.actorId, name: activityLog.actorName })
    .from(activityLog);
  const seen = new Map<string, string>();
  for (const r of rows) if (r.id && !seen.has(r.id)) seen.set(r.id, r.name ?? "?");
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
