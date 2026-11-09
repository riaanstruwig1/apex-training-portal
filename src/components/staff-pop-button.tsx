"use client";

import { useActionState, useRef } from "react";
import { staffUploadPop, type PopFormState } from "@/lib/actions/payment";

/** Batch 96 (Riaan, 9 Nov 2026): under the student's name on the CFI's
 * student page (and on the full profile) -- "Course paid" with the POP to
 * view when one is on file, otherwise an "Upload POP" button so the CFI can
 * load the POPs of students who paid before the Hub had the upload. */
export default function StaffPopButton({
  studentId,
  popFile,
  popUploadedAt,
  canUpload,
}: {
  studentId: string;
  popFile: string | null;
  popUploadedAt: Date | null;
  canUpload: boolean;
}) {
  const bound = staffUploadPop.bind(null, studentId);
  const [state, formAction, isPending] = useActionState<PopFormState, FormData>(bound, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      {popFile ? (
        <>
          <span className="rounded-full bg-green-100 px-2.5 py-1 font-semibold text-green-800">
            &#10003; Course paid
            {popUploadedAt ? <span className="font-normal"> - POP uploaded {popUploadedAt.toLocaleDateString()}</span> : null}
          </span>
          <a
            href={`/api/uploads/${studentId}/${popFile}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-green-600 px-3 py-1 font-semibold text-white hover:bg-green-700"
          >
            View POP
          </a>
        </>
      ) : (
        <span className="rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700">Course paid: no POP on file</span>
      )}
      {canUpload && (
        <form ref={formRef} action={formAction} className="inline">
          <input
            ref={inputRef}
            type="file"
            name="popFile"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
            className="hidden"
            aria-label="Proof of payment file"
            onChange={(e) => {
              if (e.currentTarget.files?.length) formRef.current?.requestSubmit();
            }}
          />
          <button
            type="button"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
            className={
              popFile
                ? "rounded-md border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                : "rounded-md bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            }
          >
            {isPending ? "Uploading..." : popFile ? "Replace POP" : "Upload POP"}
          </button>
        </form>
      )}
      {state?.error && <span className="font-semibold text-red-600">{state.error}</span>}
      {state?.success && <span className="font-semibold text-green-700">POP saved.</span>}
    </div>
  );
}
