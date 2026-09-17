"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resendInstructorInvite, removeInstructor } from "@/lib/actions/instructors";

/** Actions for one regular-instructor row on the Team page: resend their
 * invite link if they haven't activated yet, and remove their access
 * (permanent, asks for confirmation first). Never rendered for a CFI row --
 * the server actions this calls are scoped to role "instructor" anyway, so
 * this is a UI-level match to that, not the actual guard. */
export default function InstructorRowActions({
  instructorId,
  active,
}: {
  instructorId: string;
  active: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (confirmingRemove) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">Remove access?</span>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await removeInstructor(instructorId);
              router.refresh();
            })
          }
          className="font-medium text-red-600 hover:underline disabled:opacity-50"
        >
          {isPending ? "..." : "Yes, remove"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmingRemove(false)}
          className="text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (url) {
    return (
      <div className="flex items-center gap-1">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="w-40 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs"
        />
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(url)}
          className="text-xs text-red-600 hover:underline"
        >
          Copy
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      {!active && (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await resendInstructorInvite(instructorId);
              setUrl(res.inviteUrl);
            })
          }
          className="text-slate-600 hover:underline disabled:opacity-50"
        >
          {isPending ? "..." : "Get invite link"}
        </button>
      )}
      <button
        type="button"
        onClick={() => setConfirmingRemove(true)}
        className="text-red-600 hover:underline"
      >
        Remove
      </button>
    </div>
  );
}
