"use client";

import { useActionState, useState } from "react";
import { createSafetyNotice, sendSavedSafetyNotice, type SafetyState } from "@/lib/actions/safety";

const input = "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

export default function SafetyNoticeForm({ nextRef, recipientsNote }: { nextRef: string; recipientsNote: string }) {
  const [state, action, pending] = useActionState<SafetyState, FormData>(createSafetyNotice, undefined);
  // Batch 109: two buttons -- send to everyone, or save only (no WhatsApp).
  const [mode, setMode] = useState<"send" | "save">("send");
  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(e) => {
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const m = submitter?.value === "save" ? "save" : "send";
        setMode(m);
        const q =
          m === "save"
            ? `Save safety notice ${nextRef} without sending WhatsApps? It will show on every student's and pilot's dashboard.`
            : `Send safety notice ${nextRef} now? ${recipientsNote}`;
        if (!confirm(q)) e.preventDefault();
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
      <div className="flex flex-wrap items-center gap-2">
        <button
          name="mode"
          value="send"
          disabled={pending}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-bold text-amber-950 hover:bg-amber-600 disabled:opacity-60"
        >
          {pending && mode === "send" ? "Sending..." : `Submit and send ${nextRef} to everyone`}
        </button>
        <button
          name="mode"
          value="save"
          disabled={pending}
          className="rounded-md border-2 border-amber-500 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
        >
          {pending && mode === "save" ? "Saving..." : "Submit and save only (no WhatsApp)"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        &ldquo;Save only&rdquo; puts the notice on everyone&rsquo;s dashboard without sending WhatsApps. You can still send them later from the list below.
      </p>
    </form>
  );
}

/** Batch 109: "Send WhatsApp now" for a notice that was saved only. */
export function SendSavedNoticeButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState<SafetyState, FormData>(sendSavedSafetyNotice, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Send the WhatsApps for ${label} now? Every student, pilot and instructor with a cell number gets one.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="mt-1 rounded bg-amber-500 px-2 py-1 text-xs font-semibold text-amber-950 hover:bg-amber-600 disabled:opacity-60">
        {pending ? "Sending..." : "Send WhatsApp now"}
      </button>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
