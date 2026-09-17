"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveApplicant, rejectApplicant } from "@/lib/actions/verification";
import { groupEndorsementItems } from "@/lib/pilot-endorsements";

export default function ApplicantReviewActions({
  userId,
  endorsementKeys,
}: {
  userId: string;
  endorsementKeys: string[];
}) {
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [checked, setChecked] = useState<Set<string>>(new Set(endorsementKeys)); // default: verify everything declared
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (mode === "approve") {
    return (
      <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-medium text-green-900">Approve this application?</p>
        {endorsementKeys.length > 0 && (
          <div>
            <p className="text-xs text-green-800">
              Uncheck anything you&apos;re not ready to verify yet -- the account still
              activates, those just stay unverified/hidden until checked off later.
            </p>
            <div className="mt-2 space-y-2">
              {groupEndorsementItems(endorsementKeys.map((key) => ({ key }))).map(
                ({ group, items }) => (
                  <div key={group}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">
                      {group}
                    </p>
                    <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
                      {items.map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 text-xs text-green-900">
                          <input
                            type="checkbox"
                            checked={checked.has(key)}
                            onChange={(e) => {
                              setChecked((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(key);
                                else next.delete(key);
                                return next;
                              });
                            }}
                            className="rounded border-green-300"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await approveApplicant(userId, Array.from(checked));
                router.push("/admin");
              })
            }
            className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {isPending ? "Approving..." : "Yes, approve"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode === "reject") {
    return (
      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <label htmlFor="reason" className="block text-sm font-medium text-red-900">
          Reason (shown to the applicant if they ask why)
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-red-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await rejectApplicant(userId, reason);
                router.push("/admin");
              })
            }
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isPending ? "Rejecting..." : "Confirm reject"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => setMode("approve")}
        className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => setMode("reject")}
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
      >
        Reject
      </button>
    </div>
  );
}
