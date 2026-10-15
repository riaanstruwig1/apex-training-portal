"use client";

import { useActionState } from "react";
import { submitCaaLicence, type CaaLicenceState } from "@/lib/actions/profile";

const input = "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";

export default function CaaLicenceForm({ defaultSacaa }: { defaultSacaa: string }) {
  const [state, action, pending] = useActionState<CaaLicenceState, FormData>(submitCaaLicence, undefined);
  if (state?.success) {
    return <p className="mt-3 rounded-md border border-green-300 bg-green-50 p-3 text-sm font-semibold text-green-800">Thank you - your CAA licence has been submitted.</p>;
  }
  return (
    <form action={action} className="mt-3 space-y-3 rounded-md border border-amber-300 bg-white p-3">
      <p className="text-sm font-semibold text-amber-900">Submit your CAA licence</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-700">
          SACAA licence No. (027...)
          <input name="sacaaNumber" required defaultValue={defaultSacaa} className={input} />
        </label>
        <label className="block text-xs font-medium text-slate-700">
          Licence expiry date (optional)
          <input type="date" name="caaLicenceExpiryDate" className={input} />
        </label>
      </div>
      <label className="block text-xs font-medium text-slate-700">
        Upload your CAA licence (PDF or photo)
        <input type="file" name="caaLicenceFile" required accept="application/pdf,image/*" className={input} />
      </label>
      {state?.error && <p className="text-sm font-semibold text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
        {pending ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
