"use client";

import { useActionState } from "react";
import { submitCaaLicence, type CaaLicenceState } from "@/lib/actions/profile";

const input = "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";

/** Student/pilot submits their own CAA licence. With `studentId` (batch 89)
 * a CFI/instructor/admin adds it for a signed-off student instead. */
export default function CaaLicenceForm({
  defaultSacaa,
  studentId,
  studentName,
}: {
  defaultSacaa: string;
  studentId?: string;
  studentName?: string;
}) {
  const [state, action, pending] = useActionState<CaaLicenceState, FormData>(submitCaaLicence, undefined);
  const staff = !!studentId;
  if (state?.success) {
    return (
      <p className="mt-3 rounded-md border border-green-300 bg-green-50 p-3 text-sm font-semibold text-green-800">
        {staff
          ? `SACAA licence added -- ${studentName ?? "the student"} has moved to the Pilots list.`
          : "Thank you - your CAA licence has been submitted."}
      </p>
    );
  }
  return (
    <form action={action} className="mt-3 space-y-3 rounded-md border border-amber-300 bg-white p-3">
      {staff && <input type="hidden" name="studentId" value={studentId} />}
      <p className="text-sm font-semibold text-amber-900">{staff ? "Add the SACAA licence" : "Submit your CAA licence"}</p>
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
        {staff ? "Upload the CAA licence (PDF or photo)" : "Upload your CAA licence (PDF or photo)"}
        <input type="file" name="caaLicenceFile" required accept="application/pdf,image/*" className={input} />
      </label>
      {state?.error && <p className="text-sm font-semibold text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
        {pending ? "Submitting..." : staff ? "Add licence and move to Pilots" : "Submit"}
      </button>
    </form>
  );
}
