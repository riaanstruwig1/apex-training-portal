"use client";

import { useActionState, useState, useTransition } from "react";
import { uploadOwnPop, requestOwnInvoice } from "@/lib/actions/payment";

/**
 * Student's own Proof-of-Payment upload, with an "unpaid" state that points
 * them to the office rather than showing bank details in-app (per Riaan,
 * 16 Sep 2026) plus a one-click "request an invoice" that just flags the
 * office -- no document generated.
 */
export default function PopPaymentPanel({
  popFile,
  popUploadedAt,
  invoiceRequestedAt,
}: {
  popFile: string | null;
  popUploadedAt: Date | null;
  invoiceRequestedAt: Date | null;
}) {
  const [state, formAction, isUploading] = useActionState(uploadOwnPop, undefined);
  const [isRequesting, startRequest] = useTransition();
  const [requestedNow, setRequestedNow] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-2 text-sm font-semibold text-slate-900">Proof of payment</h2>

      {popFile && !state?.success ? (
        <p className="mb-3 text-sm text-slate-600">
          On file{popUploadedAt ? ` since ${popUploadedAt.toLocaleDateString()}` : ""} -- upload a
          new copy below if you need to replace it.
        </p>
      ) : (
        <p className="mb-3 text-sm text-slate-500">
          Upload your Proof of Payment here for safekeeping once you&apos;ve paid your training
          fees.
        </p>
      )}

      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="popFile"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          required
          className="text-sm"
        />
        <button
          type="submit"
          disabled={isUploading}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isUploading ? "Uploading..." : "Upload"}
        </button>
      </form>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="mt-2 text-sm text-green-700">Uploaded -- thank you.</p>}

      <div className="mt-4 rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-600">
        <p className="font-medium text-slate-700">Haven&apos;t paid yet?</p>
        <p className="mt-1">Please contact the office for payment details.</p>
        {invoiceRequestedAt || requestedNow ? (
          <p className="mt-2 text-xs text-green-700">
            Invoice requested{invoiceRequestedAt ? ` on ${invoiceRequestedAt.toLocaleDateString()}` : ""}
            {" "}-- the office has been notified.
          </p>
        ) : (
          <button
            type="button"
            disabled={isRequesting}
            onClick={() =>
              startRequest(async () => {
                const result = await requestOwnInvoice();
                if (result?.error) setRequestError(result.error);
                else setRequestedNow(true);
              })
            }
            className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {isRequesting ? "Requesting..." : "Request an invoice"}
          </button>
        )}
        {requestError && <p className="mt-1 text-xs text-red-600">{requestError}</p>}
      </div>
    </div>
  );
}
