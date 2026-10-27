"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { studentProfiles, users } from "@/db/schema";
import { requireCFI, requireStudent } from "@/lib/auth/dal";
import { formatTrainingTypes, parseTrainingTypes, type TrainingType } from "@/lib/training-types";
import { isIntroCourse } from "@/lib/intro-course";
import { HUB_URL, normalizePhone } from "@/lib/invite-message";
import { sendWhatsAppText } from "@/lib/whatsapp";

/*
 * "PG/PPG Intro training" -> Phase 2 (19 Oct 2026, Riaan): the intro student
 * clicks "Sign up for Phase 2" and picks PG, PPG and/or PPT ("student might
 * change course"); the CFI gets a WhatsApp and a red badge, then approves
 * (can change the courses first) or declines with a reason. On approval the
 * student becomes a normal student -- logbook and Phase 1 sign-offs stay --
 * and gets a WhatsApp: "Sign up for full course, Phase 2 active".
 */

export type Phase2State = { error: string } | { success: string } | undefined;

const TYPE_LABEL: Record<TrainingType, string> = { pg: "PG", ppg: "PPG", ppt: "PPT/PPC" };
const typesText = (types: TrainingType[]) => types.map((t) => TYPE_LABEL[t]).join(" + ");

function typesFrom(formData: FormData): TrainingType[] {
  return parseTrainingTypes(formData.getAll("trainingType").map(String).join(","));
}

function revalidateIntroViews(studentId: string) {
  revalidatePath("/student", "layout");
  revalidatePath("/instructor");
  revalidatePath(`/instructor/students/${studentId}`);
  revalidatePath("/admin");
}

async function sendTo(rawPhones: (string | null | undefined)[], message: string): Promise<number> {
  const seen = new Set<string>();
  let sent = 0;
  for (const raw of rawPhones) {
    const n = normalizePhone(raw);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    const r = await sendWhatsAppText(n, message).catch((e) => ({ ok: false as const, error: String(e) }));
    if (r.ok) sent++;
    else console.error("[intro-course WhatsApp]", r.error);
  }
  return sent;
}

/** Intro student: "Sign up for Phase 2" with the course(s) they want. */
export async function requestPhase2(_prev: Phase2State, formData: FormData): Promise<Phase2State> {
  const { user, profile } = await requireStudent();
  if (!profile || !isIntroCourse(profile.courseLevel)) {
    return { error: "You're already on the full course." };
  }
  const types = typesFrom(formData);
  if (types.length === 0) return { error: "Tick at least one course for Phase 2 (PG, PPG or PPT/PPC)." };

  await db
    .update(studentProfiles)
    .set({
      phase2RequestedAt: new Date(),
      phase2RequestedTypes: formatTrainingTypes(types),
      phase2DeclinedAt: null,
      phase2DeclineReason: null,
    })
    .where(eq(studentProfiles.id, profile.id));

  // Tell the CFI(s) -- best effort, never blocks the request.
  const cfis = await db.select({ phone: users.phone }).from(users).where(eq(users.role, "cfi"));
  await sendTo(
    cfis.map((c) => c.phone),
    `Apex Flight Hub: ${user.name} (PG/PPG Intro training) has signed up for Phase 2 -- ${typesText(types)}. ` +
      `Please approve it on the student's page or in the Verification queue: ${HUB_URL}/admin`
  ).catch(() => 0);

  revalidateIntroViews(user.id);
  return { success: "Sent -- your CFI will approve it and you'll get a WhatsApp." };
}

/** CFI: approve Phase 2 (optionally changing the courses first). The
 * student becomes a normal student on the chosen course(s). Also works
 * without a request, to move an intro student up directly. */
export async function approvePhase2(
  studentUserId: string,
  _prev: Phase2State,
  formData: FormData
): Promise<Phase2State> {
  const cfi = await requireCFI();
  const types = typesFrom(formData);
  if (types.length === 0) return { error: "Tick at least one course (PG, PPG or PPT/PPC)." };

  const [row] = await db
    .select({ profile: studentProfiles, name: users.name, phone: users.phone })
    .from(studentProfiles)
    .innerJoin(users, eq(users.id, studentProfiles.userId))
    .where(eq(studentProfiles.userId, studentUserId))
    .limit(1);
  if (!row) return { error: "Student not found." };
  if (!isIntroCourse(row.profile.courseLevel)) return { error: "This student is already on the full course." };

  await db
    .update(studentProfiles)
    .set({
      courseLevel: "full",
      trainingType: formatTrainingTypes(types),
      phase2ApprovedAt: new Date(),
      phase2ApprovedByUserId: cfi.id,
      phase2RequestedAt: null,
      phase2RequestedTypes: null,
      phase2DeclinedAt: null,
      phase2DeclineReason: null,
    })
    .where(eq(studentProfiles.id, row.profile.id));

  const first = row.name.trim().split(/\s+/)[0] || "there";
  const sent = await sendTo(
    [row.phone, row.profile.phone],
    `Hi ${first}, good news! Your sign-up for the full course is approved -- Phase 2 is now active (${typesText(types)}). ` +
      `Your logbook and Phase 1 stay as they are, and you can now view and download the study notes and write your exams: ${HUB_URL}/login\n\n` +
      "Regards,\nRiaan, Team Apex"
  ).catch(() => 0);

  revalidateIntroViews(studentUserId);
  return {
    success: `${row.name} is now on the full course (${typesText(types)}).${
      sent ? " WhatsApp sent." : " No WhatsApp sent (no cell number on file, or WhatsApp not connected)."
    }`,
  };
}

/** CFI: decline a Phase 2 request with a reason the student sees. */
export async function declinePhase2(
  studentUserId: string,
  _prev: Phase2State,
  formData: FormData
): Promise<Phase2State> {
  await requireCFI();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Add a short reason (the student will see it)." };
  await db
    .update(studentProfiles)
    .set({
      phase2RequestedAt: null,
      phase2RequestedTypes: null,
      phase2DeclinedAt: new Date(),
      phase2DeclineReason: reason,
    })
    .where(eq(studentProfiles.userId, studentUserId));
  revalidateIntroViews(studentUserId);
  return { success: "Declined -- the student sees your reason and can ask again." };
}
