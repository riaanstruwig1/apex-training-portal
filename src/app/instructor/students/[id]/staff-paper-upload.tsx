"use client";

import { useActionState, useState } from "react";
import { staffSubmitPaperExam, type StaffPaperUploadState } from "@/lib/actions/exams";

/** 9 Oct 2026: on the CFI/instructor's view of a student's folio, lets
 * staff upload a paper exam (or radio licence) for the student and, if they
 * like, record the result in the same step. See staffSubmitPaperExam. */
export default function StaffPaperUpload({
  studentId,
  examId,
  isRadio,
  label,
}: {
  studentId: string;
  examId: string;
  isRadio: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const bound = staffSubmitPaperExam.bind(null, studentId, examId);
  const [state, formAction, isPending] = useActionState<StaffPaperUploadState, FormData>(
    bound,
    undefined
  );

  // Close the form once an upload has saved. (After a FAIL the button stays
  // on the card for the retake, so it must go back to its closed state.)
  const [handled, setHandled] = useState<StaffPaperUploadState>(undefined);
  if (state !== handled) {
    setHandled(state);
    if (state && "success" in state) setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {label}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="w-full space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:w-96"
    >
      <label className="block text-sm">
        <span className="font-medium text-slate-700">
          {isRadio ? "Scanned paper exam or SACAA radio licence" : "Scanned paper exam"}
        </span>
        <input
          name="proofFile"
          type="file"
          required
          accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif"
          className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
        />
        <span className="mt-1 block text-xs text-slate-500">PDF or photo, max 10MB.</span>
      </label>
      {isRadio && (
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Radio licence number (if it&apos;s a licence)</span>
          <input
            name="licenseNumber"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
      )}
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Result</span>
        <select
          name="result"
          defaultValue="pending"
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="pending">Mark later (awaiting review)</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
        </select>
      </label>
      {state && "error" in state && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "Uploading..." : "Upload"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
