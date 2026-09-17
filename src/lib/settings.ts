import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";

const SINGLETON_ID = "singleton";

/** The site-wide standard radio call script, shown to every student. Null
 * until the instructor sets one from Instructor -> Settings. */
export async function getRadioCallScript(): Promise<string | null> {
  const [row] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, SINGLETON_ID))
    .limit(1);
  return row?.radioCallScript ?? null;
}
