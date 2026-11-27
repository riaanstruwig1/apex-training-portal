"use client";

import { useActionState } from "react";
import { setSafetyOfficer, type SafetyState } from "@/lib/actions/safety";

/** Batch 108: who (besides the CFI) may send safety notices. */
export default function SafetyOfficerForm({ current, staff }: { current: string | null; staff: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<SafetyState, FormData>(setSafetyOfficer, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="block flex-1 text-xs font-medium text-slate-600">
        Safety Officer
        <select name="safetyOfficerUserId" defaultValue={current ?? ""} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">-- none (only the CFI sends) --</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
        {pending ? "Saving..." : "Save"}
      </button>
      {state?.success && <span className="text-sm text-green-700">{state.success}</span>}
      {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
    </form>
  );
}
