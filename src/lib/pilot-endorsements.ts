/**
 * Fixed checklist offered at Pilot sign-up (SOW Section 3.7), grouped to match
 * Riaan's own full licence/endorsement list exactly (supplied 14 Sep 2026).
 * Nothing here is a claim about which are real, separately-regulated SACAA
 * endorsements vs. site/experience categories SAHPA tracks internally -- it
 * mirrors his list as-is. `group` drives both the sign-up checklist layout
 * and the verified-endorsements display on the pilot's own dashboard, so
 * that both read in the same, easier-to-scan groups.
 *
 * PG = paragliding (unpowered), PPG = powered paragliding (foot-launch),
 * PPT = paratrike (single or dual seat) -- per Riaan's own note on the list.
 *
 * `equipment` + `tier` (added v17) identify the four items in each
 * equipment group that form the real CAR Part 106 ladder -- Basic ->
 * Intermediate -> Sport -> Tandem -- so lib/pilot-progress.ts can compute
 * ladder position and time-in-endorsement eligibility without parsing
 * labels/keys. `tier: null` marks a non-tiered add-on (winching, an
 * instructor rating, a display rating, ...) that Part 106 doesn't gate by
 * time-held -- CFI/Admin verify those on their own judgement, same as
 * before. "Intermediate" (pg_intermediate/ppg_intermediate/ppt_intermediate)
 * and PG's own "Basic" (pg_basic) are new in v17: Riaan's original 25-item
 * list didn't include them (PG's base certificate was implicit in becoming
 * a "pilot" at all, and Intermediate wasn't on his list), but the Part 106
 * ladder can't be tracked without them, so they're added as CFI-verifiable
 * checkboxes like everything else here.
 */
export const ENDORSEMENT_OPTIONS: {
  key: string;
  label: string;
  group: string;
  equipment: "pg" | "ppg" | "ppt" | null;
  tier: "basic" | "intermediate" | "sport" | "tandem" | null;
}[] = [
  // Paraglider (PG) -- ladder tiers, then non-tiered add-ons (a-g)
  { key: "pg_basic", label: "Basic", group: "Paraglider (PG)", equipment: "pg", tier: "basic" },
  { key: "pg_intermediate", label: "Intermediate", group: "Paraglider (PG)", equipment: "pg", tier: "intermediate" },
  { key: "pg_sport", label: "Sport", group: "Paraglider (PG)", equipment: "pg", tier: "sport" },
  { key: "pg_tandem", label: "Tandem", group: "Paraglider (PG)", equipment: "pg", tier: "tandem" },
  { key: "pg_winching", label: "Winching", group: "Paraglider (PG)", equipment: "pg", tier: null },
  { key: "pg_mountain_flying", label: "Mountain Flying", group: "Paraglider (PG)", equipment: "pg", tier: null },
  { key: "pg_ridge_soaring", label: "Ridge Soaring", group: "Paraglider (PG)", equipment: "pg", tier: null },
  { key: "pg_thermaling", label: "Thermaling", group: "Paraglider (PG)", equipment: "pg", tier: null },
  { key: "pg_xc", label: "Cross-Country (XC)", group: "Paraglider (PG)", equipment: "pg", tier: null },
  // Powered Paragliding (PPG) -- foot-launch -- ladder tiers (h, j, l)
  { key: "ppg_footlaunch", label: "Basic", group: "Powered Paragliding (PPG)", equipment: "ppg", tier: "basic" },
  { key: "ppg_intermediate", label: "Intermediate", group: "Powered Paragliding (PPG)", equipment: "ppg", tier: "intermediate" },
  { key: "ppg_sport", label: "Sport", group: "Powered Paragliding (PPG)", equipment: "ppg", tier: "sport" },
  { key: "ppg_tandem", label: "Tandem", group: "Powered Paragliding (PPG)", equipment: "ppg", tier: "tandem" },
  // Paratrike (PPT) -- ladder tiers (i, k, m)
  { key: "ppt_base", label: "Basic", group: "Paratrike (PPT)", equipment: "ppt", tier: "basic" },
  { key: "ppt_intermediate", label: "Intermediate", group: "Paratrike (PPT)", equipment: "ppt", tier: "intermediate" },
  { key: "ppt_sport", label: "Sport", group: "Paratrike (PPT)", equipment: "ppt", tier: "sport" },
  { key: "ppt_tandem", label: "Tandem", group: "Paratrike (PPT)", equipment: "ppt", tier: "tandem" },
  // n-w: Instructor ratings (not part of the equipment ladder -- their own
  // thresholds, see lib/pilot-progress.ts INSTRUCTOR_RATINGS)
  { key: "assistant_instructor", label: "Assistant Instructor", group: "Instructor Ratings", equipment: null, tier: null },
  { key: "instructor_pg_grade_c", label: "PG -- Grade C", group: "Instructor Ratings", equipment: null, tier: null },
  { key: "instructor_pg_grade_b", label: "PG -- Grade B", group: "Instructor Ratings", equipment: null, tier: null },
  { key: "instructor_pg_grade_a", label: "PG -- Grade A", group: "Instructor Ratings", equipment: null, tier: null },
  { key: "instructor_ppg_grade_c", label: "PPG -- Grade C", group: "Instructor Ratings", equipment: null, tier: null },
  { key: "instructor_ppg_grade_b", label: "PPG -- Grade B", group: "Instructor Ratings", equipment: null, tier: null },
  { key: "instructor_ppg_grade_a", label: "PPG -- Grade A", group: "Instructor Ratings", equipment: null, tier: null },
  { key: "instructor_ppt_grade_c", label: "PPT -- Grade C", group: "Instructor Ratings", equipment: null, tier: null },
  { key: "instructor_ppt_grade_b", label: "PPT -- Grade B", group: "Instructor Ratings", equipment: null, tier: null },
  { key: "instructor_ppt_grade_a", label: "PPT -- Grade A", group: "Instructor Ratings", equipment: null, tier: null },
  // x-y: Display ratings
  { key: "display_acro", label: "Acro", group: "Display Ratings", equipment: null, tier: null },
  { key: "display_flat", label: "Flat Display (min. 50 ft)", group: "Display Ratings", equipment: null, tier: null },
];

