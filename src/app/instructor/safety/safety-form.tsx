"use client";

import { useActionState } from "react";
import { createSafetyNotice, type SafetyState } from "@/lib/actions/safety";

const input = "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

export default function SafetyNoticeForm({ nextRef, recipientsNote }: { nextRef: string; recipientsNote: string }) {
  const [state, action, pending] = useActionState<SafetyState, FormData>(createSafetyNotice, undefined);
  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(e) => {
        if (!confirm(`Send safety notice ${nextRef} now? ${recipientsNote}`)) e.preventDefault();
      }}
    >
      <label className="block text-sm font-medium text-slate-700">
        Title <span className="text-red-600">*</span>
        <input name="title" required maxLength={150} placeholder="e.g. Fuel contamination warning" className={input} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Subject <span className="text-red-600">*</span>
        <input name="subject" required maxLength={200} placeholder="e.g. Water found in fuel from the airfield tank" className={input} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Description <span className="text-red-600">*</span>
        <textarea name="description" required rows={6} placeholder="What happened, what to do, and from when." className={input} />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        File <span className="font-normal text-slate-400">(optional - PDF or photo, max 10 MB)</span>
        <input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm" />
      </label>
      {state?.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      {state?.success && <p className="rounded bg-green-50 p-2 text-sm text-green-800">{state.success}</p>}
      <button disabled={pending} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-amber-950 hover:bg-amber-600 disabled:opacity-60">
        {pending ? "Sending..." : `Submit and send ${nextRef} to everyone`}
      </button>
    </form>
  );
}
