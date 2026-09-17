/**
 * One-time fix-up for the v7 update: v6 already seeded the PG Basic
 * Licence Theory Test with content that had bugs (answers overwhelmingly
 * labeled "B", no logo/no non-MC print wording). `npm run db:seed` skips
 * re-seeding an exam that already exists (so it never overwrites real
 * student data on ordinary updates) -- so this script exists specifically
 * to replace that one exam's content with the corrected version.
 *
 * It deletes the exam (and, via cascade, its sections/questions/options
 * AND any attempts/answers already recorded against it) and lets the
 * normal seed step re-create it fresh. Nothing else in the database is
 * touched -- students, logbooks, syllabus, other accounts are untouched.
 *
 * Run with: npm run db:reseed-exam
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { exams } from "./schema";

const EXAM_SLUG = "pg-basic-licence-theory";

async function main() {
  const [existing] = await db.select().from(exams).where(eq(exams.slug, EXAM_SLUG)).limit(1);

  if (!existing) {
    console.log(`No existing "${EXAM_SLUG}" exam found -- nothing to clear.`);
    console.log('Run "npm run db:seed" to create it fresh.');
    return;
  }

  await db.delete(exams).where(eq(exams.id, existing.id));
  console.log(`Cleared the old "${existing.title}" exam (and any attempts against it).`);
  console.log('Now run "npm run db:seed" to load the corrected version.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
