"use client";

import { useActionState } from "react";
import {
  sendBirthdayTestNow,
  updateBirthdaySettings,
  type BirthdaySettingsState,
} from "@/lib/actions/birthdays";

export default function BirthdayForm({
  initialTo,
  initialEnabled,
  whatsappReady,
}: {
  initialTo: string;
  initialEnabled: boolean;
  whatsappReady: boolean;
}) {
  const [state, action, pending] = useActionState<BirthdaySettingsState, FormData>(
    updateBirthdaySettings,
    undefined
  );
  const [testState, testAction, testPending] = useActionState<BirthdaySettingsState, FormData>(
    sendBirthdayTestNow,
    undefined
  );

  return (
    <div className="space-y-3">
      <form action={action} className="space-y-3">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Send to (cell number, or several separated by commas)</span>
          <input
            name="to"
            defaultValue={initialTo}
            placeholder="072 561 4474"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="enabled" defaultChecked={initialEnabled} className="h-4 w-4" />
          Send the birthday WhatsApp every day at 08:00
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save"}
          </button>
          {state?.saved && <span className="text-sm text-green-700">Saved.</span>}
          {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
        </div>
      </form>

      <form action={testAction} className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        <button
          type="submit"
          disabled={testPending}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          {testPending ? "Sending..." : "Send test now"}
        </button>
        <span className="text-xs text-slate-500">
          Sends a TEST message to the saved number(s) straight away. Save first if you changed the number.
        </span>
        {!whatsappReady && (
          <span className="w-full text-xs text-amber-700">
            WhatsApp isn&apos;t set up on this server (Green-API variables missing in Railway).
          </span>
        )}
        {testState?.message && <span className="w-full text-sm text-green-700">{testState.message}</span>}
        {testState?.error && <span className="w-full text-sm text-red-700">{testState.error}</span>}
      </form>
    </div>
  );
}
