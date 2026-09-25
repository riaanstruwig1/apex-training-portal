"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { submitPaperExam, type SubmitPaperExamState } from "@/lib/actions/exams";

export default function PaperExamForm({
  examId,
  isRadio,
}: {
  examId: string;
  isRadio: boolean;
}) {
  const boundAction = submitPaperExam.bind(null, examId);
  const [state, formAction, isPending] = useActionState<SubmitPaperExamState, FormData>(
    boundAction,
    undefined
  );
  // The action returns `undefined` both before any submit and right after
  // a successful one (there's nothing else to report), so a plain
  // `hasSubmitted` flag is what tells those two apart -- flipped in the
  // form's own onSubmit, before the action runs.
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const succeeded = hasSubmitted && !isPending && !state?.error;

  if (succeeded) {
    return (
      <div className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-800">
        <p className="font-semibold">Submitted for review.</p>
        <p>Your CFI or Admin will check it and mark the exam pass or fail.</p>
        <Link
          href={`/student/exams/${examId}`}
          className="inline-block rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-100"
        >
          Back to exam status
        </Link>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={() => setHasSubmitted(true)}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
    >
      <div>
        <label htmlFor="proofFile" className="block text-sm font-medium text-slate-700">
          {isRadio
            ? "Photo or scan of your SACAA radio licence"
            : "Photo or scan of the completed paper exam"}
        </label>
        <input
          id="proofFile"
          name="proofFile"
          type="file"
          required
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
      </div>
      {isRadio && (
        <div>
          <label htmlFor="licenseNumber" className="block text-sm font-medium text-slate-700">
            Radio licence number
          </label>
          <input
            id="licenseNumber"
            name="licenseNumber"
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
      )}
      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {isPending ? "Submitting..." : "Submit for review"}
      </button>
      <p className="text-xs text-slate-500">
        Your CFI or Admin will review this and mark the exam pass or fail -- it won&rsquo;t show
        as passed until they do.
      </p>
    </form>
  );
}
