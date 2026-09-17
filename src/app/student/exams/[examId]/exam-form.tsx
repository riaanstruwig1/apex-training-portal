"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveExamAnswer, submitExam, startNewAttempt } from "@/lib/actions/exams";
import type { ExamDetail, AttemptView, AttemptSummary } from "@/lib/exams";

function mediaUrl(slug: string, filename: string) {
  return `/exam-media/${slug}/${filename}`;
}

function OptionButton({
  option,
  selected,
  locked,
  reveal,
  onClick,
  slug,
}: {
  option: ExamDetail["sections"][number]["questions"][number]["options"][number];
  selected: boolean;
  locked: boolean;
  reveal: boolean;
  onClick: () => void;
  slug: string;
}) {
  // reveal only ever marks the student's OWN selection right/wrong --
  // never highlights which other option would have been correct.
  const selectedCorrect = reveal && selected ? option.isCorrect : undefined;
  let tone = "border-slate-200 bg-white hover:border-slate-300";
  if (reveal && selected) {
    tone = selectedCorrect ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50";
  } else if (selected) {
    tone = "border-red-600 bg-red-50";
  }

  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-lg border-2 p-3 text-left text-sm transition ${tone} ${
        locked ? "cursor-default" : "cursor-pointer"
      }`}
    >
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          selected ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"
        }`}
      >
        {option.label}
      </span>
      <span className="flex-1">
        {option.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(slug, option.image)}
            alt={`Option ${option.label}`}
            className="h-auto w-full rounded-md border border-slate-100"
          />
        ) : (
          <span className="text-slate-800">{option.text}</span>
        )}
      </span>
      {reveal && selected && (
        <span className={selectedCorrect ? "text-green-600" : "text-red-600"}>
          {selectedCorrect ? "✔" : "✘"}
        </span>
      )}
    </button>
  );
}

function attemptLabel(a: AttemptSummary) {
  if (a.status !== "verified") return `Attempt ${a.attemptNumber} — submitted, awaiting verification`;
  return `Attempt ${a.attemptNumber} — ${a.passed ? "PASS" : "FAIL"} (${a.scorePercent?.toFixed(0)}%)`;
}

function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Live countdown for timed exams. Ticks every second off attempt.startedAt
 * + the exam's time limit -- not off a client-only timer -- so a page
 * refresh (or reopening the tab later) still shows the correct remaining
 * time. Calls onExpire once, the first time remaining hits zero. */
