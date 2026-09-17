"use client";

import { useTransition } from "react";
import { applyForEndorsement } from "@/lib/actions/pilot-endorsements";

export default function ApplyButton({
  endorsementKey,
  label = "Apply",
  pendingLabel = "Applying...",
}: {
  endorsementKey: string;
  label?: string;
  pendingLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => applyForEndorsement(endorsementKey))}
      className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
    >
      {isPending ? pendingLabel : label}
    </button>
  );
}
