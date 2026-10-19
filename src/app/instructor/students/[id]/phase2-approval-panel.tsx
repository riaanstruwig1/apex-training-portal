"use client";

import { useActionState, useState } from "react";
import { approvePhase2, declinePhase2, type Phase2State } from "@/lib/actions/intro-course";

const COURSES: [string, string][] = [
  ["pg", "Paraglider (PG)"],
  ["ppg", "Powered Paraglider (PPG)"],
  ["ppt", "Powered Paratrike (PPT)"],
];

/** 19 Oct 2026: on an intro (PG/PPG Intro training, Phase 1 only)
 * student's folio. Shows the student's "Sign up for Phase 2" request; the
 * CFI ticks the course(s) (pre-filled from the request) and approves --
 * the student becomes a normal student -- or declines with a reason.
 * Without a request the CFI can still move the student up. Instructors
 * just see the status. */
export default function Phase2ApprovalPanel({
  studentUserId,
  studentName,
  requestedAt,
  requestedTypes,
  declineReason,
  canApprove,
  isIntro,
  approvedAt,
}: {
  studentUserId: string;
  studentName: string;
  requestedAt: Date | null;
  requestedTypes: string | null;
  declineReason: string | null;
  canApprove: boolean;
  /** Still on the intro course? After approval the panel stays (so the
   * CFI sees the result) as a one-line history note. */
  isIntro: boolean;
  approvedAt: Date | null;
}) {
  const [open, setOpen] = useState(!!requestedAt);
  const [declining, setDeclining] = useState(false);
  const [approveState, approveAction, approving] = useActionState<Phase2State, FormData>(
    approvePhase2.bind(null, studentUserId),
    undefined
  );
  const [declineState, declineAction, declinePending] = useActionState<Phase2State, FormData>(
    declinePhase2.bind(null, studentUserId),
    undefined
  );
  const picked = new Set((requestedTypes ?? "pg,ppg").split(",").filter(Boolean));
  const done = (approveState && "success" in approveState) || (declineState && "success" in declineState);

  if (!isIntro) {
    return (
      <div id="phase2" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        {approveState && "success" in approveState
          ? approveState.success
          : `Moved up from PG/PPG Intro training to the full course${
              approvedAt ? ` on ${new Date(approvedAt).toLocaleDateString()}` : ""
            }.`}
      </div>
    );
  }

  return (
    <div
      id="phase2"
      className={`rounded-xl border-2 p-4 ${requestedAt ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Course</div>
          <div className="text-sm font-semibold text-slate-900">
            PG/PPG Intro training -- Phase 1 only (no exams, no study notes)
          </div>
          {requestedAt ? (
            <p className="mt-1 text-sm font-semibold text-red-700">
              {studentName} signed up for Phase 2 on {new Date(requestedAt).toLocaleDateString()}
              {requestedTypes ? ` (${requestedTypes.toUpperCase().split(",").join(" + ")})` : ""} -- waiting
              for CFI approval.
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              No Phase 2 request yet.{declineReason ? ` Last request declined: ${declineReason}` : ""}
            </p>
          )}
        </div>
        {canApprove && !open && !done && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Move to full course (Phase 2)
          </button>
        )}
      </div>

      {approveState && "success" in approveState && (
        <p className="mt-2 text-sm font-medium text-green-700">{approveState.success}</p>
      )}
      {declineState && "success" in declineState && (
        <p className="mt-2 text-sm font-medium text-slate-700">{declineState.success}</p>
      )}

      {canApprove && open && !done && (
        <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
          <form action={approveAction} className="space-y-2">
            <div className="text-sm font-medium text-slate-900">Course(s) for Phase 2</div>
            <div className="flex flex-wrap gap-4">
              {COURSES.map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="trainingType" value={value} defaultChecked={picked.has(value)} />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Approving makes {studentName} a normal student on these course(s): logbook and Phase 1
              sign-offs stay, study notes and exams open, and he gets a WhatsApp.
            </p>
            {approveState && "error" in approveState && <p className="text-sm text-red-600">{approveState.error}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={approving}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {approving ? "Approving..." : "Approve Phase 2"}
              </button>
              {requestedAt && !declining && (
                <button
                  type="button"
                  onClick={() => setDeclining(true)}
                  className="text-sm text-slate-600 hover:text-red-600"
                >
                  Decline...
                </button>
              )}
              {!requestedAt && (
                <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">
                  Cancel
                </button>
              )}
            </div>
          </form>
          {declining && (
            <form action={declineAction} className="space-y-2 border-t border-slate-100 pt-3">
              <label className="block text-xs text-slate-600">
                Reason (the student sees it)
                <textarea
                  name="reason"
                  rows={2}
                  placeholder="e.g. Finish the Phase 1 ground handling first."
                  className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
              </label>
              {declineState && "error" in declineState && <p className="text-sm text-red-600">{declineState.error}</p>}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={declinePending}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {declinePending ? "Saving..." : "Decline request"}
                </button>
                <button type="button" onClick={() => setDeclining(false)} className="text-sm text-slate-400 hover:text-slate-600">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
