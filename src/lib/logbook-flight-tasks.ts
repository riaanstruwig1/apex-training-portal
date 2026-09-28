/**
 * "V23" item 11 (25 Sep 2026): on the PILOT side of the flight logbook only
 * (not the student side -- Riaan's own note: "Pilot LOG book. NOT Student
 * logbook"), the "Exercises covered" checklist is replaced with a fixed list
 * of flight tasks, and the field itself is relabelled "Flight Task". This is
 * a completely separate list from LOGBOOK_EXERCISES (student side) and from
 * the DTO Appendix A syllabus -- same "different lists for different things,
 * not meant to line up" reasoning as logbook-exercises.ts's own note.
 *
 * Stored in the exact same `flightLogEntries.exerciseCodesCovered` column as
 * the student-side exercise codes -- these codes are plain words ("solo",
 * "xc", ...) rather than the student list's bare numbers, so the two never
 * collide and lib/logbook-format.ts's lookup can serve both from one map
 * without needing to know which "mode" a given row was logged under.
 */
export const PILOT_FLIGHT_TASKS: { code: string; label: string }[] = [
  { code: "solo", label: "Solo flight" },
  { code: "xc", label: "XC Flight" },
  { code: "tandem", label: "Tandem flight" },
  { code: "tfi", label: "Tandem Flight Instruction (TFI)" },
  { code: "skill_test", label: "Skill test flight" },
  { code: "renewal", label: "Renewal flight" },
  { code: "equipment_test", label: "Equipment test flight" },
  { code: "display", label: "Display flight" },
];
