// V24 item 74 (1 Oct 2026): the CFI picks which dashboard box (1-4) a study
// note sits in, next to the matching exam. Box numbers follow Riaan's own
// example order -- and each box is tied to an exam, not a screen position,
// so a note stays next to the right exam even when a student's training
// type hides some exams. Client-safe (used by the CFI editor too).

import type { ExamCategoryKey } from "@/lib/exam-category-key";

export type StudyNoteBox = 1 | 2 | 3 | 4;

export const STUDY_NOTE_BOXES: { box: StudyNoteBox; category: ExamCategoryKey; label: string }[] = [
  { box: 1, category: "pg", label: "1 — next to Basic Licence (PG) exam" },
  { box: 2, category: "ppg", label: "2 — next to PPG Theory exam" },
  { box: 3, category: "rt", label: "3 — next to DTO Restricted Radio exam" },
  { box: 4, category: "ppt", label: "4 — next to PPT Theory exam" },
];

/** Dashboard exam rows run in this order (Riaan's example: Basic Licence,
 * PPG, DTO Radio, PPT). */
export const DASHBOARD_EXAM_ORDER: ExamCategoryKey[] = ["pg", "ppg", "rt", "ppt"];

export function boxForCategory(category: ExamCategoryKey): StudyNoteBox {
  return STUDY_NOTE_BOXES.find((b) => b.category === category)!.box;
}

export function categoryForBox(box: number | null | undefined): ExamCategoryKey | null {
  return STUDY_NOTE_BOXES.find((b) => b.box === box)?.category ?? null;
}
