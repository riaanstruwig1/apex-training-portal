"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deletePaperExamAttempt,
  replacePaperExamProof,
  type ReplacePaperProofState,
} from "@/lib/actions/exams";

/** "V24" item 73 (28 Sep 2026 renumbering): next to "View what was
 * submitted" on a paper-exam/radio-licence review, gives the instructor
 * Delete (remove the submission so the student can redo it) and a direct
 * replacement upload (swap in a corrected scan without making the student
 * resubmit from scratch). */
export default function PaperAttemptAdminActions({
  attemptId,
  studentId,
}: {
  attemptId: string;
  studentId: string;
}) {
  const [mode, setMode] = useState<"idle" | "confirmDelete" | "upload">("idle");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const boundReplace = replacePaperExamProof.bind(null, attemptId);
  const [state, formAction, uploadPending] = useActionState<ReplacePaperProofState, FormData>(
    boundReplace,
    undefined
  );

  if (state && "success" in state && state.success && mode !== "idle") {
    // Reset back to the plain button row once the replacement has saved.
    setMode("idle");
  }

  if (mode === "confirmDelete") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-600">Delete this submission? The student can resubmit.</span>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await deletePaperExamAttempt(attemptId);
              router.push(`/instructor/students/${studentId}`);
              router.refresh();
            })
          }
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "Deleting..." : "Yes, delete"}
        </button>
        <button
          type="button"
          onClick={() => setMode("idle")}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (mode === "upload") {
    return (
      <form
        action={formAction}
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        <input
          type="file"
          name="proofFile"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          required
          className="text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        <button
          type="submit"
          disabled={uploadPending}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
        >
          {uploadPending ? "Uploading..." : "Save replacement"}
        </button>
        <button
          type="button"
          onClick={() => setMode("idle")}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
        {state && "error" in state && state.error && (
          <span className="w-full text-xs text-red-600">{state.error}</span>
        )}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setMode("upload")}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        New upload
      </button>
      <button
        type="button"
        onClick={() => setMode("confirmDelete")}
        className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Delete
      </button>
    </div>
  );
}
