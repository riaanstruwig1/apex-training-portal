import "server-only";
import { ENDORSEMENT_OPTIONS } from "@/lib/pilot-endorsements";

/**
 * CAR Part 106 progress ladder (v17).
 *
 * Source: the 33rd Amendment to the Civil Aviation Regulations (gazetted 21
 * Aug 2026), read in full -- see SOW Section 3.8 and
 * claude/team-apex-portal-status.md for the full writeup. Two things are
 * genuinely regulation-backed and enforced exactly here:
 *
 *  - Time-in-endorsement minimums between ladder tiers (Basic ->
 *    Intermediate -> Sport -> Tandem), per equipment type (PG/PPG/PPT).
 *  - Instructor-rating time-in-rating minimums.
 *
 * What ISN'T enforced here, because the app has no data to check it against
 * yet:
 *  - The Basic->Intermediate and Intermediate->Sport flight-count
 *    thresholds. Part 106 itself defers those to Document SA-CATS 106,
 *    which isn't published -- there's no real number to enforce even if the
 *    app tracked flight counts.
 *  - Every instructor-rating threshold that needs a flight/hour count or a
 *    "pilots trained" count (Tandem Instructor, Grade B, Grade A) -- there's
 *    no Pilot flight log yet (noted for a later build stage, 15 Sep 2026),
 *    so these numbers can't be computed. Shown as informational text
 *    instead of a computed gate; the CFI/Admin still verifies these by hand,
 *    same as before.
 *  - "Valid medical" for Tandem -- medical declarations are Stage 3, not
 *    built yet.
 *
 * Riaan's own "Bronze / Silver / Platinum" flight-count goal-tracker bar
 * (SOW 3.8) needs the same missing flight-log data and isn't built here
 * either -- see the placeholder note surfaced on the pilot dashboard.
 */

export const LADDER_TIERS = ["basic", "intermediate", "sport", "tandem"] as const;
export type LadderTier = (typeof LADDER_TIERS)[number];
export const LADDER_TIER_LABELS: Record<LadderTier, string> = {
  basic: "Basic",
  intermediate: "Intermediate",
  sport: "Sport",
  tandem: "Tandem",
};

export type Equipment = "pg" | "ppg" | "ppt";
export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  pg: "Paraglider (PG)",
  ppg: "Powered Paragliding (PPG)",
  ppt: "Paratrike (PPT)",
};

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function ladderKey(equipment: Equipment, tier: LadderTier): string {
  const opt = ENDORSEMENT_OPTIONS.find((o) => o.equipment === equipment && o.tier === tier);
  if (!opt) throw new Error(`No ENDORSEMENT_OPTIONS entry for ${equipment}/${tier}`);
  return opt.key;
}

export type EndorsementRow = {
  key: string;
  verified: boolean;
  verifiedAt: Date | null;
  declaredAt: Date;
  declined: boolean;
  declineReason: string | null;
};

export type LadderTierState = {
  tier: LadderTier;
  key: string;
  label: string;
  held: boolean;
  heldSince: Date | null;
  pending: boolean; // declared, not yet verified, not declined
  pendingSince: Date | null;
  declined: boolean; // CFI/Admin declined this application -- pilot can re-apply
  declineReason: string | null;
  eligible: boolean; // can apply now (only meaningful when !held)
  eligibleFrom: Date | null; // null = eligible now (once prerequisite tiers are held)
  reason: string | null; // short human explanation when not eligible / locked
};

/** Computes the 4-tier ladder for one equipment type from a pilot's
 * endorsement rows. Tiers must be earned in order -- a tier past the first
 * un-held one is always "locked" (no point computing a future date off a
 * date that doesn't exist yet). */
