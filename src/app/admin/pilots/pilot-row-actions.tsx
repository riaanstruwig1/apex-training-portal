"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archivePilot, restorePilot, deletePilot, updatePilotDetails } from "@/lib/actions/pilot-admin";

/** Archive / restore / delete for one pilot row (CFI only). Archive and
 * restore are one click; delete asks for confirmation first. */
export default function PilotRowActions({
  pilotId,
  archived,
  details,
}: {
  pilotId: string;
  archived: boolean;
  details?: { callSign: string | null; sacaaNumber: string | null; sahpaNumber: string | null; sahpaExpiryDate: string | null };
}) {
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [cs, setCs] = useState(details?.callSign ?? "");
  const [sacaa, setSacaa] = useState(details?.sacaaNumber ?? "");
  const [sahpa, setSahpa] = useState(details?.sahpaNumber ?? "");
  const [exp, setExp] = useState(details?.sahpaExpiryDate ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  if (editing) {
    const inp = "rounded-md border border-slate-300 px-2 py-1 text-sm";
    return (
      <div className="flex flex-wrap items-end gap-2 text-xs">
        <label className="text-slate-500">Call sign<input value={cs} onChange={(e) => setCs(e.target.value)} className={`${inp} block w-24 uppercase`} /></label>
        <label className="text-slate-500">SACAA No<input value={sacaa} onChange={(e) => setSacaa(e.target.value)} className={`${inp} block w-28`} /></label>
        <label className="text-slate-500">SAHPA No<input value={sahpa} onChange={(e) => setSahpa(e.target.value)} className={`${inp} block w-24`} /></label>
        <label className="text-slate-500">SAHPA expiry<input type="date" value={exp} onChange={(e) => setExp(e.target.value)} className={`${inp} block`} /></label>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await updatePilotDetails(pilotId, { callSign: cs, sacaaNumber: sacaa, sahpaNumber: sahpa, sahpaExpiryDate: exp }); setEditing(false); router.refresh(); })}
          className="rounded-md bg-slate-900 px-2.5 py-1.5 font-medium text-white disabled:opacity-50"
        >
          {pending ? "..." : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600">Cancel</button>
      </div>
    );
  }
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
      {details && !archived && (
        <button type="button" onClick={() => setEditing(true)} className="font-medium text-slate-700 hover:underline">
          Edit
        </button>
      )}
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
