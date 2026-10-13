import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contentItems, ratingApplicationDocuments } from "@/db/schema";

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

/** Line 62: how many requirement items the CFI has added per rating key. */
export async function getRatingContentCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ ownerId: contentItems.ownerId, count: sql<number>`count(*)`.as("count") })
    .from(contentItems)
    .where(eq(contentItems.ownerType, "rating"))
    .groupBy(contentItems.ownerId);
  return Object.fromEntries(rows.map((r) => [r.ownerId, Number(r.count)]));
}

/** Line 62: how many application documents one pilot (by user id) has
 * uploaded per rating key. */
export async function getRatingDocumentCounts(userId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({
      key: ratingApplicationDocuments.endorsementKey,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(ratingApplicationDocuments)
    .where(eq(ratingApplicationDocuments.userId, userId))
    .groupBy(ratingApplicationDocuments.endorsementKey);
  return Object.fromEntries(rows.map((r) => [r.key, Number(r.count)]));
}
