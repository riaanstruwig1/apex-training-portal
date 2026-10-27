"use client";

import { useActionState, useState } from "react";
import { requestPhase2, type Phase2State } from "@/lib/actions/intro-course";

const COURSES: [string, string][] = [
  ["pg", "Paraglider (PG)"],
  ["ppg", "Powered Paraglider (PPG)"],
  ["ppt", "Powered Trike/Chute (PPT/PPC)"],
];

/** 19 Oct 2026: the intro student's course card on the dashboard -- what the
 * intro course covers, and the "Sign up for Phase 2" button. */
export default function Phase2SignupCard({
  requestedAt,
  requestedTypes,
  declinedAt,
  declineReason,
}: {
  requestedAt: Date | null;
  requestedTypes: string | null;
  declinedAt: Date | null;
  declineReason: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<Phase2State, FormData>(requestPhase2, undefined);
  const requested = (requestedTypes ?? "").split(",").filter(Boolean);

  return (
    <div className="rounded-xl border-2 border-red-200 bg-red-50/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-red-700">Your course</div>
          <div className="text-base font-semibold text-slate-900">PG/PPG Intro training -- Phase 1</div>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Your logbook and the Phase 1 training folio are open. Phase 2, the theory folio, the
            study notes and the exams are shown so you can see what comes next -- they open once
            you sign up for Phase 2 and your CFI approves it.
          </p>
        </div>
        {!requestedAt && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Sign up for Phase 2
          </button>
        )}
      </div>

      {requestedAt && (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Phase 2 requested on {new Date(requestedAt).toLocaleDateString()}
          {requested.length > 0 && ` (${requested.map((t) => t.toUpperCase()).join(" + ")})`} -- waiting for
          your CFI to approve it. You&apos;ll get a WhatsApp.
        </p>
      )}

      {!requestedAt && declinedAt && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Your Phase 2 request was not approved yet{declineReason ? `: ${declineReason}` : "."} You can ask
          again when you&apos;re ready.
        </p>
      )}

      {!requestedAt && open && (
        <form action={formAction} className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-sm font-medium text-slate-900">Which course do you want to continue on?</div>
          <div className="flex flex-wrap gap-4">
            {COURSES.map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="trainingType" value={value} defaultChecked={value !== "ppt"} />
                {label}
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500">Tick one or more. Your CFI can change it when approving.</p>
          {state && "error" in state && <p className="text-sm text-red-600">{state.error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {isPending ? "Sending..." : "Send Phase 2 sign-up"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">
              Cancel
            </button>
          </div>
        </form>
      )}
      {state && "success" in state && !requestedAt && <p className="mt-2 text-sm text-green-700">{state.success}</p>}
    </div>
  );
}
