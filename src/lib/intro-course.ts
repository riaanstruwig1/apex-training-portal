/**
 * "PG/PPG Intro training" (19 Oct 2026, Riaan). A student who signs up for
 * the intro course (student_profiles.course_level = "intro"):
 *  - trains on Phase 1 only: their folio shows Phase 1 sections as normal;
 *    Phase 2, Phase 3, conversion and theory sections are shown as a
 *    "shadow" -- visible, not applicable, not counted in progress;
 *  - has a normal logbook;
 *  - sees the study notes and exams but can't open, download or write them;
 *  - can "Sign up for Phase 2" (choosing PG, PPG and/or PPT). A CFI
 *    approves it -> course_level "full": a normal student with the chosen
 *    training types, keeping their logbook and Phase 1 sign-offs, and they
 *    get a WhatsApp.
 * Intro students are stored with training type "pg,ppg" so the PG and PPG
 * Phase 1 sections apply. Safe to import from client components.
 */
import type { TrainingType } from "@/lib/training-types";

export const INTRO_LABEL = "PG/PPG Intro training";
export const INTRO_TRAINING_TYPES: TrainingType[] = ["pg", "ppg"];
/** Section phases an intro student trains on (see SECTION_PHASES). */
export const INTRO_OPEN_PHASES = ["p1"] as const;
export const INTRO_LOCK_TEXT = "Available once you sign up for Phase 2";

export function isIntroCourse(courseLevel: string | null | undefined): boolean {
  return courseLevel === "intro";
}

/** A section an intro student can see but not train on yet. */
export function isShadowSection(
  courseLevel: string | null | undefined,
  phase: string | null | undefined
): boolean {
  return isIntroCourse(courseLevel) && !(INTRO_OPEN_PHASES as readonly string[]).includes(phase ?? "p1");
}
