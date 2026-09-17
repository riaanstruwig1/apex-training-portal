"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyExamAttempt } from "@/lib/actions/exams";

export default function VerifyButton({ attemptId }: { attemptId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (confirming) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-600">Mark this exam as verified?</span>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await verifyExamAttempt(attemptId);
              router.refresh();
            })
          }
          className="rounded-md bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "..." : "Yes, verify"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
    >
      Mark as verified
    </button>
  );
}
