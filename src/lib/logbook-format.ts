// Pure formatting/calculation helpers shared by the student and instructor
// logbook tables. Deliberately has no `server-only` import (unlike
// lib/logbook.ts) since both call sites are client components.
import { LOGBOOK_EXERCISES } from "@/lib/logbook-exercises";

const exerciseLabelByCode = new Map(
  LOGBOOK_EXERCISES.map((e) => [e.code, e.label])
);

/** Turns the stored comma-separated exercise codes ("1, 4, 9") into their
 * short labels for display, falling back to the raw code for anything that
 * doesn't match the current list (e.g. an older entry). */
export function formatExerciseCodes(codesCsv: string | null): string {
  if (!codesCsv) return "—";
  return codesCsv
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => exerciseLabelByCode.get(c) ?? c)
    .join(", ");
}

export const FLIGHT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "pg", label: "PG" },
  { value: "ppg", label: "PPG" },
  { value: "ppt", label: "PPT" },
  { value: "winching", label: "Winching" },
];

const flightTypeLabelByValue = new Map(
  FLIGHT_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

// Older rows (pre-v16) used a solo/dual vocabulary instead of equipment
// type -- kept only so an un-migrated entry still shows something sensible
// rather than a raw db value. Run `npm run db:fix-legacy-flight-types` to
// convert real data to the current pg/ppg/ppt values.
const legacyFlightTypeLabels: Record<string, string> = {
  solo_ppg: "PPG (legacy: solo)",
  solo_trike: "PPT (legacy: solo)",
  dual_trike: "PPT (legacy: dual)",
  solo: "Solo (legacy)",
  dual: "Dual (legacy)",
};

/** Turns a stored flight_type value into its display label, falling back to
 * the older solo/dual vocabulary (or the raw value) for older, un-migrated
 * rows. */
export function formatFlightType(flightType: string): string {
  return (
    flightTypeLabelByValue.get(flightType) ??
    legacyFlightTypeLabels[flightType] ??
    flightType
  );
}

/** Formats a minute count as "Xh Ym", matching how a paper flight logbook
 * records accumulated time (hrs & min), e.g. 125 -> "2h 05m". */
export function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/**
 * A paper logbook accumulates flight time down the page in the order flights
 * happened. Given entries in any order, returns a map of entry id ->
 * cumulative minutes flown up to and including that flight, in chronological
 * (date) order -- so the most recent flight's value is the grand total.
 */
export function computeAccumulatedMinutes<
  T extends { id: string; date: Date; durationMinutes: number },
>(entries: T[]): Map<string, number> {
  const chronological = [...entries].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  let running = 0;
  const map = new Map<string, number>();
  for (const e of chronological) {
    running += e.durationMinutes;
    map.set(e.id, running);
  }
  return map;
}
