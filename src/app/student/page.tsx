import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { studentProfiles, studentEndorsements } from "@/db/schema";
import { requireStudent } from "@/lib/auth/dal";
import { getStudentProgress } from "@/lib/progress";
import { getLogbookEntries, summarizeLogbook } from "@/lib/logbook";
import Avatar from "@/components/avatar";
import {
  getExamsForStudent,
  visibleExamCategories,
  parseTrainingTypes,
  EXAM_CATEGORY_ORDER,
  type TrainingType,
} from "@/lib/exams";
import { groupEndorsementItems } from "@/lib/pilot-endorsements";
import { getStudyMaterials, type StudyMaterialSlot } from "@/lib/actions/study-materials";
import { DASHBOARD_EXAM_ORDER, boxForCategory } from "@/lib/study-note-boxes";
import {
  SECTION_PHASE_LABELS,
  SECTION_TYPE_SHORT,
  type SectionTrainingType,
} from "@/lib/syllabus-tags";
import type { ExamSummary, ExamCategory } from "@/lib/exams";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  pg: "Paraglider (PG)",
  ppg: "Powered Paragliding (PPG)",
  ppt: "Powered Paratrike (PPT)",
};

function isExpired(d: Date): boolean {
  return d.getTime() < Date.now();
}

/** Shown when a student's training puts an exam category in scope but no
 * exam has been loaded for it yet (e.g. PPT, still under construction). */
const PLACEHOLDER_EXAM_TITLES: Record<ExamCategory, string> = {
  pg: "Basic Licence Theory Test",
  ppg: "PPG Theory Knowledge Test",
  ppt: "PPT Theory Knowledge Test",
  rt: "DTO Restricted Radio",
};

function ExamCard({ e }: { e: ExamSummary }) {
  const isPaper = e.source === "paper";
  const statusLabel =
    e.status === "not_started"
      ? "Not started"
      : e.status === "in_progress"
        ? `In progress — ${e.answeredCount} / ${e.totalQuestions} answered`
        : e.status === "submitted"
          ? isPaper
            ? "Paper exam submitted — awaiting review"
            : "Submitted — awaiting verification"
          : e.passed
            ? isPaper
              ? "Verified — PASS (paper)"
              : `Verified — PASS (${e.scorePercent?.toFixed(0)}%)`
            : isPaper
              ? "Verified — FAIL (paper)"
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
    <div className="rounded-xl border border-slate-200 bg-white hover:border-red-300">
      <Link href={`/student/exams/${e.examId}`} className="flex items-center justify-between p-4">
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
      {e.canSubmitPaper && (
        <Link
          href={`/student/exams/${e.examId}/paper`}
          className="block border-t border-slate-100 px-4 py-2 text-xs font-medium text-red-600 hover:underline"
        >
          {e.category === "rt"
            ? "Already hold a radio licence? Submit it →"
            : "Already wrote this on paper? Submit it →"}
        </Link>
      )}
    </div>
  );
}

function StudyNoteCard({ item }: { item: StudyMaterialSlot }) {
  return (
    <a
      href={item.filename ? `/api/study-material/${item.filename}` : item.linkUrl!}
      target={item.filename ? undefined : "_blank"}
      rel={item.filename ? undefined : "noreferrer"}
      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-red-300"
    >
      <div>
        <div className="text-sm font-medium text-slate-900">{item.title}</div>
        {item.filename && <div className="text-xs text-slate-500">{formatBytes(item.fileSize)}</div>}
      </div>
      <span className="text-sm font-medium text-red-600">
        {item.filename ? "Download" : "Open link"}
      </span>
    </a>
  );
}

