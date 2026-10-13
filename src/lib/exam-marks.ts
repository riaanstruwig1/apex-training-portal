// Marks per question, shared by the CFI review page, the student's results,
// the marked-exam .docx and re-scoring (13 Oct 2026). Client-safe.
//
// A question's mark is the CFI's adjusted mark when one is set, otherwise
// the automatic mark: full marks if the student's chosen option is correct,
// else 0.
export function effectiveMarks(q: {
  marks: number;
  selectedOptionId: string | null;
  awardedMarks?: number | null;
  options: { id: string; isCorrect?: boolean }[];
}): number {
  if (q.awardedMarks !== null && q.awardedMarks !== undefined) return q.awardedMarks;
  const selected = q.options.find((o) => o.id === q.selectedOptionId);
  return selected?.isCorrect ? q.marks : 0;
}

export function formatMarks(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, "");
}
