"use client";

import { useActionState, useState } from "react";
import { setExamResultOverride, type ResultOverrideState } from "@/lib/actions/exams";

/** 13 Oct 2026: CFI-only -- set the exam's final result to PASS or FAIL
 * regardless of the calculated one (e.g. 99.5% failed only on the Airlaw
 * must-pass rule), with a note the student sees. Also verifies an
 * unverified attempt. "Back to calculated result" removes it. */
export default function ResultOverrideForm({
  attemptId,
  current,
  currentNote,
}: {
  attemptId: string;
  current: "pass" | "fail" | null;
  currentNote: string | null;
}) {
  const [open, setOpen] = useState(false);
  const bound = setExamResultOverride.bind(null, attemptId);
  const [state, formAction, isPending] = useActionState<ResultOverrideState, FormData>(bound, undefined);
  const [handled, setHandled] = useState<ResultOverrideState>(undefined);
  if (state !== handled) {
    setHandled(state);
    if (state && "success" in state) setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {current ? "Change final result" : "Set final result (PASS / FAIL)"}
      </button>
    );
  }

  return (
    <form action={formAction} className="w-full space-y-2 rounded-lg border border-slate-200 bg-white p-3 sm:w-96">
      <div className="text-sm font-semibold text-slate-900">Final result (CFI decision)</div>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" name="result" value="pass" defaultChecked={current !== "fail"} /> PASS
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="result" value="fail" defaultChecked={current === "fail"} /> FAIL
        </label>
      </div>
      <label className="block text-xs text-slate-600">
        Note to the student (required)
        <textarea
          name="note"
          rows={2}
          defaultValue={currentNote ?? ""}
          placeholder="e.g. Airlaw answer discussed and accepted -- passed by the CFI."
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
          {isPending ? "Saving..." : "Save final result"}
        </button>
        {current && (
          <button
            type="submit"
            name="clear"
            value="1"
            disabled={isPending}
            className="text-sm text-slate-600 hover:text-red-600"
          >
            Back to calculated result
          </button>
        )}
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">
          Cancel
        </button>
      </div>
    </form>
  );
}
