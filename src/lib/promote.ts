import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { users, pilotProfiles } from "@/db/schema";
import { createSession } from "@/lib/auth/session";

/** A signed-off student stays on the Student list until his CAA licence is
 * submitted; only then does he move to the Pilots list (Riaan, 15 Oct 2026).
 * Call this after a licence upload. Returns true when the account moved. */
export async function promoteIfLicenceSubmitted(userId: string, refreshOwnSession = false): Promise<boolean> {
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u || u.role !== "student") return false;
  const [pp] = await db
    .select({ id: pilotProfiles.id })
    .from(pilotProfiles)
    .where(and(eq(pilotProfiles.userId, userId), isNotNull(pilotProfiles.caaLicenceFile)))
    .limit(1);
  if (!pp) return false;
  await db.update(users).set({ role: "pilot" }).where(eq(users.id, userId));
  if (refreshOwnSession) await createSession(userId, "pilot");
  return true;
}
