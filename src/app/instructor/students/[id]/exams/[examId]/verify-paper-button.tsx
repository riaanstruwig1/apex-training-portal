"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyPaperExam } from "@/lib/actions/exams";

/** Pass/fail decision for a paper submission -- the counterpart to
 * VerifyButton, but since a paper attempt has no computed score, the
 * reviewer has to actually choose the outcome instead of just confirming
 * one that's already there. */
export default function VerifyPaperButton({ attemptId }: { attemptId: string }) {
  const [confirming, setConfirming] = useState<"pass" | "fail" | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (confirming) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-600">
          Mark this {confirming === "pass" ? "PASS" : "FAIL"}?
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await verifyPaperExam(attemptId, confirming === "pass");
              router.refresh();
            })
          }
          className={`rounded-md px-3 py-1.5 font-semibold text-white disabled:opacity-60 ${
            confirming === "pass" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {isPending ? "..." : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(null)}
          className="text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setConfirming("pass")}
        className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
      >
        Mark passed
      </button>
      <button
        type="button"
        onClick={() => setConfirming("fail")}
        className="rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
      >
        Mark failed
      </button>
    </div>
  );
}
