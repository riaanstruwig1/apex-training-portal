"use client";

import { useActionState } from "react";
import { updateAccountsWhatsapp, type SettingsState } from "@/lib/actions/settings";

/** Batch 92: who gets the "new student - load him on both accounting systems" WhatsApp. */
export default function AccountsForm({ initialTo }: { initialTo: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateAccountsWhatsapp, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="block flex-1 text-xs font-medium text-slate-600">
        Send to (cell number, several separated by commas; empty = off)
        <input
          name="accountsTo"
          defaultValue={initialTo}
          placeholder="072 561 4474"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
      {state?.saved && <span className="text-sm text-green-700">Saved.</span>}
      {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
    </form>
  );
}