export default async function StudentDashboard() {
  const { user } = await requireStudent();
  const [sections, logEntries, [profile], studyMaterialSlots] = await Promise.all([
    getStudentProgress(user.id),
    getLogbookEntries(user.id),
    db.select().from(studentProfiles).where(eq(studentProfiles.userId, user.id)).limit(1),
    getStudyMaterials(),
  ]);
  const studyMaterialItems = studyMaterialSlots.filter((s) => s.filename || s.linkUrl);
  const examSummaries = await getExamsForStudent(user.id, profile?.trainingType);
  const summary = summarizeLogbook(logEntries);
  const studentTrainingTypes = parseTrainingTypes(profile?.trainingType);

  // V24 item 74: one row per exam the student can see, in Riaan's order
  // (Basic Licence PG, PPG, DTO Radio, PPT), with the CFI's study note for
  // that exam's dashboard box beside it.
  const visibleCategories = visibleExamCategories(profile?.trainingType) ?? EXAM_CATEGORY_ORDER;
  const examRows = DASHBOARD_EXAM_ORDER.filter((cat) => visibleCategories.includes(cat)).map(
    (cat) => ({
      category: cat,
      exams: examSummaries.filter((e) => e.category === cat),
      notes: studyMaterialItems.filter((n) => n.dashboardBox === boxForCategory(cat)),
    })
  );
  const uncategorisedExams = examSummaries.filter((e) => !e.category);
  // Falls back to when the student profile was created until a CFI/Admin
  // sets the real initial sign-up date.
  const signUpDate = profile?.signUpDate ?? profile?.createdAt ?? null;

  const grantedEndorsements = profile
    ? await db
        .select()
        .from(studentEndorsements)
        .where(eq(studentEndorsements.studentProfileId, profile.id))
    : [];
  const groupedGrantedEndorsements = groupEndorsementItems(grantedEndorsements);

  const totalExercises = sections.reduce((n, s) => n + s.totalCount, 0);
  const signedOff = sections.reduce((n, s) => n + s.signedOffCount, 0);

  return (
    <div className="space-y-8">
      {/* V24 item 73 (1 Oct 2026): welcome line, then the training the
          student signed up for, then SACAA No / SAHPA No / SAHPA expiry /
          Apex No / Call Sign. The date on the right of the welcome line is
          now the initial sign-up date (the SAHPA expiry moved into the line
          below). Both dates are set by the CFI/Admin, not the student. */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <Avatar userId={user.id} filename={user.profilePictureFile} name={user.name} size={48} />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Welcome, {user.name.split(" ")[0]}
            </h1>
            {studentTrainingTypes.length > 0 && (
              <p className="text-sm text-slate-500">
                Training:{" "}
                <span className="font-medium text-slate-900">
                  {studentTrainingTypes.map((t) => TRAINING_TYPE_LABELS[t]).join(" + ")}
                </span>
              </p>
            )}
            <p className="text-sm text-slate-500">
              {signedOff} of {totalExercises} exercises signed off
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href="/student/profile/view"
                className="inline-block rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                View profile
              </Link>
              <Link
                href="/student/profile"
                className="inline-block rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Edit profile
              </Link>
              <Link
                href="/student/portfolio/print"
                className="inline-block rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Printable copy
              </Link>
            </div>
          </div>
        </div>
        <div className="text-sm text-slate-500 sm:text-right">
          Initial student sign-up date:{" "}
          <span className="font-medium text-slate-900">{signUpDate ? signUpDate.toLocaleDateString() : "—"}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div>
          <div className="text-xs text-slate-500">SACAA No.</div>
          <div className="text-sm font-medium text-slate-900">{profile?.sacaaNumber ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">SAHPA No.</div>
          <div className="text-sm font-medium text-slate-900">{profile?.sahpaNumber ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">SAHPA expiry date</div>
          {profile?.sahpaExpiryDate ? (
            <div
              className={`text-sm font-medium ${
                isExpired(profile.sahpaExpiryDate) ? "text-red-600" : "text-slate-900"
              }`}
            >
              {profile.sahpaExpiryDate.toLocaleDateString()}
              {isExpired(profile.sahpaExpiryDate) ? " (expired)" : ""}
            </div>
          ) : (
            <div className="text-sm font-medium text-slate-900">—</div>
          )}
        </div>
        <div>
          <div className="text-xs text-slate-500">Apex No.</div>
          <div className="text-sm font-medium text-slate-900">{user.apexNumber ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Call Sign</div>
          <div className="text-sm font-medium text-slate-900">{profile?.callSign ?? "—"}</div>
        </div>
      </div>

      <Link
        href="/student/logbook"
        className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-5 text-lg font-semibold text-white shadow-sm hover:bg-red-700"
      >
        + Log a flight
      </Link>

      {(examRows.length > 0 || uncategorisedExams.length > 0) && (
        <section>
          <div className="mb-3 hidden grid-cols-2 gap-6 md:grid">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Exams</h2>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Study Notes{" "}
              <Link href="/student/study-notes" className="font-normal normal-case tracking-normal text-red-600 hover:underline">
                (see Study Notes in the top menu for more)
              </Link>
            </h2>
          </div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 md:hidden">
            Exams &amp; study notes
          </h2>
          <div className="space-y-3">
            {examRows.map((row) => (
              <div key={row.category} className="grid items-start gap-3 md:grid-cols-2 md:gap-6">
                <div className="space-y-3">
                  {row.exams.length > 0 ? (
                    row.exams.map((e) => <ExamCard key={e.examId} e={e} />)
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm font-medium text-slate-500">
                        {PLACEHOLDER_EXAM_TITLES[row.category]}
                      </div>
                      <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        Under construction
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {row.notes.map((n) => (
                    <StudyNoteCard key={n.id} item={n} />
                  ))}
                </div>
              </div>
            ))}
            {uncategorisedExams.map((e) => (
              <div key={e.examId} className="grid items-start gap-3 md:grid-cols-2 md:gap-6">
                <ExamCard e={e} />
              </div>
            ))}
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

      {groupedGrantedEndorsements.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Endorsements
          </h2>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            {groupedGrantedEndorsements.map(({ group, items }) => (
              <div key={group}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {group}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((e) => (
                    <span
                      key={e.id}
                      className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800"
                      title={e.grantedAt ? `Granted ${e.grantedAt.toLocaleDateString()}` : undefined}
                    >
                      {e.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Progress by section
          </h2>
          <Link href="/student/exercises" className="text-sm text-red-600 hover:underline">
            View full folio →
          </Link>
        </div>
        {sections.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No training sections for your training type yet -- your instructor is setting them up.
          </div>
        )}
        <div className="space-y-3">
          {sections.map((section, i) => {
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

            const newGroup = i === 0 || sections[i - 1].phase !== section.phase;
            return (
              <div key={section.id} className="space-y-3">
              {newGroup && (
                <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {SECTION_PHASE_LABELS[section.phase]}
                </h3>
              )}
              <div
                className={`rounded-xl border p-4 ${
                  section.isUnlocked
                    ? "border-slate-200 bg-white"
                    : "border-slate-200 bg-slate-50 opacity-60"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900">
                    <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                      {SECTION_TYPE_SHORT[section.trainingType as SectionTrainingType]}
                    </span>
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
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