function ExamClock({
  deadline,
  onExpire,
}: {
  deadline: number;
  onExpire: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = deadline - now;

  useEffect(() => {
    if (remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      onExpire();
    }
  }, [remaining, onExpire]);

  const urgent = remaining <= 5 * 60 * 1000;

  return (
    <div
      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
        urgent ? "border-red-300 bg-red-50 text-red-800" : "border-slate-200 bg-white text-slate-800"
      }`}
    >
      <span className="font-medium">Time remaining</span>
      <span className={`font-mono text-lg font-semibold ${urgent ? "text-red-700" : "text-slate-900"}`}>
        {formatClock(remaining)}
      </span>
    </div>
  );
}

export default function ExamForm({
  examId,
  exam,
  attempt,
  history,
}: {
  examId: string;
  exam: ExamDetail;
  attempt: AttemptView | null;
  history: AttemptSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [confirmingRetry, setConfirmingRetry] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [autoSubmitting, setAutoSubmitting] = useState(false);

  // Current time, read only inside an effect (never during render, which
  // would be an impure read of the real-world clock) -- used solely to
  // decide whether a retry-cooldown has elapsed yet.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(id);
  }, []);

  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const s of exam.sections) {
      for (const q of s.questions) {
        if (q.selectedOptionId) initial[q.id] = q.selectedOptionId;
      }
    }
    return initial;
  });

  const totalQuestions = useMemo(
    () => exam.sections.reduce((n, s) => n + s.questions.length, 0),
    [exam]
  );
  const answeredCount = Object.keys(answers).length;
  const locked = !!attempt && attempt.status !== "in_progress";
  const reveal = attempt?.status === "verified";
  const canRetry = attempt?.status === "verified" && attempt.passed === false;

  const nextRetryAt =
    canRetry && attempt?.verifiedAt && exam.retryCooldownDays
      ? new Date(attempt.verifiedAt.getTime() + exam.retryCooldownDays * 24 * 60 * 60 * 1000)
      : null;
  const retryAvailableNow =
    canRetry && (!nextRetryAt || (now !== null && nextRetryAt.getTime() <= now));

  const deadline =
    exam.timeLimitMinutes && attempt?.status === "in_progress" && attempt.startedAt
      ? attempt.startedAt.getTime() + exam.timeLimitMinutes * 60 * 1000
      : null;

  function selectOption(questionId: string, optionId: string) {
    if (locked) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    startTransition(async () => {
      await saveExamAnswer(examId, questionId, optionId);
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await submitExam(examId);
      if (result?.error) {
        setSubmitError(result.error);
        setConfirmingSubmit(false);
      } else {
        router.refresh();
      }
    });
  }

  function handleClockExpire() {
    setAutoSubmitting(true);
    startTransition(async () => {
      await submitExam(examId, { auto: true });
      router.refresh();
    });
  }

  function handleRetry() {
    startTransition(async () => {
      const result = await startNewAttempt(examId);
      if (result?.error) {
        setRetryError(result.error);
        setConfirmingRetry(false);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6 pb-24">
      {history.length > 1 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <span className="font-medium">Attempt history:</span>{" "}
          {history.map((a) => attemptLabel(a)).join("  ·  ")}
        </div>
      )}

      {autoSubmitting && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          Time&apos;s up — submitting what you&apos;ve answered now...
        </div>
      )}

      {deadline !== null && !autoSubmitting && (
        <ExamClock deadline={deadline} onExpire={handleClockExpire} />
      )}

      {/* Status banner */}
      {attempt?.status === "submitted" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Submitted{attempt.submittedAt ? ` on ${attempt.submittedAt.toLocaleDateString()}` : ""} —
          awaiting instructor verification. You can no longer change your answers.
        </div>
      )}
      {attempt?.status === "verified" && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            attempt.passed
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <span className="font-semibold">
            {attempt.passed ? "PASS" : "FAIL"} (Attempt {attempt.attemptNumber})
          </span>
          {" — "}
          {attempt.scoreMarks} / {attempt.totalMarks} marks (
          {attempt.scorePercent?.toFixed(1)}%). Verified by {attempt.verifiedByName}
          {attempt.verifiedAt ? ` on ${attempt.verifiedAt.toLocaleDateString()}` : ""}.
          {!attempt.mustPassSectionsOk && (
            <span className="block font-medium">
              Note: not every Airlaw question was answered correctly — those must all be
              correct to pass, regardless of overall score.
            </span>
          )}
          {canRetry && !retryAvailableNow && nextRetryAt && (
            <div className="mt-3 font-medium">
              You can attempt this exam again from {nextRetryAt.toLocaleDateString()} (
              {exam.retryCooldownDays}-day wait after a fail).
            </div>
          )}
          {retryAvailableNow && (
            <div className="mt-3">
              {retryError && <p className="mb-2 text-sm text-red-700">{retryError}</p>}
              {confirmingRetry ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Start a new attempt? You&apos;ll redo the whole exam from scratch.
                    {exam.timeLimitMinutes
                      ? ` The ${exam.timeLimitMinutes}-minute clock starts the moment you confirm.`
                      : ""}
                  </span>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleRetry}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {isPending ? "..." : "Yes, start over"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingRetry(false)}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingRetry(true)}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      {!locked && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-900">Progress</span>
            <span className="text-slate-500">
              {answeredCount} / {totalQuestions} answered
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-red-600"
              style={{ width: `${totalQuestions ? (answeredCount / totalQuestions) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {exam.timeLimitMinutes
              ? "Come back and change any answer until you submit or the clock runs out."
              : "No time limit — come back and change any answer until you submit."}
          </p>
        </div>
      )}

      {exam.sections.map((section) => (
        <section key={section.id} className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Section {section.code}: {section.name}{" "}
            <span className="font-normal text-slate-400">({section.totalMarks} marks)</span>
          </h2>
          {section.questions.map((q) => (
            <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">{q.prompt}</p>
                <span className="shrink-0 text-xs text-slate-400">({q.marks} mk)</span>
              </div>
              {q.stemImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(exam.slug, q.stemImage)}
                  alt=""
                  className="mb-3 h-auto w-full max-w-md rounded-md border border-slate-100"
                />
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {q.options.map((o) => (
                  <OptionButton
                    key={o.id}
                    option={o}
                    selected={answers[q.id] === o.id}
                    locked={locked}
                    reveal={reveal}
                    slug={exam.slug}
                    onClick={() => selectOption(q.id, o.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      {!locked && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {submitError && <p className="text-sm text-red-600">{submitError}</p>}
            {!submitError && (
              <p className="text-sm text-slate-500">
                {answeredCount === totalQuestions
                  ? "All questions answered."
                  : `Answer all ${totalQuestions} questions to submit.`}
              </p>
            )}
            {confirmingSubmit ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">
                  Submit exam? You won&apos;t be able to change any answers after this.
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleSubmit}
                  className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isPending ? "Submitting..." : "Yes, submit"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingSubmit(false)}
                  className="text-sm text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={answeredCount !== totalQuestions}
                onClick={() => setConfirmingSubmit(true)}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                Submit exam
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
