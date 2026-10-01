// Section tags for the syllabus (V24 items 75-77, 1 Oct 2026). Pure helpers,
// no "server-only" guard -- the Manage Syllabus editor (a client component)
// uses these too.
//
// Every syllabus section carries:
//  - a training type: PG / PPG / PPT, or "all" (applies to every student)
//  - a phase: Phase 1 / 2 / 3, Conversion (CV) or Practical Theory (PT)
//
// A student only sees sections for the training type(s) they signed up for
// (plus "all" sections). Display order everywhere -- CFI folio, student
// dashboard, student folio -- is: grouped by training type (General first,
// then PG, PPG, PPT), and within each group Phase 1 -> 2 -> 3 -> Conversion
// -> Practical Theory, then the CFI's own section order.

import { parseTrainingTypes, type TrainingType } from "@/lib/training-types";

export type SectionTrainingType = TrainingType | "all";
export type SectionPhase = "p1" | "p2" | "p3" | "cv" | "pt";

export const SECTION_TRAINING_TYPES: SectionTrainingType[] = ["pg", "ppg", "ppt", "all"];
export const SECTION_PHASES: SectionPhase[] = ["p1", "p2", "p3", "cv", "pt"];

export const SECTION_TRAINING_TYPE_LABELS: Record<SectionTrainingType, string> = {
  pg: "PG training",
  ppg: "PPG training",
  ppt: "PPT training",
  all: "Applicable to all",
};

/** Group headings on the folio / dashboard. */
export const SECTION_GROUP_LABELS: Record<SectionTrainingType, string> = {
  all: "General (all training types)",
  pg: "PG — Paragliding",
  ppg: "PPG — Powered Paragliding",
  ppt: "PPT — Powered Paratrike",
};

export const SECTION_PHASE_LABELS: Record<SectionPhase, string> = {
  p1: "Phase 1 training",
  p2: "Phase 2 training",
  p3: "Phase 3 training",
  cv: "Conversion training (CV)",
  pt: "Practical Theory (PT)",
};

export const SECTION_PHASE_SHORT: Record<SectionPhase, string> = {
  p1: "Phase 1",
  p2: "Phase 2",
  p3: "Phase 3",
  cv: "Conversion",
  pt: "Practical Theory",
};

const GROUP_ORDER: SectionTrainingType[] = ["all", "pg", "ppg", "ppt"];

export function isSectionTrainingType(v: unknown): v is SectionTrainingType {
  return typeof v === "string" && (SECTION_TRAINING_TYPES as string[]).includes(v);
}
export function isSectionPhase(v: unknown): v is SectionPhase {
  return typeof v === "string" && (SECTION_PHASES as string[]).includes(v);
}

/** Sort key: training-type group, then phase, then the CFI's own order. */
export function compareSections(
  a: { trainingType: string; phase: string; order: number },
  b: { trainingType: string; phase: string; order: number }
): number {
  const g =
    GROUP_ORDER.indexOf(a.trainingType as SectionTrainingType) -
    GROUP_ORDER.indexOf(b.trainingType as SectionTrainingType);
  if (g !== 0) return g;
  const p =
    SECTION_PHASES.indexOf(a.phase as SectionPhase) - SECTION_PHASES.indexOf(b.phase as SectionPhase);
  if (p !== 0) return p;
  return a.order - b.order;
}

/** Does a section apply to a student with this (stored, comma-separated)
 * training type? A student with nothing declared yet sees every section --
 * same "don't hide things unexpectedly" rule as exams (lib/exams.ts). */
export function sectionAppliesTo(
  sectionTrainingType: string,
  studentTrainingTypeRaw: string | null | undefined
): boolean {
  if (sectionTrainingType === "all") return true;
  const types = parseTrainingTypes(studentTrainingTypeRaw);
  if (types.length === 0) return true;
  return (types as string[]).includes(sectionTrainingType);
}

/** Code prefix for new exercises in a section, per Riaan's format:
 * "Section PG/PPG/PPT - P[1] or CV or PT - Ex[No]" -> e.g. "PPG-P1-Ex". An
 * "Applicable to all" section uses "GEN". */
export function exerciseCodePrefix(trainingType: string, phase: string): string {
  const t = trainingType === "all" ? "GEN" : trainingType.toUpperCase();
  const p = phase === "cv" ? "CV" : phase === "pt" ? "PT" : phase.toUpperCase();
  return `${t}-${p}-Ex`;
}

/** Next free default code for a section, e.g. "PPG-P1-Ex8", given every
 * existing exercise code in the syllabus (codes are unique syllabus-wide). */
export function suggestExerciseCode(
  trainingType: string,
  phase: string,
  allCodes: string[]
): string {
  const prefix = exerciseCodePrefix(trainingType, phase);
  let max = 0;
  for (const code of allCodes) {
    if (code.startsWith(prefix)) {
      const n = parseInt(code.slice(prefix.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `${prefix}${max + 1}`;
}

/** How an exercise is shown everywhere: new-style codes read
 * "PPG-P1-Ex8 / Straight glide"; older plain codes keep "Ex 8 — Straight glide". */
export function exerciseLabel(code: string, title: string): string {
  return /^(PG|PPG|PPT|GEN)-(P\d|CV|PT)-Ex/i.test(code) ? `${code} / ${title}` : `Ex ${code} — ${title}`;
}
