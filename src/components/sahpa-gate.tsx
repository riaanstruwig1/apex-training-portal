"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveOwnSahpaNumber, type SahpaGateState } from "@/lib/actions/sahpa";
import SahpaSignupNote from "@/components/sahpa-signup-note";

/** Hard gate: a student without a SAHPA number can't use the Hub (e.g. log flights) until one is loaded. */
export default function SahpaGate({ name }: { name: string }) {
  const [state, action, pending] = useActionState<SahpaGateState, FormData>(saveOwnSahpaNumber, undefined);
  const router = useRouter();
  const done = !!(state && "success" in state && state.success);
  useEffect(() => {
    if (done) router.refresh();
  }, [done, router]);

  if (done) {
    return <div className="mx-auto max-w-lg rounded-xl border border-green-200 bg-green-50 p-6 text-center text-sm text-green-800">Saved - loading your portfolio...</div>;
  }
  const input = "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-slate-900">Welcome, {name.split(" ")[0]} - your SAHPA number is needed</h1>
        <p className="mt-1 text-sm text-slate-700">
          You can&apos;t log flights or continue until your SAHPA membership number is loaded. If you don&apos;t have one yet, follow the
          steps below, then enter the number here.
        </p>
        <form action={action} className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            SAHPA membership No.
            <input name="sahpaNumber" required className={input} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            SAHPA membership expiry date (optional)
            <input type="date" name="sahpaExpiryDate" className={input} />
          </label>
          {state?.error && <p className="text-sm font-semibold text-red-700">{state.error}</p>}
          <button type="submit" disabled={pending} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {pending ? "Saving..." : "Save and continue"}
          </button>
        </form>
      </div>
      <SahpaSignupNote />
    </div>
  );
}
