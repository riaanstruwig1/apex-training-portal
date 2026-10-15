"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archivePilot, restorePilot, deletePilot } from "@/lib/actions/pilot-admin";

/** Archive / restore / delete for one pilot row (CFI only). Archive and
 * restore are one click; delete asks for confirmation first. */
export default function PilotRowActions({ pilotId, archived }: { pilotId: string; archived: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (confirming) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">Delete permanently?</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await deletePilot(pilotId); router.refresh(); })}
          className="font-medium text-red-600 hover:underline disabled:opacity-50"
        >
          {pending ? "..." : "Yes, delete"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-slate-400 hover:text-slate-600">
          Cancel
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => { await (archived ? restorePilot(pilotId) : archivePilot(pilotId)); router.refresh(); })}
        className="text-slate-600 hover:underline disabled:opacity-50"
      >
        {pending ? "..." : archived ? "Restore" : "Archive"}
      </button>
      <button type="button" onClick={() => setConfirming(true)} className="text-red-600 hover:underline">
        Delete
      </button>
    </div>
  );
}
