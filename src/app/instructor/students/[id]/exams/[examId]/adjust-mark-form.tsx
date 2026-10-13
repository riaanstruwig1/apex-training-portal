"use client";

import { useActionState, useState } from "react";
import { adjustExamAnswer, type AdjustAnswerState } from "@/lib/actions/exams";

/** 13 Oct 2026: CFI-only, under each question of an online exam review --
 * change the mark and/or leave a note for the student. Saving re-marks the
 * whole exam (see adjustExamAnswer). */
export default function AdjustMarkForm({
  attemptId,
  questionId,
  maxMarks,
  autoMarks,
  awardedMarks,
  staffNote,
}: {
  attemptId: string;
  questionId: string;
  maxMarks: number;
  autoMarks: number;
  awardedMarks: number | null;
  staffNote: string | null;
}) {
  const [open, setOpen] = useState(false);
  const bound = adjustExamAnswer.bind(null, attemptId, questionId);
  const [state, formAction, isPending] = useActionState<AdjustAnswerState, FormData>(bound, undefined);
  const [handled, setHandled] = useState<AdjustAnswerState>(undefined);
  if (state !== handled) {
    setHandled(state);
    if (state && "success" in state) setOpen(false);
  }
  const adjusted = awardedMarks !== null || !!staffNote;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-xs font-medium text-red-600 hover:underline"
      >
        {adjusted ? "Edit mark / note" : "Adjust mark / add note"}
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
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
            placeholder={`${autoMarks} (automatic)`}
            className="mt-1 block w-36 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <span className="pb-1 text-xs text-slate-500">Leave blank to use the automatic mark ({autoMarks}).</span>
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
        {adjusted && (
          <button
            type="submit"
            name="reset"
            value="1"
            disabled={isPending}
            className="text-sm text-slate-600 hover:text-red-600"
          >
            Reset to automatic
          </button>
        )}
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">
          Cancel
        </button>
      </div>
    </form>
  );
}
