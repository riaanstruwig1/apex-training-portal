import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { HUB_URL, normalizePhone } from "@/lib/invite-message";
import { sendWhatsAppText } from "@/lib/whatsapp";

export type SignupInstructor = { id: string; name: string; role: "cfi" | "instructor" };

/** Batch 97 (Riaan, 24 Nov 2026): the instructors a new student can pick at
 * sign-up -- active CFI(s) first, then instructors; demo logins left out. */
export async function getSignupInstructors(): Promise<SignupInstructor[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, role: users.role, email: users.email })
    .from(users)
    .where(and(inArray(users.role, ["cfi", "instructor"]), eq(users.accountStatus, "active")));
  return rows
    .filter((r) => !r.email.toLowerCase().endsWith("@apexhub.demo"))
    .map((r) => ({ id: r.id, name: r.name, role: r.role as "cfi" | "instructor" }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "cfi" ? -1 : 1));
}

/** WhatsApp "new student sign-up to review" to every CFI and the instructor
 * the student picked. Best effort -- the sign-up never fails over it. */
export async function notifyNewStudentSignup(
  studentId: string,
  studentName: string,
  trainingText: string,
  chosenInstructorId: string | null
): Promise<void> {
  try {
    const staff = await db
      .select({ id: users.id, name: users.name, role: users.role, phone: users.phone, email: users.email })
      .from(users)
      .where(and(inArray(users.role, ["cfi", "instructor"]), eq(users.accountStatus, "active")));
    const chosen = staff.find((s) => s.id === chosenInstructorId) ?? null;
    const targets = new Set<string>();
    for (const s of staff) {
      if (s.email.toLowerCase().endsWith("@apexhub.demo")) continue;
      if (s.role === "cfi" || s.id === chosenInstructorId) {
        const n = normalizePhone(s.phone);
        if (n) targets.add(n);
      }
    }
    const msg =
      `Apex Flight Hub: New student sign-up to review - ${studentName} (${trainingText}).` +
      (chosen ? ` Instructor chosen: ${chosen.name}.` : " No instructor chosen yet.") +
      ` Review and approve in the verification queue: ${HUB_URL}/admin/applicants/${studentId}`;
    for (const phone of targets) {
      const r = await sendWhatsAppText(phone, msg);
      if (!r.ok) console.error("[new sign-up WhatsApp]", r.error);
    }
  } catch (err) {
    console.error("[new sign-up WhatsApp]", err);
  }
}
