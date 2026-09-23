"use client";

import { useActionState } from "react";
import { submitRenewedLicence } from "@/lib/actions/licence-renewal";

/**
 * Hard gate shown instead of the pilot dashboard once a pilot's CAA licence
 * expiry date (caaLicenceExpiryDate) has passed (V22 rollout items 6/7,
 * 23 Sep 2026 -- Riaan's answer to "what should happen when it passes":
 * "Hard lock until reviewed (Recommended)"). Mirrors ConsentGate's
 * structure/wiring into PilotLayout, scoped the same way -- pilot accounts
 * only, never a CFI/instructor who also has a pilot profile.
 *
 * Unlike ConsentGate, submitting here doesn't unlock the account itself:
 * it only replaces the on-file licence document. A CFI/Admin still has to
 * review it and push caaLicenceExpiryDate forward (Edit details & documents
 * on the applicant page) before the gate clears -- there's no separate
 * "pending review" flag on the account, so a pilot who submits and comes
 * back later will see this same screen again until that review happens.
 */
export default function LicenceExpiredGate({ expiredOn }: { expiredOn: Date }) {
  const [state, formAction, isPending] = useActionState(submitRenewedLicence, undefined);
  const submitted = !!(state && "success" in state && state.success);

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-amber-300 bg-amber-50 p-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Your flying licence has expired</h1>
        <p className="mt-1 text-sm text-slate-700">
          Your CAA licence on file expired on {expiredOn.toLocaleDateString()}. Your account is
          locked until your CFI or Admin reviews a renewed licence -- please submit a copy below.
        </p>
      </div>

      {submitted ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Submitted -- your CFI or Admin will review it and update your account. You&rsquo;ll see this
          screen again until that&rsquo;s done.
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="caaLicenceFile" className="block text-sm font-medium text-slate-700">
              Renewed CAA licence
            </label>
            <input
              id="caaLicenceFile"
              name="caaLicenceFile"
              type="file"
              required
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>
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
        </form>
      )}
    </div>
  );
}
