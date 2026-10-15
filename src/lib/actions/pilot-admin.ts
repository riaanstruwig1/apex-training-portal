"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users, pilotProfiles } from "@/db/schema";
import { requireCFI } from "@/lib/auth/dal";

// CFI-only housekeeping for pilot accounts (15 Oct 2026, Riaan). Only plain
// "pilot" accounts can be archived/deleted here -- never a CFI or instructor.

async function assertPlainPilot(userId: string) {
  const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u || u.role !== "pilot") throw new Error("Only a pilot account can be changed here.");
}

/** Hides a pilot from the Pilots list; everything is kept. Reversible. */
export async function archivePilot(pilotUserId: string) {
  await requireCFI();
  await assertPlainPilot(pilotUserId);
  await db.update(pilotProfiles).set({ status: "archived" }).where(eq(pilotProfiles.userId, pilotUserId));
  revalidatePath("/admin/pilots");
}

export async function restorePilot(pilotUserId: string) {
  await requireCFI();
  await assertPlainPilot(pilotUserId);
  await db.update(pilotProfiles).set({ status: "active" }).where(eq(pilotProfiles.userId, pilotUserId));
  revalidatePath("/admin/pilots");
}

/** Permanently deletes the pilot's account and everything tied to it
 * (profile, endorsements, logbook, sign-off records cascade). Not reversible. */
export async function deletePilot(pilotUserId: string) {
  await requireCFI();
  await db.delete(users).where(and(eq(users.id, pilotUserId), eq(users.role, "pilot")));
  revalidatePath("/admin/pilots");
}
