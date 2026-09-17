/**
 * The checklist offered on a flight log entry ("Exercises covered"). This is
 * Riaan's own flight-log exercise list -- separate from the DTO Appendix A
 * syllabus in src/db/schema.ts's `exercises` table, which drives section
 * gating/sign-off on the Training folio. The two lists cover different
 * things (this one logs what was practiced on a specific flight; the
 * syllabus tracks formal sign-off progress) and aren't meant to line up
 * code-for-code, so this is a plain static list rather than a DB table.
 */
export const LOGBOOK_EXERCISES: { code: string; label: string }[] = [
  { code: "1", label: "Forward launch / Power trike" },
  { code: "2", label: "Reverse launch" },
  { code: "3", label: "Straight and level flight with power control" },
  { code: "4", label: "S turns and fig of 8" },
  { code: "5", label: "90 deg and 180 turns" },
  { code: "6", label: "360 turns maintaining height" },
  { code: "7", label: "360 turns loosing height, power off" },
  { code: "8", label: "Pendulum control" },
  { code: "9", label: "Thermic flying" },
  { code: "10", label: "Spot landing within 50m OD" },
  { code: "11", label: "Spot landing within 25m OD" },
  { code: "12", label: "XC flight" },
  { code: "13", label: "Throttle control exercises" },
  { code: "14", label: "Power off landing" },
  { code: "15", label: "Power on landing" },
  { code: "16", label: "Touch and go" },
];
