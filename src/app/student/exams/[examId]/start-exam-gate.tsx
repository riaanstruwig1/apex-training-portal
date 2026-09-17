"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ensureAttempt } from "@/lib/actions/exams";

export default function StartExamGate({
  examId,
  timeLimitMinutes,
  retryCooldownDays,
}: {
  examId: string;
  timeLimitMinutes: number;
  retryCooldownDays: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleStart() {
    startTransition(async () => {
      await ensureAttempt(examId);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="mb-2 font-semibold">Before you start:</p>
      <ul className="mb-4 list-disc space-y-1 pl-5">
        <li>
          This exam is timed. The moment you click Start, a{" "}
          <span className="font-semibold">{timeLimitMinutes}-minute clock</span> begins and
          stays on screen for the rest of the exam.
        </li>
        <li>
          If the clock runs out before you finish, the exam stops immediately -- whatever
          you&apos;ve answered is submitted, and anything left blank counts as incorrect.
        </li>
        {retryCooldownDays ? (
          <li>
            If you fail, you can only attempt it again after a{" "}
            <span className="font-semibold">{retryCooldownDays}-day wait</span>.
          </li>
        ) : null}
      </ul>
      <button
        type="button"
        disabled={isPending}
        onClick={handleStart}
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {isPending ? "Starting..." : `Start Exam (${timeLimitMinutes} min)`}
      </button>
    </div>
  );
}
