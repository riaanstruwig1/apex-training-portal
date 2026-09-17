"use client";

import { useActionState } from "react";
import { updateRadioCallScript, type SettingsState } from "@/lib/actions/settings";

export default function RadioScriptForm({ initialValue }: { initialValue: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updateRadioCallScript,
    undefined
  );

  return (
    <form action={action} className="space-y-3">
      <textarea
        name="radioCallScript"
        defaultValue={initialValue}
        rows={5}
        placeholder={
          'e.g. "Grasslands Traffic, PPG-DYB, overhead 500 feet, joining downwind for runway 09, Grasslands."'
        }
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        {state?.saved && <span className="text-sm text-green-700">Saved.</span>}
      </div>
    </form>
  );
}