export function computeLadder(
  equipment: Equipment,
  rows: EndorsementRow[]
): LadderTierState[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const states: LadderTierState[] = [];
  let prevHeldSince: Date | null = null; // previous tier's verifiedAt, for the next tier's gate
  let chainBroken = false; // true once we hit a tier that isn't held -- later tiers are locked

  for (const tier of LADDER_TIERS) {
    const key = ladderKey(equipment, tier);
    const row = byKey.get(key);
    const held = !!row?.verified;
    const heldSince = row?.verifiedAt ?? null;
    const declined = !!row?.declined;
    const pending = !!row && !row.verified && !declined;

    let eligible = false;
    let eligibleFrom: Date | null = null;
    let reason: string | null = null;

    if (!held) {
      if (chainBroken) {
        reason = `Requires ${LADDER_TIER_LABELS[prevTierOf(tier)!]} first.`;
      } else if (tier === "basic") {
        // No in-app prerequisite -- the CFI grants Basic once training/exam
        // is complete, which this app already tracks separately (folio +
        // exams), not as a time-held gate.
        eligible = true;
      } else if (tier === "tandem") {
        // Special case: needs the PG certificate held 24mo AND this
        // equipment's own Sport held 12mo, plus a valid medical (not
        // tracked -- see file header).
        const pgBasic = byKey.get(ladderKey("pg", "basic"));
        const pgBasicSince = pgBasic?.verified ? pgBasic.verifiedAt : null;
        const sportSince = prevHeldSince; // prevHeldSince is Sport's date here, since tandem follows sport
        if (!pgBasicSince || !sportSince) {
          reason = "Requires the PG certificate and Sport, both held.";
        } else {
          const pgGate = addMonths(pgBasicSince, 24);
          const sportGate = addMonths(sportSince, 12);
          eligibleFrom = pgGate > sportGate ? pgGate : sportGate;
          eligible = eligibleFrom.getTime() <= Date.now();
          reason = "Also requires a valid medical declaration (not tracked in-app yet -- confirm manually).";
        }
      } else {
        const months = tier === "intermediate" ? 6 : 12; // sport requires intermediate held 12mo
        if (!prevHeldSince) {
          reason = `Requires ${LADDER_TIER_LABELS[prevTierOf(tier)!]} first.`;
        } else {
          eligibleFrom = addMonths(prevHeldSince, months);
          eligible = eligibleFrom.getTime() <= Date.now();
        }
      }
      chainBroken = true;
    }

    states.push({
      tier,
      key,
      label: LADDER_TIER_LABELS[tier],
      held,
      heldSince,
      pending,
      pendingSince: row?.declaredAt ?? null,
      declined,
      declineReason: row?.declineReason ?? null,
      eligible,
      eligibleFrom,
      reason,
    });

    if (held) prevHeldSince = heldSince;
  }

  return states;
}

function prevTierOf(tier: LadderTier): LadderTier | null {
  const i = LADDER_TIERS.indexOf(tier);
  return i > 0 ? LADDER_TIERS[i - 1] : null;
}

/**
 * Instructor-rating thresholds, for reference only -- NOT computed.
 *
 * Part 106's own instructor ladder (Assistant Instructor -> Tandem
 * Instructor -> Grade B -> Grade A) doesn't line up with Riaan's shipped
 * sign-up checklist, which tracks instructor grades per equipment type (PG/
 * PPG/PPT Grade A/B/C) plus a separate Assistant Instructor item, and has no
 * "Tandem Instructor" item at all. Rather than invent a mapping between the
 * two that might be wrong, this is shown as plain reference text next to
 * the Instructor Ratings checklist -- CFI/Admin still verify each item by
 * hand, exactly as before. Every threshold here also needs a flight/hour or
 * "pilots trained" count the app has no data source for yet (no Pilot
 * flight log), so even a correct mapping couldn't be auto-checked today.
 */
export const INSTRUCTOR_RATING_REFERENCE_TEXT =
  "Assistant Instructor: Intermediate endorsement held 12+ months. " +
  "Tandem Instructor: Tandem endorsement held 12+ months, plus 500 total paraglider flights (150+ flights / 50+ hours on tandem gear). " +
  "Grade B: certificate held 24+ months, Sport held 12+ months, Assistant Instructor held 6+ months, plus 500 flights / 100 hours on paragliders. " +
  "Grade A: Grade B and Tandem Instructor both held 24+ months, plus having trained 50+ pilots to certificate. " +
  "Flight/hour and pilots-trained figures aren't tracked in-app yet -- confirm these manually before verifying.";
