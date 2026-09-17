import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Generates the next unique Apex Number ("APEX-000123"), sequential from
 * however many have been issued so far. Small DTO scale (tens/hundreds of
 * members), so a straightforward "count + retry on the rare collision" is
 * enough -- no need for a dedicated counter table.
 */
export async function generateApexNumber(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.apexNumber} is not null`);

    const candidate = `APEX-${String(count + 1 + attempt).padStart(6, "0")}`;

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`${users.apexNumber} = ${candidate}`)
      .limit(1);

    if (!existing) return candidate;
  }

  // Fallback: astronomically unlikely at this scale, but keep sign-up from
  // ever hard-failing on this step.
  return `APEX-${Date.now()}`;
}
