/**
 * One-time fix-up for pre-v13 pilot endorsement data.
 *
 * v13 renamed/regrouped the endorsement key list in lib/pilot-endorsements.ts
 * (ENDORSEMENT_OPTIONS) to match Riaan's full licence/endorsement list. Any
 * `pilot_endorsements.key` row written before that change still holds the
 * OLD key name, which no longer matches any ENDORSEMENT_OPTIONS entry -- so
 * groupEndorsementItems() dumps it into an "Other" bucket instead of its
 * real group. This script rewrites those old keys to their v13 equivalents
 * in place. Nothing else about the row (verified, verifiedAt,
 * verifiedByUserId) changes.
 *
 * Safe to run more than once: a key that's already a valid v13 key (or
 * already fixed) is left untouched.
 *
 * Run with: npm run db:fix-endorsement-keys
 */
import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db } from "./index";
import { pilotEndorsements, pilotProfiles, users } from "./schema";
import { ENDORSEMENT_OPTIONS } from "../lib/pilot-endorsements";

// Old key -> new (v13) key. Only covers keys known to have been used before
// the v13 rename; anything not listed here that also isn't a current valid
// key is left alone and flagged for manual review instead of guessed at.
const OLD_TO_NEW: Record<string, string> = {
  winching: "pg_winching",
  ridge_soaring: "pg_ridge_soaring",
  mountain_flying: "pg_mountain_flying",
  thermal_flying: "pg_thermaling",
  cross_country_flying: "pg_xc",
  ppg_tandem_footlaunch: "ppg_tandem",
  ppt_paratrike: "ppt_base",
  pg_instructor_a: "instructor_pg_grade_a",
  pg_instructor_b: "instructor_pg_grade_b",
  pg_instructor_c: "instructor_pg_grade_c",
  ppg_instructor_a: "instructor_ppg_grade_a",
  ppg_instructor_b: "instructor_ppg_grade_b",
  ppg_instructor_c: "instructor_ppg_grade_c",
  ppt_instructor_a: "instructor_ppt_grade_a",
  ppt_instructor_b: "instructor_ppt_grade_b",
  ppt_instructor_c: "instructor_ppt_grade_c",
  display_flat_formation: "display_flat",
};

// Old keys we've seen that don't map cleanly onto a single v13 key -- the
// old data doesn't record enough to guess correctly, so these are skipped
// and printed for Riaan (or whoever's cleaning up) to fix by hand on each
// pilot's profile.
const AMBIGUOUS_KEYS = new Set(["sports_rating"]);

const VALID_V13_KEYS = new Set(ENDORSEMENT_OPTIONS.map((o) => o.key));

async function main() {
  const rows = await db.select().from(pilotEndorsements);

  let renamed = 0;
  let alreadyValid = 0;
  let skippedAmbiguous = 0;
  let skippedUnknown = 0;
  let mergedDuplicates = 0;

  for (const row of rows) {
    if (VALID_V13_KEYS.has(row.key)) {
      alreadyValid++;
      continue;
    }

    if (AMBIGUOUS_KEYS.has(row.key)) {
      const [owner] = await db
        .select({ name: users.name, email: users.email })
        .from(pilotProfiles)
        .innerJoin(users, eq(users.id, pilotProfiles.userId))
        .where(eq(pilotProfiles.id, row.pilotProfileId))
        .limit(1);
      console.log(
        `SKIPPED (ambiguous, needs manual review): key "${row.key}" on pilot ` +
          `${owner?.name ?? row.pilotProfileId} <${owner?.email ?? "?"}>`
      );
      skippedAmbiguous++;
      continue;
    }

    const newKey = OLD_TO_NEW[row.key];
    if (!newKey) {
      console.log(
        `SKIPPED (unrecognized key, left as-is): "${row.key}" on pilot profile ${row.pilotProfileId}`
      );
      skippedUnknown++;
      continue;
    }

    // Does this pilot already have a row under the new key (e.g. they
    // declared both the old- and new-named version at different times)?
    const [existing] = await db
      .select()
      .from(pilotEndorsements)
      .where(
        and(
          eq(pilotEndorsements.pilotProfileId, row.pilotProfileId),
          eq(pilotEndorsements.key, newKey)
        )
      )
      .limit(1);

    if (existing) {
      // Merge into the existing row rather than crash on the unique
      // constraint: keep whichever is verified (or the newer one if
      // neither/both are), then drop the old-keyed duplicate.
      if (row.verified && !existing.verified) {
        await db
          .update(pilotEndorsements)
          .set({
            verified: true,
            verifiedAt: row.verifiedAt,
            verifiedByUserId: row.verifiedByUserId,
          })
          .where(eq(pilotEndorsements.id, existing.id));
      }
      await db.delete(pilotEndorsements).where(eq(pilotEndorsements.id, row.id));
      mergedDuplicates++;
      console.log(
        `MERGED: "${row.key}" -> "${newKey}" (pilot already had "${newKey}"; duplicate dropped) on pilot profile ${row.pilotProfileId}`
      );
      continue;
    }

    await db
      .update(pilotEndorsements)
      .set({ key: newKey })
      .where(eq(pilotEndorsements.id, row.id));
    renamed++;
    console.log(`RENAMED: "${row.key}" -> "${newKey}" on pilot profile ${row.pilotProfileId}`);
  }

  console.log("");
  console.log("Done.");
  console.log(`  Renamed:            ${renamed}`);
  console.log(`  Merged duplicates:  ${mergedDuplicates}`);
  console.log(`  Already valid:      ${alreadyValid}`);
  console.log(`  Skipped (ambiguous):${skippedAmbiguous}`);
  console.log(`  Skipped (unknown):  ${skippedUnknown}`);
  if (skippedAmbiguous > 0) {
    console.log("");
    console.log(
      `${skippedAmbiguous} row(s) need manual review -- see "SKIPPED (ambiguous...)" lines above.`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
