"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEndorsementHeldSince } from "@/lib/actions/verification";

/** Lets a CFI/Admin correct a verified ladder tier's "held since" date
 * inline, right under its Un-verify button -- 29 Sep 2026 fix (Riaan: "the
 * Green 1. Basic ... got wrong start date. Must be able to be change by
 * CFI"). Only rendered for an already-verified tier; LadderTiers already
 * shows the current date as plain text above this ("Held since ..."), so
 * this stays a small "Edit date" toggle rather than duplicating it. */
export default function HeldSinceEditor({
  endorsementId,
  currentDate,
}: {
  endorsementId: string;
  currentDate: Date | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentDate ? currentDate.toISOString().slice(0, 10) : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-[11px] font-medium text-slate-500 underline decoration-dotted hover:text-slate-700"
      >
        Edit date
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        max={new Date().toISOString().slice(0, 10)}
        className="rounded-md border border-slate-300 px-1.5 py-0.5 text-[11px]"
      />
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await setEndorsementHeldSince(endorsementId, value);
            if (result?.error) {
              setError(result.error);
            } else {
              setError(null);
              setEditing(false);
              router.refresh();
            }
          })
        }
        className="rounded-md bg-slate-700 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {isPending ? "..." : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setError(null);
          setValue(currentDate ? currentDate.toISOString().slice(0, 10) : "");
        }}
        className="text-[11px] text-slate-400 hover:text-slate-600"
      >
        Cancel
      </button>
      {error && <span className="w-full text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
