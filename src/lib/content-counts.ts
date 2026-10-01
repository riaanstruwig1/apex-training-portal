import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contentItems } from "@/db/schema";

/** How many sub-sections each exercise has (line 70) -- shown as a count on
 * the exercise's info button. */
export async function getExerciseContentCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ ownerId: contentItems.ownerId, count: sql<number>`count(*)`.as("count") })
    .from(contentItems)
    .where(eq(contentItems.ownerType, "exercise"))
    .groupBy(contentItems.ownerId);
  return Object.fromEntries(rows.map((r) => [r.ownerId, Number(r.count)]));
}
