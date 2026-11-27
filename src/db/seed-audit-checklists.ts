import { eq } from "drizzle-orm";
import { db } from "./index";
import { auditChecklistItems, auditChecklists } from "./schema";
import { CHECKLISTS } from "./audit-checklist-data";

/** Batch 111: loads the starter audit checklists on Railway start. Safe to run
 * every time: a checklist that already exists is left exactly as the Quality
 * person edited it. */
async function main() {
  let added = 0;
  for (const [i, c] of CHECKLISTS.entries()) {
    const [exists] = await db.select({ id: auditChecklists.id }).from(auditChecklists).where(eq(auditChecklists.key, c.key)).limit(1);
    if (exists) continue;
    const [row] = await db.insert(auditChecklists).values({ key: c.key, title: c.title, reference: c.reference, sortOrder: i + 1 }).returning({ id: auditChecklists.id });
    await db.insert(auditChecklistItems).values(c.items.map(([question, reference], n) => ({ checklistId: row.id, position: n + 1, question, reference })));
    added++;
  }
  console.log(added ? `Audit checklists: added ${added}.` : "Audit checklists: already loaded.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
