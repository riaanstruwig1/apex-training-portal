import "server-only";
import { eq, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { flightLogEntries, users } from "@/db/schema";

export async function getLogbookEntries(studentId: string) {
  const entries = await db
    .select()
    .from(flightLogEntries)
    .where(eq(flightLogEntries.studentId, studentId))
    .orderBy(desc(flightLogEntries.date));

  // One extra lookup for instructor names rather than a join on every row --
  // there are only ever a handful of instructors, so this stays cheap even
  // as a student's logbook grows.
  const instructorIds = [...new Set(entries.map((e) => e.instructorUserId).filter((id): id is string => !!id))];
  const instructorNames = new Map<string, string>();
  if (instructorIds.length > 0) {
    const rows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, instructorIds));
    for (const r of rows) instructorNames.set(r.id, r.name);
  }

  return entries.map((e) => ({
    ...e,
    instructorName: e.instructorUserId ? (instructorNames.get(e.instructorUserId) ?? null) : null,
  }));
}

/** Every CFI/instructor account, for the "who was your instructor for this
 * flight?" dropdown a student picks from when logging a flight. Safe to
 * expose to a logged-in student -- just names, no admin gate needed. */
export async function getInstructorRoster(): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.role, ["cfi", "instructor"]))
    .orderBy(users.name);
}

export function summarizeLogbook(
  entries: Awaited<ReturnType<typeof getLogbookEntries>>
) {
  const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0);
  const totalLaunches = entries.reduce((sum, e) => sum + e.launches, 0);
  // Per-equipment-type minutes, for a breakdown stat instead of the old
  // solo/dual split (dropped as of v16 -- flightType now tracks PG/PPG/PPT,
  // not solo/dual).
  const minutesByType = { pg: 0, ppg: 0, ppt: 0 } as Record<
    "pg" | "ppg" | "ppt",
    number
  >;
  for (const e of entries) {
    if (e.flightType === "pg" || e.flightType === "ppg" || e.flightType === "ppt") {
      minutesByType[e.flightType] += e.durationMinutes;
    }
  }
  return {
    totalFlights: entries.length,
    totalMinutes,
    totalLaunches,
    minutesByType,
  };
}