/** Group display order, top to bottom, for both the sign-up checklist and
 * the pilot's verified-endorsements dashboard card. */
export const ENDORSEMENT_GROUP_ORDER = [
  "Paraglider (PG)",
  "Powered Paragliding (PPG)",
  "Paratrike (PPT)",
  "Instructor Ratings",
  "Display Ratings",
];

export function endorsementLabel(key: string): string {
  return ENDORSEMENT_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

/** True for the four keys per equipment type (Basic/Intermediate/Sport/
 * Tandem) that make up the CAR Part 106 ladder -- see lib/pilot-progress.ts.
 * Callers rendering a flat "declared/verified licences" list should filter
 * these out: they already get their own card + Verify button in the
 * ladder display, and showing them a second time in the flat list means
 * two separate Verify buttons for the same underlying row (found 15 Sep
 * 2026, via Riaan's "verified the demo pilot but the notification still
 * shows" report -- he'd verified one of the two duplicate buttons, not
 * realizing the other one for the same item was still sitting there). */
export function isLadderTierKey(key: string): boolean {
  return ENDORSEMENT_OPTIONS.find((o) => o.key === key)?.tier != null;
}

export function endorsementGroup(key: string): string {
  return ENDORSEMENT_OPTIONS.find((o) => o.key === key)?.group ?? "Other";
}

/** Groups a list of endorsement keys (declared or verified) into
 * { group, items }[] in ENDORSEMENT_GROUP_ORDER, each item carrying its
 * label plus whatever extra data the caller attached (id, verifiedAt, etc). */
export function groupEndorsementItems<T extends { key: string }>(
  items: T[]
): { group: string; items: (T & { label: string })[] }[] {
  const byGroup = new Map<string, (T & { label: string })[]>();
  for (const item of items) {
    const group = endorsementGroup(item.key);
    const label = endorsementLabel(item.key);
    const list = byGroup.get(group) ?? [];
    list.push({ ...item, label });
    byGroup.set(group, list);
  }
  const orderedGroups = [
    ...ENDORSEMENT_GROUP_ORDER,
    ...[...byGroup.keys()].filter((g) => !ENDORSEMENT_GROUP_ORDER.includes(g)),
  ];
  return orderedGroups
    .filter((g) => byGroup.has(g))
    .map((group) => ({ group, items: byGroup.get(group)! }));
}
