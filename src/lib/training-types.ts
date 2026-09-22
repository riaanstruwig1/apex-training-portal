// Pure helpers for the studentProfiles.trainingType column -- deliberately
// NOT server-only (unlike lib/exams.ts), since client components (the
// training-type checkbox editors) need to parse/format this value too.
// lib/exams.ts re-exports these for server-side callers, so most code can
// keep importing from "@/lib/exams" as before; import directly from here
// only in a "use client" component.

export type TrainingType = "pg" | "ppg" | "ppt";
export const TRAINING_TYPE_ORDER: TrainingType[] = ["pg", "ppg", "ppt"];

/** studentProfiles.trainingType is stored as a comma-separated list (a
 * student can train toward more than one course at once, e.g. PG *and*
 * PPG) -- this is the one place that format is parsed. Unknown/garbled
 * entries are dropped rather than throwing, so a bad row never 500s a page. */
export function parseTrainingTypes(raw: string | null | undefined): TrainingType[] {
  if (!raw) return [];
  const seen = new Set<TrainingType>();
  for (const part of raw.split(",")) {
    const t = part.trim().toLowerCase();
    if ((TRAINING_TYPE_ORDER as string[]).includes(t)) seen.add(t as TrainingType);
  }
  return TRAINING_TYPE_ORDER.filter((t) => seen.has(t));
}

/** Inverse of parseTrainingTypes -- joins selected training types back into
 * the stored comma-separated form. Empty array -> null (not declared). */
export function formatTrainingTypes(types: TrainingType[]): string | null {
  const ordered = TRAINING_TYPE_ORDER.filter((t) => types.includes(t));
  return ordered.length ? ordered.join(",") : null;
}
