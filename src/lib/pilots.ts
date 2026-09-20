import "server-only";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, pilotProfiles, pilotEndorsements } from "@/db/schema";

export type PilotSummary = {
  id: string; // user id
  name: string;
  email: string;
  role: string;
  apexNumber: string | null;
  callSign: string | null;
  pilotProfileId: string;
  verifiedCount: number;
  pendingCount: number;
};

/** Every active pilot profile, whether it belongs to a plain "pilot"
 * account or a CFI/instructor who is also a pilot -- see the account-model
 * decision in the status doc. Pending (not-yet-approved) applicants are
 * excluded; they're reviewed via the sign-up verification queue instead. */
export async function getAllPilotsWithSummary(): Promise<PilotSummary[]> {
  // NOTE: selects pilotProfiles.userId (not users.id) for the user-id field
  // -- selecting .id from both joined tables in one query collides under
  // this project's drizzle-orm/sqlite-proxy setup (both come back mapped to
  // the same raw "id" column, silently dropping one). getAllStudentsWithSummary
  // in lib/progress.ts sidesteps the same trap by only ever selecting one
  // table's .id in a join; here both ids are genuinely needed, so the fix is
  // to read the user id off pilotProfiles.userId (a differently-named
  // column) instead of users.id.
  const rows = await db
    .select({
      userId: pilotProfiles.userId,
      name: users.name,
      email: users.email,
      role: users.role,
      apexNumber: users.apexNumber,
      callSign: pilotProfiles.callSign,
      pilotProfileId: pilotProfiles.id,
    })
    .from(pilotProfiles)
    .innerJoin(users, eq(pilotProfiles.userId, users.id))
    .where(and(eq(pilotProfiles.status, "active"), eq(users.accountStatus, "active")));

  const endorsements = await db.select().from(pilotEndorsements);
  const byProfile = new Map<string, { verified: number; pending: number }>();
  for (const e of endorsements) {
    const counts = byProfile.get(e.pilotProfileId) ?? { verified: 0, pending: 0 };
    // A declined application is neither verified nor awaiting review -- it's
    // parked until the pilot re-applies (see applyForEndorsement), so it
    // must not inflate the "pending" count/badge.
    if (e.verified) counts.verified++;
    else if (!e.declined) counts.pending++;
    byProfile.set(e.pilotProfileId, counts);
  }

  return rows
    .map((r) => ({
      id: r.userId,
      name: r.name,
      email: r.email,
      role: r.role,
      apexNumber: r.apexNumber,
      callSign: r.callSign,
      pilotProfileId: r.pilotProfileId,
      verifiedCount: byProfile.get(r.pilotProfileId)?.verified ?? 0,
      pendingCount: byProfile.get(r.pilotProfileId)?.pending ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A CFI/instructor is very often also a pilot (Notes4 item 24, flagged
 * MAJOR) -- every staff account should always be able to see and use its
 * own pilot side, not just the ones that happen to already have a
 * pilot_profiles row. This guarantees one exists for a given user, creating
 * it (as an already-active profile -- staff don't need a separate
 * verification step) the first time it's needed, and just returning it on
 * every later call. Safe to call from a Server Component render: if two
 * requests race, the DB's unique constraint on userId rejects the loser's
 * insert and it falls back to reading the winner's row instead of crashing. */
export async function ensurePilotProfile(userId: string): Promise<{ id: string }> {
  const [existing] = await db
    .select({ id: pilotProfiles.id })
    .from(pilotProfiles)
    .where(eq(pilotProfiles.userId, userId))
    .limit(1);
  if (existing) return existing;

  try {
    const [created] = await db
      .insert(pilotProfiles)
      .values({ userId, status: "active" })
      .returning({ id: pilotProfiles.id });
    return created;
  } catch {
    const [row] = await db
      .select({ id: pilotProfiles.id })
      .from(pilotProfiles)
      .where(eq(pilotProfiles.userId, userId))
      .limit(1);
    if (!row) throw new Error("Failed to ensure pilot profile for user " + userId);
    return row;
  }
}

/** Count of declared-but-unverified, not-declined endorsements across every
 * active pilot -- drives the "Pilots" nav badge, same pattern as the sign-up
 * queue. A declined application is excluded: it's parked awaiting the pilot
 * re-applying, not sitting in the review queue. */
export async function countPendingPilotEndorsements(): Promise<number> {
  const rows = await db
    .select({ id: pilotEndorsements.id })
    .from(pilotEndorsements)
    .innerJoin(pilotProfiles, eq(pilotEndorsements.pilotProfileId, pilotProfiles.id))
    .where(
      and(
        eq(pilotEndorsements.verified, false),
        eq(pilotEndorsements.declined, false),
        eq(pilotProfiles.status, "active")
      )
    );
  return rows.length;
}
