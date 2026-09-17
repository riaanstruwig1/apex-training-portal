"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEndorsementVerified, declineEndorsement } from "@/lib/actions/verification";

/** Verify/un-verify/decline a single already-declared pilot endorsement, for
 * an account that's already active -- separate from the bulk approve-time
 * checklist in ApplicantReviewActions, which only applies while the
 * application is still pending_verification. Decline (Notes3 item 7) asks
 * for a required reason via a prompt, same pattern as the existing
 * reset-password confirm() dialog elsewhere on this page. */
export default function PilotEndorsementToggle({
  endorsementId,
  verified,
  declined = false,
}: {
  endorsementId: string;
  verified: boolean;
  declined?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleDecline() {
    const reason = window.prompt("Reason for declining this endorsement (shown to the pilot):");
    if (reason === null) return; // cancelled
    if (!reason.trim()) {
      setError("Enter a reason for declining.");
      return;
    }
    startTransition(async () => {
      const result = await declineEndorsement(endorsementId, reason);
      if (result?.error) {
        setError(result.error);
      } else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await setEndorsementVerified(endorsementId, !verified);
            setError(null);
            router.refresh();
          })
        }
        className={`rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-60 ${
          verified
            ? "border border-slate-300 text-slate-600 hover:bg-slate-50"
            : "bg-green-600 text-white hover:bg-green-700"
        }`}
      >
        {isPending ? "..." : verified ? "Un-verify" : "Verify"}
      </button>
      {!verified && (
        <button
          type="button"
          disabled={isPending}
          onClick={handleDecline}
          className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {declined ? "Update decline" : "Decline"}
        </button>
      )}
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
