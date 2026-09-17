import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { studentProfiles } from "@/db/schema";
import { requireStudent } from "@/lib/auth/dal";
import { getStudentProgress } from "@/lib/progress";
import { getLogbookEntries, summarizeLogbook } from "@/lib/logbook";
import Avatar from "@/components/avatar";
import {
  getExamsForStudent,
  visibleExamCategories,
  EXAM_CATEGORY_LABELS,
  EXAM_CATEGORY_ORDER,
  type TrainingType,
} from "@/lib/exams";

const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  pg: "Paraglider (PG)",
  ppg: "Powered Paragliding (PPG)",
  ppt: "Powered Paratrike (PPT)",
};

function isExpired(d: Date): boolean {
  return d.getTime() < Date.now();
}

export default async function StudentDashboard() {
  const { user } = await requireStudent();
  const [sections, logEntries, [profile]] = await Promise.all([
    getStudentProgress(user.id),
    getLogbookEntries(user.id),
    db.select().from(studentProfiles).where(eq(studentProfiles.userId, user.id)).limit(1),
  ]);
  const examSummaries = await getExamsForStudent(user.id, profile?.trainingType);
  // A category the student's training type puts in scope but that has no
  // exam content loaded yet (e.g. PPT, as of v15) -- shown as a "coming
  // soon" placeholder rather than just silently missing, so it's clear the
  // training type registered correctly and content is what's pending.
  const missingExamCategories = (
    visibleExamCategories(profile?.trainingType) ?? EXAM_CATEGORY_ORDER
  ).filter((cat) => !examSummaries.some((e) => e.category === cat));
  const summary = summarizeLogbook(logEntries);

  const totalExercises = sections.reduce((n, s) => n + s.totalCount, 0);
  const signedOff = sections.reduce((n, s) => n + s.signedOffCount, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <Avatar userId={user.id} filename={user.profilePictureFile} name={user.name} size={48} />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Welcome, {user.name.split(" ")[0]}
              {profile?.callSign && (
                <span className="font-normal text-slate-500">
                  {" "}
                  &mdash; Call Sign: <span className="font-mono text-slate-700">{profile.callSign}</span>
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Apex No. {user.apexNumber ?? "—"}
              {profile?.sahpaNumber ? ` · SAHPA No. (SPL) ${profile.sahpaNumber}` : ""}
            </p>
            <p className="text-sm text-slate-500">
              {signedOff} of {totalExercises} exercises signed off
            </p>
            {profile?.trainingType && (
              <p className="mt-1 text-sm text-slate-500">
                Training:{" "}
                <span className="font-medium text-slate-900">
                  {TRAINING_TYPE_LABELS[profile.trainingType]}
                </span>
              </p>
            )}
            <Link
              href="/student/profile"
              className="mt-2 inline-block rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit profile
            </Link>
          </div>
        </div>
        {profile?.sahpaExpiryDate && (
          <div className="text-sm text-slate-500 sm:text-right">
            {profile.sahpaExpiryDate && (
              <div className={isExpired(profile.sahpaExpiryDate) ? "font-medium text-red-600" : ""}>
                Expiry date: {profile.sahpaExpiryDate.toLocaleDateString()}
                {isExpired(profile.sahpaExpiryDate) ? " (expired)" : ""}
              </div>
            )}
          </div>
        )}
      </div>

      <Link
        href="/student/logbook"
        className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-5 text-lg font-semibold text-white shadow-sm hover:bg-red-700"
      >
        + Log a flight
      </Link>

      {(examSummaries.length > 0 || missingExamCategories.length > 0) && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Exams
          </h2>
          <div className="space-y-3">
            {missingExamCategories.map((cat) => (
              <div
                key={cat}
                className="flex items-center justify-between rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4"
              >
                <div>
                  <div className="text-sm font-medium text-slate-500">
                    {EXAM_CATEGORY_LABELS[cat]}
                  </div>
                  <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                    Content coming soon
                  </span>
                </div>
              </div>
            ))}
            {examSummaries.map((e) => {
              const statusLabel =
                e.status === "not_started"
                  ? "Not started"
                  : e.status === "in_progress"
                    ? `In progress — ${e.answeredCount} / ${e.totalQuestions} answered`
                    : e.status === "submitted"
                      ? "Submitted — awaiting verification"
                      : e.passed
                        ? `Verified — PASS (${e.scorePercent?.toFixed(0)}%)`
                        : `Verified — FAIL (${e.scorePercent?.toFixed(0)}%)`;
              const badgeColor =
                e.status === "verified"
                  ? e.passed
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                  : e.status === "submitted"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600";

              return (
                <Link
                  key={e.examId}
                  href={`/student/exams/${e.examId}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-red-300"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900">{e.title}</div>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                  {e.status !== "not_started" && e.status !== "submitted" && e.status !== "verified" && (
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-red-600"
                        style={{
                          width: `${e.totalQuestions ? (e.answeredCount / e.totalQuestions) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Total flights</div>
          <div className="text-xl font-semibold text-slate-900">
            {summary.totalFlights}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Total flight time</div>
          <div className="text-xl font-semibold text-slate-900">
            {Math.round(summary.totalMinutes / 6) / 10} h
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">
            {profile?.trainingType ? `${profile.trainingType.toUpperCase()} time` : "PG time"}
          </div>
          <div className="text-xl font-semibold text-slate-900">
            {Math.round(summary.minutesByType[profile?.trainingType ?? "pg"] / 6) / 10} h
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Launches</div>
          <div className="text-xl font-semibold text-slate-900">
            {summary.totalLaunches}
          </div>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Progress by section
          </h2>
          <Link href="/student/exercises" className="text-sm text-red-600 hover:underline">
            View full folio →
          </Link>
        </div>
        <div className="space-y-3">
          {sections.map((section) => {
            const isComplete =
              section.totalCount > 0 && section.signedOffCount === section.totalCount;
            const isStarted = section.signedOffCount > 0;
            const barColor = isComplete
              ? "bg-green-600"
              : isStarted
                ? "bg-red-600"
                : "bg-slate-300";
            const countColor = isComplete
              ? "text-green-700"
              : isStarted
                ? "text-red-700"
                : "text-slate-500";

            return (
              <div
                key={section.id}
                className={`rounded-xl border p-4 ${
                  section.isUnlocked
                    ? "border-slate-200 bg-white"
                    : "border-slate-200 bg-slate-50 opacity-60"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900">
                    {section.name}
                    {!section.isUnlocked && (
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        (locked)
                      </span>
                    )}
                    {section.isUnlocked && isComplete && (
                      <span className="ml-2 text-xs font-normal text-green-600">
                        Complete
                      </span>
                    )}
                  </span>
                  <span className={`text-xs font-medium ${countColor}`}>
                    {section.signedOffCount} / {section.totalCount}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${barColor}`}
                    style={{
                      width: `${
                        section.totalCount
                          ? (section.signedOffCount / section.totalCount) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
