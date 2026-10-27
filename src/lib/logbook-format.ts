// Pure formatting/calculation helpers shared by the student and instructor
// logbook tables. Deliberately has no `server-only` import (unlike
// lib/logbook.ts) since both call sites are client components.
import { LOGBOOK_EXERCISES } from "@/lib/logbook-exercises";
import { PILOT_FLIGHT_TASKS } from "@/lib/logbook-flight-tasks";

// Both lists feed the same lookup -- student exercise codes are bare numbers
// ("1", "4") and pilot flight-task codes are words ("solo", "xc"), so there's
// no collision between them and a single map can format either kind of
// stored value without needing to know which list a given row was logged
// under (see logbook-flight-tasks.ts's own note).
const exerciseLabelByCode = new Map([
  ...LOGBOOK_EXERCISES.map((e) => [e.code, e.label] as const),
  ...PILOT_FLIGHT_TASKS.map((t) => [t.code, t.label] as const),
]);

/** Turns the stored comma-separated exercise/flight-task codes ("1, 4, 9" on
 * the student side, "solo, xc" on the pilot side) into their short labels
 * for display, falling back to the raw code for anything that doesn't match
 * either current list (e.g. an older entry). */
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
  { value: "ppt", label: "PPT/PPC" },
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
  solo_trike: "PPT/PPC (legacy: solo)",
  dual_trike: "PPT/PPC (legacy: dual)",
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
  T extends { id: string; date: Date; durationMinutes: number; createdAt?: Date | null },
>(entries: T[]): Map<string, number> {
  const chronological = [...entries].sort(chronologicalCompare);
  let running = 0;
  const map = new Map<string, number>();
  for (const e of chronological) {
    running += e.durationMinutes;
    map.set(e.id, running);
  }
  return map;
}

/** Flight No. = position in chronological (date) order, 1 = first flight. */
export function computeFlightNumbers<T extends { id: string; date: Date; createdAt?: Date | null }>(entries: T[]): Map<string, number> {
  const chronological = [...entries].sort(chronologicalCompare);
  const map = new Map<string, number>();
  chronological.forEach((e, i) => map.set(e.id, i + 1));
  return map;
}

/** Oldest first: date, then the time the entry was logged, then id, so flights
 * on the same day get a stable order (the list shows the exact reverse). */
export function chronologicalCompare(
  a: { id: string; date: Date; createdAt?: Date | null },
  b: { id: string; date: Date; createdAt?: Date | null }
): number {
  const d = a.date.getTime() - b.date.getTime();
  if (d !== 0) return d;
  const c = (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
  if (c !== 0) return c;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Wing / motor / wind (15 Oct 2026, Riaan)
// ---------------------------------------------------------------------------
export const WIND_DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export const WIND_SPEEDS = ["0-5 km/h", "5-10 km/h", "10-15 km/h", "15-20 km/h", "20-25 km/h", ">25 km/h"] as const;

/** "Wing / Motor" text kept in aircraftType for the pack, CSV import etc. */
export function composeAircraft(wing: string, motor?: string | null): string {
  const w = wing.trim();
  const m = (motor ?? "").trim();
  return m ? `${w} / ${m}` : w;
}

/** Wing and motor of an entry; older entries only have the combined text. */
export function splitAircraft(e: { aircraftType: string; wing?: string | null; motor?: string | null }): { wing: string; motor: string } {
  if (e.wing) return { wing: e.wing, motor: e.motor ?? "" };
  const i = e.aircraftType.indexOf(" / ");
  if (i < 0) return { wing: e.aircraftType, motor: "" };
  return { wing: e.aircraftType.slice(0, i).trim(), motor: e.aircraftType.slice(i + 3).trim() };
}

/** Distinct previously used wings / motors (most recent first) for the dropdown suggestions. */
export function aircraftOptionsFrom(
  entries: { aircraftType: string; wing?: string | null; motor?: string | null; date: Date }[]
): { wings: string[]; motors: string[] } {
  const sorted = [...entries].sort((a, b) => b.date.getTime() - a.date.getTime());
  const wings: string[] = [];
  const motors: string[] = [];
  for (const e of sorted) {
    const { wing, motor } = splitAircraft(e);
    if (wing && !wings.includes(wing)) wings.push(wing);
    if (motor && !motors.includes(motor)) motors.push(motor);
  }
  return { wings, motors };
}

export function formatWind(e: { windDirection?: string | null; windSpeed?: string | null }): string {
  return [e.windDirection, e.windSpeed].filter(Boolean).join(" ") || "—";
}
