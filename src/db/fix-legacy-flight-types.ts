/**
 * One-time fix-up for pre-v16 flight log entries.
 *
 * v16 changed `flight_log_entries.flight_type` from a solo/dual vocabulary
 * (solo_ppg / solo_trike / dual_trike) to an equipment-type vocabulary
 * (pg / ppg / ppt), per Riaan's request -- equipment type is what he
 * actually wants tracked on each flight, not solo vs. dual. Any row written
 * before v16 still holds an old value, which no longer matches the current
 * FLIGHT_TYPE_OPTIONS list. This script rewrites those old values to their
 * v16 equivalents in place. Nothing else about the row changes.
 *
 * Mapping:
 *   solo_ppg   -> ppg  (was flying a PPG, solo)
 *   solo_trike -> ppt  (was flying a paratrike, solo)
 *   dual_trike -> ppt  (was flying a paratrike, dual/instruction)
 *
 * The older generic "solo"/"dual" values (from before even the solo_ppg/
 * solo_trike/dual_trike vocabulary existed) don't record which equipment
 * was flown, so they can't be safely guessed -- those are flagged for
 * manual review instead.
 *
 * Safe to run more than once: a value that's already a valid v16 value (or
 * already fixed) is left untouched.
 *
 * Run with: npm run db:fix-legacy-flight-types
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { flightLogEntries, users } from "./schema";

const OLD_TO_NEW: Record<string, "pg" | "ppg" | "ppt"> = {
  solo_ppg: "ppg",
  solo_trike: "ppt",
  dual_trike: "ppt",
};

const AMBIGUOUS_VALUES = new Set(["solo", "dual"]);

const VALID_V16_VALUES = new Set(["pg", "ppg", "ppt"]);

async function main() {
  const rows = await db.select().from(flightLogEntries);

  let renamed = 0;
  let alreadyValid = 0;
  let skippedAmbiguous = 0;
  let skippedUnknown = 0;

  for (const row of rows) {
    if (VALID_V16_VALUES.has(row.flightType)) {
      alreadyValid++;
      continue;
    }

    if (AMBIGUOUS_VALUES.has(row.flightType)) {
      const [student] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, row.studentId))
        .limit(1);
      console.log(
        `SKIPPED (ambiguous, needs manual review): flight_type "${row.flightType}" on entry ` +
          `${row.id} (${row.date.toISOString().slice(0, 10)}, ${row.site}) for ` +
          `${student?.name ?? row.studentId} <${student?.email ?? "?"}>`
      );
      skippedAmbiguous++;
      continue;
    }

    const newValue = OLD_TO_NEW[row.flightType];
    if (!newValue) {
      console.log(
        `SKIPPED (unrecognized value, left as-is): "${row.flightType}" on entry ${row.id}`
      );
      skippedUnknown++;
      continue;
    }

    await db
      .update(flightLogEntries)
      .set({ flightType: newValue })
      .where(eq(flightLogEntries.id, row.id));
    renamed++;
    console.log(`RENAMED: "${row.flightType}" -> "${newValue}" on entry ${row.id}`);
  }

  console.log("");
  console.log("Done.");
  console.log(`  Renamed:            ${renamed}`);
  console.log(`  Already valid:      ${alreadyValid}`);
  console.log(`  Skipped (ambiguous):${skippedAmbiguous}`);
  console.log(`  Skipped (unknown):  ${skippedUnknown}`);
  if (skippedAmbiguous > 0) {
    console.log("");
    console.log(
      `${skippedAmbiguous} entry(ies) need manual review -- see "SKIPPED (ambiguous...)" lines above. There's no edit UI for an existing entry's flight type yet, so leaving these as-is is fine (they still display, just labeled "(legacy)") unless it matters enough to fix by hand in the database.`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
