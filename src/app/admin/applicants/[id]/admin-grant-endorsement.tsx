"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminGrantEndorsement } from "@/lib/actions/verification";

/** Grants a rating the pilot never self-declared -- the Henna Fourie case
 * (Notes4 item 11): a CFI/Admin reviewing a pilot needs to add a rating on
 * their behalf, not just verify one the pilot already applied for. Creates
 * the endorsement row and marks it verified in one step. */
export default function AdminGrantEndorsement({
  pilotProfileId,
  applicantUserId,
  endorsementKey,
  label,
}: {
  pilotProfileId: string;
  applicantUserId: string;
  endorsementKey: string;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await adminGrantEndorsement(pilotProfileId, applicantUserId, endorsementKey);
          router.refresh();
        })
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {label}
      <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        {isPending ? "..." : "Grant"}
      </span>
    </button>
  );
}
