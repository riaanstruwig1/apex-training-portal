"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { promotePilotToInstructor, type PromotePilotState, type PromotablePilot } from "@/lib/actions/instructors";

/** Notes4 item 13: promote an existing pilot straight to instructor, instead
 * of only being able to invite a brand-new account. Redirects to their
 * profile review page on success so the CFI can set their instructor
 * ratings (the new three-column grid, Notes4 item 15) right away. */
export default function PromotePilotForm({ pilots }: { pilots: PromotablePilot[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<PromotePilotState, FormData>(
    async (prevState, formData) => {
      const result = await promotePilotToInstructor(prevState, formData);
      if (result?.instructorUserId) {
        router.push(`/admin/applicants/${result.instructorUserId}`);
      }
      return result;
    },
    undefined
  );

  if (pilots.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No existing pilots are eligible to promote right now -- only active pilot accounts
        (not students, and not already staff) show up here.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="pilotUserId" className="block text-sm font-medium text-slate-700">
          Pilot to promote
        </label>
        <select
          id="pilotUserId"
          name="pilotUserId"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="">Select a pilot...</option>
          {pilots.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.email})
            </option>
          ))}
        </select>
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "Promoting..." : "Promote to instructor"}
      </button>
    </form>
  );
}
