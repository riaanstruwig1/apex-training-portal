import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireInstructor } from "@/lib/auth/dal";
import { getExamDetail, getAttemptHistory } from "@/lib/exams";
import VerifyButton from "./verify-button";
import VerifyPaperButton from "./verify-paper-button";

function mediaUrl(slug: string, filename: string) {
  return `/exam-media/${slug}/${filename}`;
}

function attemptLabel(a: {
  attemptNumber: number;
  status: string;
  passed: boolean | null;
  scorePercent: number | null;
  source: "online" | "paper";
}) {
  if (a.status !== "verified") {
    return a.source === "paper"
      ? `Attempt ${a.attemptNumber} — paper, awaiting verification`
      : `Attempt ${a.attemptNumber} — awaiting verification`;
  }
  const outcome = a.passed ? "PASS" : "FAIL";
  return a.source === "paper"
    ? `Attempt ${a.attemptNumber} — ${outcome} (paper)`
    : `Attempt ${a.attemptNumber} — ${outcome} (${a.scorePercent?.toFixed(0)}%)`;
}

export default async function ExamReviewPage(
  props: PageProps<"/instructor/students/[id]/exams/[examId]">
) {
  await requireInstructor();
  const { id, examId } = await props.params;
  const sp = await props.searchParams;
  const requestedAttemptId = typeof sp.attempt === "string" ? sp.attempt : undefined;

  const [student] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!student || student.role !== "student") notFound();

  const history = await getAttemptHistory(id, examId);
  // Instructors review the most recent submitted/verified attempt by
  // default; older attempts stay reachable via ?attempt=<id> so a retake
  // doesn't hide the record of an earlier fail.
  const fallback = history.find((a) => a.status !== "in_progress");
  const attemptId = requestedAttemptId ?? fallback?.id;

  const detail = attemptId ? await getExamDetail(examId, id, true, attemptId) : null;
  if (!detail || !detail.attempt || detail.attempt.status === "in_progress") notFound();

  const { exam, attempt } = detail;

  const historyTabs = history.length > 1 && (
    <div className="flex flex-wrap gap-2 text-xs">
      {history.map((a) => (
        <a
          key={a.id}
          href={`/instructor/students/${id}/exams/${examId}?attempt=${a.id}`}
          className={`rounded-full border px-3 py-1 ${
            a.id === attempt.id
              ? "border-red-600 bg-red-50 text-red-700 font-medium"
              : "border-slate-200 text-slate-500 hover:bg-slate-50"
          }`}
        >
          {attemptLabel(a)}
        </a>
      ))}
    </div>
  );

  // A "paper" attempt (pre-written exam, or an already-held radio licence
  // -- see schema.ts) has no exam_answers at all, so there's no question
  // breakdown to walk and no .docx to generate -- just the uploaded proof
  // and a pass/fail decision the reviewer has to make themselves (a paper
  // attempt is never auto-scored the way an online one is).
  if (attempt.source === "paper") {
    return (
      <div className="space-y-6">
        {historyTabs}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{exam.title}</h1>
            <p className="text-sm text-slate-500">
              {student.name} — Attempt {attempt.attemptNumber} — paper submission
            </p>
          </div>
          {attempt.status === "submitted" && <VerifyPaperButton attemptId={attempt.id} />}
        </div>

        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            attempt.status === "verified"
              ? attempt.passed
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {attempt.status === "verified" ? (
            <>
              <span className="font-semibold">{attempt.passed ? "PASS" : "FAIL"}</span> — paper
              submission, verified by {attempt.verifiedByName}
              {attempt.verifiedAt ? ` on ${attempt.verifiedAt.toLocaleDateString()}` : ""}.
            </>
          ) : (
            <>
              Submitted
              {attempt.submittedAt ? ` on ${attempt.submittedAt.toLocaleDateString()}` : ""} as a
              paper exam. Not yet reviewed.
            </>
          )}
        </div>

        {attempt.externalLicenseNumber && (
          <p className="text-sm text-slate-600">
            Radio licence number: <span className="font-medium">{attempt.externalLicenseNumber}</span>
          </p>
        )}
        {attempt.proofFile ? (
          <a
            href={`/api/uploads/${id}/${attempt.proofFile}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            View what was submitted
          </a>
        ) : (
          <p className="text-sm text-slate-400">No file on record.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {historyTabs}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{exam.title}</h1>
          <p className="text-sm text-slate-500">
            {student.name} — Attempt {attempt.attemptNumber}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/instructor/students/${id}/exams/${examId}/download?attempt=${attempt.id}`}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Download marked exam (.docx)
          </a>
          {attempt.status === "submitted" && (
            <VerifyButton attemptId={attempt.id} />
          )}
        </div>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          attempt.status === "verified"
            ? attempt.passed
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        {attempt.status === "verified" ? (
          <>
            <span className="font-semibold">{attempt.passed ? "PASS" : "FAIL"}</span> —{" "}
            {attempt.scoreMarks} / {attempt.totalMarks} marks ({attempt.scorePercent?.toFixed(1)}%).
            Verified by {attempt.verifiedByName}
            {attempt.verifiedAt ? ` on ${attempt.verifiedAt.toLocaleDateString()}` : ""}.
            {!attempt.mustPassSectionsOk && (
              <span className="block font-medium">
                Not every Airlaw question was answered correctly — those must all be
                correct to pass, regardless of overall score.
              </span>
            )}
          </>
        ) : (
          <>
            Submitted{attempt.submittedAt ? ` on ${attempt.submittedAt.toLocaleDateString()}` : ""} —
            computed result: <span className="font-semibold">{attempt.passed ? "PASS" : "FAIL"}</span>{" "}
            ({attempt.scoreMarks} / {attempt.totalMarks} marks, {attempt.scorePercent?.toFixed(1)}%).
            Not yet verified.
          </>
        )}
      </div>

      {exam.sections.map((section) => {
        const earned = section.questions.reduce((sum, q) => {
          const selected = q.options.find((o) => o.id === q.selectedOptionId);
          return sum + (selected?.isCorrect ? q.marks : 0);
        }, 0);
        return (
          <section key={section.id} className="space-y-3">
            <h2 className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-slate-500">
              <span>
                Section {section.code}: {section.name}
              </span>
              <span className="font-normal normal-case text-slate-400">
                {earned} / {section.totalMarks} marks
              </span>
            </h2>
            {section.questions.map((q) => {
              const selected = q.options.find((o) => o.id === q.selectedOptionId);
              const isCorrect = !!selected?.isCorrect;
              return (
                <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">
                      {q.code}. {q.prompt}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {isCorrect ? `✔ ${q.marks}/${q.marks}` : `✘ 0/${q.marks}`}
                    </span>
                  </div>
                  <div className="text-sm">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Student answered
                    </div>
                    {selected ? (
                      selected.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaUrl(exam.slug, selected.image)}
                          alt={`Option ${selected.label}`}
                          className="mt-1 h-auto w-40 rounded-md border border-slate-200"
                        />
                      ) : (
                        <div className="text-slate-700">{selected.text}</div>
                      )
                    ) : (
                      <div className="text-slate-400">No answer</div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
