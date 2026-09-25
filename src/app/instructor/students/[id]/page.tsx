import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, studentProfiles, studentEndorsements } from "@/db/schema";
import Link from "next/link";
import { getStudentProgress } from "@/lib/progress";
import { getLogbookEntries, summarizeLogbook } from "@/lib/logbook";
import {
  getExamsForStudent,
  visibleExamCategories,
  parseTrainingTypes,
  EXAM_CATEGORY_LABELS,
  EXAM_CATEGORY_ORDER,
  type TrainingType,
} from "@/lib/exams";
import {
  studentEndorsementOptionsFor,
  groupEndorsementItems,
} from "@/lib/pilot-endorsements";
import { requireInstructor } from "@/lib/auth/dal";
import Avatar from "@/components/avatar";
import ExerciseChecklist from "./exercise-checklist";
import LogbookTable from "./logbook-table";
import CallSignEditor from "./call-sign-editor";
import StudentEndorsementToggle from "./student-endorsement-toggle";

const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  pg: "Paraglider (PG)",
  ppg: "Powered Paragliding (PPG)",
  ppt: "Powered Paratrike (PPT)",
};

export default async function StudentFolioPage(
  props: PageProps<"/instructor/students/[id]">
) {
  const staff = await requireInstructor();
  const isCFI = staff.role === "cfi";
  const { id } = await props.params;

  const [student] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!student || student.role !== "student") notFound();

  const [profile] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, id))
    .limit(1);

  const [sections, logEntries, examSummaries] = await Promise.all([
    getStudentProgress(id),
    getLogbookEntries(id),
    getExamsForStudent(id, profile?.trainingType),
  ]);

  const summary = summarizeLogbook(logEntries);
  const missingExamCategories = (
    visibleExamCategories(profile?.trainingType) ?? EXAM_CATEGORY_ORDER
  ).filter((cat) => !examSummaries.some((e) => e.category === cat));
  const studentTrainingTypes = parseTrainingTypes(profile?.trainingType);
  const studentTrainingLabel = studentTrainingTypes
    .map((t) => TRAINING_TYPE_LABELS[t])
    .join(" + ");

  const grantedEndorsements = profile
    ? await db
        .select()
        .from(studentEndorsements)
        .where(eq(studentEndorsements.studentProfileId, profile.id))
    : [];
  const grantedKeys = new Set(grantedEndorsements.map((e) => e.key));
  const availableEndorsementOptions = studentEndorsementOptionsFor(studentTrainingTypes);
  const groupedAvailableEndorsements = groupEndorsementItems(
    availableEndorsementOptions.map((o) => ({ key: o.key }))
  );

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-3">
        <Avatar userId={student.id} filename={student.profilePictureFile} name={student.name} size={48} />
        <div>
        <h1 className="text-xl font-semibold text-slate-900">{student.name}</h1>
        <p className="text-sm text-slate-500">
          {student.apexNumber ? `Apex No. ${student.apexNumber}` : ""}
          {profile?.sacaaNumber ? ` · SACAA No. ${profile.sacaaNumber}` : ""}
          {profile?.sahpaNumber ? ` · SAHPA No. ${profile.sahpaNumber}` : ""}
          {student.apexNumber || profile?.sacaaNumber || profile?.sahpaNumber ? " · " : ""}
          {student.email}
          {profile?.phone ? ` · ${profile.phone}` : ""}
          {profile?.dtoNumber ? ` · DTO ${profile.dtoNumber}` : ""}
        </p>
        {/* Account creation date -- "when did they sign up", distinct from
            profile.startDate below (when their actual TRAINING started,
            which the CFI sets/edits by hand and is often blank). Riaan
            asked for this 22 Sep 2026. */}
        <p className="mt-0.5 text-xs text-slate-400">
          Signed up {student.createdAt.toLocaleDateString()}
        </p>
        {isCFI ? (
          <CallSignEditor
            studentUserId={id}
            callSign={profile?.callSign ?? null}
            startDate={profile?.startDate ?? null}
            sacaaNumber={profile?.sacaaNumber ?? null}
            sahpaNumber={profile?.sahpaNumber ?? null}
            sahpaExpiryDate={profile?.sahpaExpiryDate ?? null}
            trainingType={profile?.trainingType ?? null}
          />
        ) : (
          (profile?.callSign ||
            profile?.startDate ||
            profile?.sacaaNumber ||
            profile?.sahpaNumber ||
            profile?.sahpaExpiryDate ||
            profile?.trainingType) && (
            <p className="mt-1 text-sm text-slate-500">
              {profile.trainingType && (
                <>Training: {studentTrainingLabel}</>
              )}
              {profile.callSign && (
                <>
                  {profile.trainingType ? " · " : ""}
                  Call sign: {profile.callSign}
                </>
              )}
              {profile.startDate && (
                <>
                  {profile.trainingType || profile.callSign ? " · " : ""}
                  Start date: {profile.startDate.toLocaleDateString()}
                </>
              )}
              {profile.sacaaNumber && (
                <>
                  {profile.trainingType || profile.callSign || profile.startDate ? " · " : ""}
                  SACAA No.: {profile.sacaaNumber}
                </>
              )}
              {profile.sahpaNumber && (
                <>
                  {profile.trainingType || profile.callSign || profile.startDate || profile.sacaaNumber
                    ? " · "
                    : ""}
                  SAHPA No. (SPL): {profile.sahpaNumber}
                </>
              )}
              {profile.sahpaExpiryDate && (
                <>
                  {profile.trainingType || profile.callSign || profile.startDate || profile.sahpaNumber
                    ? " · "
                    : ""}
                  SAHPA expires: {profile.sahpaExpiryDate.toLocaleDateString()}
                </>
              )}
            </p>
          )
        )}
        </div>
      </div>

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
            {studentTrainingTypes.length
              ? `${studentTrainingTypes.map((t) => t.toUpperCase()).join(" + ")} time`
              : "PG time"}
          </div>
          <div className="text-xl font-semibold text-slate-900">
            {Math.round(
              (studentTrainingTypes.length
                ? studentTrainingTypes.reduce(
                    (sum, t) => sum + (summary.minutesByType[t] ?? 0),
                    0
                  )
                : summary.minutesByType.pg) / 6
            ) / 10}{" "}
            h
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Training folio
        </h2>
        <ExerciseChecklist studentId={id} sections={sections} />
      </section>

      <section id="endorsements">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Endorsements
        </h2>
        {groupedAvailableEndorsements.length === 0 ? (
          <p className="text-sm text-slate-400">
            No site/skill endorsements are defined yet for this student&apos;s
            training type.
          </p>
        ) : (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            {groupedAvailableEndorsements.map(({ group, items }) => (
              <div key={group}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {group}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((o) =>
                    isCFI ? (
                      <StudentEndorsementToggle
                        key={o.key}
                        studentUserId={id}
                        endorsementKey={o.key}
                        label={o.label}
                        granted={grantedKeys.has(o.key)}
                      />
                    ) : (
                      <span
                        key={o.key}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          grantedKeys.has(o.key)
                            ? "bg-green-100 text-green-800"
                            : "border border-slate-200 text-slate-400"
                        }`}
                      >
                        {o.label}
                        {grantedKeys.has(o.key) ? " ✓" : ""}
                      </span>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {(examSummaries.length > 0 || missingExamCategories.length > 0) && (
        <section id="exams">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Exams
          </h2>
          <div className="space-y-2">
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
              const isPaper = e.source === "paper";
              const statusLabel =
                e.status === "not_started"
                  ? "Not started"
                  : e.status === "in_progress"
                    ? `Attempt ${e.attemptNumber} — in progress — ${e.answeredCount} / ${e.totalQuestions} answered`
                    : e.status === "submitted"
                      ? isPaper
                        ? `Attempt ${e.attemptNumber} — paper submission, awaiting verification`
                        : `Attempt ${e.attemptNumber} — submitted, awaiting verification`
                      : e.passed
                        ? isPaper
                          ? `Attempt ${e.attemptNumber} — Verified — PASS (paper)`
                          : `Attempt ${e.attemptNumber} — Verified — PASS (${e.scorePercent?.toFixed(0)}%)`
                        : isPaper
                          ? `Attempt ${e.attemptNumber} — Verified — FAIL (paper)${e.canRetry ? " — retake pending" : ""}`
                          : `Attempt ${e.attemptNumber} — Verified — FAIL (${e.scorePercent?.toFixed(0)}%)${e.canRetry ? " — retake pending" : ""}`;
              const badgeColor =
                e.status === "verified"
                  ? e.passed
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                  : e.status === "submitted"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600";
              const canReview = e.status === "submitted" || e.status === "verified";

              return (
                <div
                  key={e.examId}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900">{e.title}</div>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                  {canReview && (
                    <Link
                      href={`/instructor/students/${id}/exams/${e.examId}`}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {e.status === "submitted" ? "Review & verify" : "Review"}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section id="logbook">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Flight log
        </h2>
        <LogbookTable studentId={id} entries={logEntries} />
      </section>
    </div>
  );
}
