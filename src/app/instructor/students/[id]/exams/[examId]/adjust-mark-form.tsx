"use client";

import { useActionState, useState } from "react";
import { adjustExamAnswer, type AdjustAnswerState } from "@/lib/actions/exams";

type Option = { id: string; label: string; text: string | null; isCorrect?: boolean };

/** 13 Oct 2026: CFI-only, under each question of an online exam review --
 * mark the question correct in one click, or change the answer, the mark
 * and/or leave a note for the student. Saving re-marks the whole exam
 * (see adjustExamAnswer), so a FAIL can become a PASS. */
export default function AdjustMarkForm({
  attemptId,
  questionId,
  maxMarks,
  autoMarks,
  awardedMarks,
  staffNote,
  options,
  selectedOptionId,
  isCorrected,
}: {
  attemptId: string;
  questionId: string;
  maxMarks: number;
  autoMarks: number;
  awardedMarks: number | null;
  staffNote: string | null;
  options: Option[];
  selectedOptionId: string | null;
  /** Answer, mark or note already changed by the CFI. */
  isCorrected: boolean;
}) {
  const [open, setOpen] = useState(false);
  const bound = adjustExamAnswer.bind(null, attemptId, questionId);
  const [state, formAction, isPending] = useActionState<AdjustAnswerState, FormData>(bound, undefined);
  const [handled, setHandled] = useState<AdjustAnswerState>(undefined);
  if (state !== handled) {
    setHandled(state);
    if (state && "success" in state) setOpen(false);
  }
  const isRight = autoMarks >= maxMarks && awardedMarks === null;

  const quickCorrect = !isRight && options.some((o) => o.isCorrect) && (
    <form action={formAction} className="inline">
      <input type="hidden" name="action" value="correct" />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-green-300 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-60"
      >
        {isPending ? "Saving..." : "✔ Mark correct (full marks)"}
      </button>
    </form>
  );

  if (!open) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {quickCorrect}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-red-600 hover:underline"
        >
          {isCorrected ? "Edit correction" : "Change answer / mark / add note"}
        </button>
        {state && "error" in state && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="block text-xs text-slate-600">
        Answer
        <select
          name="answer"
          defaultValue={selectedOptionId ?? ""}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
        >
          {!selectedOptionId && <option value="">(no answer)</option>}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}. {o.text ?? "(picture)"}
              {o.isCorrect ? "  ✔ correct" : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600">
          Marks (out of {maxMarks})
          <input
            name="marks"
            type="number"
            min={0}
            max={maxMarks}
            step={0.5}
            defaultValue={awardedMarks ?? ""}
            placeholder="automatic"
            className="mt-1 block w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <span className="pb-1 text-xs text-slate-500">
          Leave blank for the automatic mark: full marks if the answer above is correct, else 0.
        </span>
      </div>
      <label className="block text-xs text-slate-600">
        Note to the student (shown with their results)
        <textarea
          name="note"
          rows={2}
          defaultValue={staffNote ?? ""}
          placeholder="e.g. Discussed -- your reasoning was right, marked correct."
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      {state && "error" in state && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save & re-mark"}
        </button>
        {isCorrected && (
          <button
            type="submit"
            name="reset"
            value="1"
            disabled={isPending}
            className="text-sm text-slate-600 hover:text-red-600"
          >
            Undo correction (student&apos;s own answer)
          </button>
        )}
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">
          Cancel
        </button>
      </div>
    </form>
  );
}
