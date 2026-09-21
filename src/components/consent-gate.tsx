"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOwnConsentAndIndemnity } from "@/lib/actions/consent";

/**
 * Hard gate shown instead of the dashboard when a student/pilot account has
 * never signed the Consent & Indemnity forms (Notes3 item 9) -- happens
 * when a CFI/Admin created the account directly rather than the person
 * going through public /signup, which collects both signatures up front.
 * Blocks the whole role area (wired into StudentLayout/PilotLayout), not
 * just this one page, until both are signed.
 */
export default function ConsentGate({
  name,
  hasSignature,
}: {
  name: string;
  hasSignature?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(signOwnConsentAndIndemnity, undefined);
  const router = useRouter();
  const signed = !!(state && "success" in state && state.success);

  useEffect(() => {
    if (signed) router.refresh();
  }, [signed, router]);

  if (signed) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-green-200 bg-green-50 p-6 text-center text-sm text-green-800">
        Signed -- loading your dashboard...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-amber-300 bg-amber-50 p-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Welcome, {name.split(" ")[0]} -- one more step
        </h1>
        <p className="mt-1 text-sm text-slate-700">
          Before you can use your account, please sign the Client Consent Form and the
          Indemnity / Assumption of Risk &amp; Release. Type your full name in each box below to
          sign electronically -- same legal effect as a handwritten signature on these forms.
        </p>
      </div>
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="consentName" className="block text-sm font-medium text-slate-700">
            Client Consent Form -- sign by typing your full name
          </label>
          <p className="mt-1 text-xs">
            <a
              href="/documents/sacaa-client-consent-form.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-red-600 underline hover:text-red-700"
            >
              View / download the document
            </a>{" "}
            <span className="text-slate-500">
              -- the official SACAA CA 183-540 form -- read it before you sign, if you&rsquo;d like to.
            </span>
          </p>
          {hasSignature && (
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <img
                src="/api/signature"
                alt="Your saved signature"
                className="h-8 rounded border border-slate-200 bg-white object-contain p-1"
              />
              Using your saved signature on file.
            </p>
          )}
          <input
            id="consentName"
            name="consentName"
            required
            defaultValue={hasSignature ? name : undefined}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="indemnityName" className="block text-sm font-medium text-slate-700">
            Indemnity / Assumption of Risk &amp; Release -- sign by typing your full name
          </label>
          <p className="mt-1 text-xs">
            <a
              href="/documents/indemnity-assumption-of-risk.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-red-600 underline hover:text-red-700"
            >
              View / download the document
            </a>{" "}
            <span className="text-slate-500">-- read it before you sign, if you&rsquo;d like to.</span>
          </p>
          {hasSignature && (
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <img
                src="/api/signature"
                alt="Your saved signature"
                className="h-8 rounded border border-slate-200 bg-white object-contain p-1"
              />
              Using your saved signature on file.
            </p>
          )}
          <input
            id="indemnityName"
            name="indemnityName"
            required
            defaultValue={hasSignature ? name : undefined}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        {state && "error" in state && state.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "Signing..." : "Sign & continue"}
        </button>
      </form>
    </div>
  );
}
