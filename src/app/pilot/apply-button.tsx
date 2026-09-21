"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await applyForEndorsement(endorsementKey);
            if (result?.error) {
              setError(result.error);
            } else {
              setError(null);
              router.refresh();
            }
          })
        }
        className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {isPending ? pendingLabel : label}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
