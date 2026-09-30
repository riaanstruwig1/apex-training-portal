import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, studentProfiles, whatsappInvites } from "@/db/schema";
import { normalizePhone, type InviteAudience } from "@/lib/invite-message";

/** Every normalised cell number already belonging to someone in the Hub
 * (users.phone from public sign-up, plus studentProfiles.phone). */
export async function getMemberPhones(): Promise<Map<string, string>> {
  const [userRows, studentRows] = await Promise.all([
    db.select({ id: users.id, name: users.name, phone: users.phone }).from(users),
    db
      .select({ userId: studentProfiles.userId, phone: studentProfiles.phone })
      .from(studentProfiles),
  ]);
  const nameById = new Map(userRows.map((u) => [u.id, u.name]));
  const phones = new Map<string, string>();
  for (const u of userRows) {
    const n = normalizePhone(u.phone);
    if (n) phones.set(n, u.name);
  }
  for (const s of studentRows) {
    const n = normalizePhone(s.phone);
    if (n && !phones.has(n)) phones.set(n, nameById.get(s.userId) ?? "an existing member");
  }
  return phones;
}

export type PendingInvite = {
  id: string;
  name: string;
  phone: string;
  createdAt: Date;
  lastSentAt: Date;
  sendCount: number;
  lastStatus: "sent" | "failed";
  lastError: string | null;
};

/** Invites on one list (pilot or student) still waiting on a sign-up: not
 * removed, and no Hub account with the same cell number yet. Newest first. */
export async function getPendingInvites(audience: InviteAudience): Promise<PendingInvite[]> {
  const [rows, memberPhones] = await Promise.all([
    db
      .select()
      .from(whatsappInvites)
      .where(and(eq(whatsappInvites.audience, audience), isNull(whatsappInvites.removedAt)))
      .orderBy(desc(whatsappInvites.lastSentAt)),
    getMemberPhones(),
  ]);
  return rows
    .filter((r) => !memberPhones.has(r.phone))
    .map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      createdAt: r.createdAt,
      lastSentAt: r.lastSentAt,
      sendCount: r.sendCount,
      lastStatus: r.lastStatus,
      lastError: r.lastError,
    }));
}
