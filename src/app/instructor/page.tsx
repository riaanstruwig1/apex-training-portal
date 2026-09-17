import Link from "next/link";
import { getAllStudentsWithSummary, type StudentSummary } from "@/lib/progress";
import {
  getPendingExamVerifications,
  getExamCategoryStatusesForAllStudents,
  visibleExamCategories,
  EXAM_CATEGORY_ORDER,
  EXAM_CATEGORY_LABELS,
  type ExamCategory,
  type ExamCategoryStatus,
  type TrainingType,
} from "@/lib/exams";
import { requireInstructor } from "@/lib/auth/dal";
import { getPendingApplicants } from "@/lib/verification";
import InviteLinkButton from "./invite-link-button";
import StudentRowActions from "./student-row-actions";

const statusStyles: Record<string, string> = {
  invited: "bg-amber-100 text-amber-800",
  suspended: "bg-slate-200 text-slate-600",
  archived: "bg-slate-200 text-slate-600",
};

const examBadgeStyles: Record<ExamCategoryStatus, string> = {
  pass: "bg-green-100 text-green-800",
  fail: "bg-red-100 text-red-800",
  not_done: "bg-slate-100 text-slate-500",
};
const examBadgeLabel: Record<ExamCategoryStatus, string> = {
  pass: "Pass",
  fail: "Fail",
  not_done: "Not done",
};

const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  pg: "PG",
  ppg: "PPG",
  ppt: "PPT",
};

function isExpired(d: Date): boolean {
  return d.getTime() < Date.now();
}

/** Replaces the old plain "active" text pill: a small progress bar plus
 * the raw count, so at a glance you can see how far along a student is
 * rather than just that their account isn't suspended. */
function TrainingProgress({ signedOff, total }: { signedOff: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((signedOff / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-red-600" style={{ width: `${pct}%` }} />
      </div>
      <span className="whitespace-nowrap text-xs font-medium text-slate-600">
        {signedOff}/{total}
      </span>
    </div>
  );
}

function ExamBadges({
  statuses,
  trainingType,
}: {
  statuses: Record<ExamCategory, ExamCategoryStatus> | undefined;
  trainingType: TrainingType | null;
}) {
  const visible = visibleExamCategories(trainingType) ?? EXAM_CATEGORY_ORDER;
  const categories = EXAM_CATEGORY_ORDER.filter((cat) => visible.includes(cat));
  return (
    <div className="flex flex-wrap gap-1">
      {categories.map((cat) => {
        const status = statuses?.[cat] ?? "not_done";
        return (
          <span
            key={cat}
            title={EXAM_CATEGORY_LABELS[cat]}
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${examBadgeStyles[status]}`}
          >
            {EXAM_CATEGORY_LABELS[cat].replace(" Exam", "").replace("SAHPA ", "")}:{" "}
            {examBadgeLabel[status]}
          </span>
        );
      })}
    </div>
  );
}

/** One student's row, as a card -- used below `sm` instead of the table,
 * which forces an awkward horizontal scroll at phone width (7-8 columns). */
function StudentCard({
  s,
  archived,
  isCFI,
  pendingExamsByStudent,
  examStatusByStudent,
}: {
  s: StudentSummary;
  archived: boolean;
  isCFI: boolean;
  pendingExamsByStudent: Map<string, number>;
  examStatusByStudent: Map<string, Record<ExamCategory, ExamCategoryStatus>>;
}) {
  const pendingLogbook = s.pendingLogbookCount > 0;
  const pendingExams = (pendingExamsByStudent.get(s.id) ?? 0) > 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <Link
            href={`/instructor/students/${s.id}`}
            className="font-medium text-slate-900 hover:text-red-600"
          >
            {s.name}
          </Link>
          {s.trainingType && (
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              {TRAINING_TYPE_LABELS[s.trainingType]}
            </span>
          )}
          <div className="text-xs text-slate-500">{s.email}</div>
        </div>
        {s.status === "active" ? (
          <TrainingProgress signedOff={s.signedOffCount} total={s.totalCount} />
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[s.status]}`}
          >
            {s.status}
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        <div>
          <dt className="text-xs text-slate-400">Student No.</dt>
          <dd className="text-slate-700">
            {s.sahpaNumber ?? <span className="text-slate-300">—</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Expiry date</dt>
          <dd className={isExpired(s.sahpaExpiryDate ?? new Date(0)) && s.sahpaExpiryDate ? "font-medium text-red-600" : "text-slate-700"}>
            {s.sahpaExpiryDate
              ? `${s.sahpaExpiryDate.toLocaleDateString()}${isExpired(s.sahpaExpiryDate) ? " (expired)" : ""}`
              : <span className="text-slate-300">—</span>}
          </dd>
        </div>
      </dl>
      <div className="mt-2">
        <ExamBadges statuses={examStatusByStudent.get(s.id)} trainingType={s.trainingType} />
      </div>
      {!archived && (pendingLogbook || pendingExams) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {pendingLogbook && (
            <Link
              href={`/instructor/students/${s.id}#logbook`}
              className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-200"
            >
              {s.pendingLogbookCount} flight{s.pendingLogbookCount > 1 ? "s" : ""} to verify
            </Link>
          )}
          {pendingExams && (
            <Link
              href={`/instructor/students/${s.id}#exams`}
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-200"
            >
              {pendingExamsByStudent.get(s.id)} exam{(pendingExamsByStudent.get(s.id) ?? 0) > 1 ? "s" : ""} to verify
            </Link>
          )}
        </div>
      )}
      {isCFI && (
        <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
          {!archived && s.status === "invited" && <InviteLinkButton studentId={s.id} />}
          <StudentRowActions studentId={s.id} archived={archived} />
        </div>
      )}
    </div>
  );
}

function StudentTable({
  students,
  archived,
  isCFI,
  pendingExamsByStudent,
  examStatusByStudent,
}: {
  students: StudentSummary[];
  archived: boolean;
  isCFI: boolean;
  pendingExamsByStudent: Map<string, number>;
  examStatusByStudent: Map<string, Record<ExamCategory, ExamCategoryStatus>>;
}) {
  return (
    <>
      {/* Mobile: one card per student, avoids horizontal-scrolling an 8-column table */}
      <div className="space-y-3 sm:hidden">
        {students.map((s) => (
          <StudentCard
            key={s.id}
            s={s}
            archived={archived}
            isCFI={isCFI}
            pendingExamsByStudent={pendingExamsByStudent}
            examStatusByStudent={examStatusByStudent}
          />
        ))}
      </div>

      {/* Tablet / desktop: table */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Student No.</th>
            <th className="px-4 py-3">Expiry date</th>
            <th className="px-4 py-3">Exams</th>
            {!archived && <th className="px-4 py-3">Needs attention</th>}
            {isCFI && <th className="px-4 py-3"></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {students.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link
                  href={`/instructor/students/${s.id}`}
                  className="font-medium text-slate-900 hover:text-red-600"
                >
                  {s.name}
                </Link>
                {s.trainingType && (
                  <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    {TRAINING_TYPE_LABELS[s.trainingType]}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">{s.email}</td>
              <td className="px-4 py-3">
                {s.status === "active" ? (
                  <TrainingProgress signedOff={s.signedOffCount} total={s.totalCount} />
                ) : (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[s.status]}`}
                  >
                    {s.status}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {s.sahpaNumber ?? <span className="text-xs text-slate-300">—</span>}
              </td>
              <td className="px-4 py-3">
                {s.sahpaExpiryDate ? (
                  <span
                    className={
                      isExpired(s.sahpaExpiryDate)
                        ? "font-medium text-red-600"
                        : "text-slate-600"
                    }
                  >
                    {s.sahpaExpiryDate.toLocaleDateString()}
                    {isExpired(s.sahpaExpiryDate) ? " (expired)" : ""}
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <ExamBadges
                  statuses={examStatusByStudent.get(s.id)}
                  trainingType={s.trainingType}
                />
              </td>
              {!archived && (
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    {s.pendingLogbookCount > 0 && (
                      <Link
                        href={`/instructor/students/${s.id}#logbook`}
                        className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-200"
                      >
                        {s.pendingLogbookCount} flight
                        {s.pendingLogbookCount > 1 ? "s" : ""} to verify
                      </Link>
                    )}
                    {(pendingExamsByStudent.get(s.id) ?? 0) > 0 && (
                      <Link
                        href={`/instructor/students/${s.id}#exams`}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-200"
                      >
                        {pendingExamsByStudent.get(s.id)} exam
                        {(pendingExamsByStudent.get(s.id) ?? 0) > 1 ? "s" : ""} to verify
                      </Link>
                    )}
                    {s.pendingLogbookCount === 0 &&
                      (pendingExamsByStudent.get(s.id) ?? 0) === 0 && (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                  </div>
                </td>
              )}
              {isCFI && (
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {!archived && s.status === "invited" && (
                      <InviteLinkButton studentId={s.id} />
                    )}
                    <StudentRowActions studentId={s.id} archived={archived} />
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

export default async function InstructorDashboard() {
  const staff = await requireInstructor();
  const isCFI = staff.role === "cfi";

  const [allStudents, pendingExamsByStudent, examStatusByStudent, pendingApplicants] =
    await Promise.all([
      getAllStudentsWithSummary(),
      getPendingExamVerifications(),
      getExamCategoryStatusesForAllStudents(),
      getPendingApplicants(),
    ]);
  const activeStudents = allStudents.filter((s) => s.status !== "archived");
  const archivedStudents = allStudents.filter((s) => s.status === "archived");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Students</h1>
        {isCFI && (
          <Link
            href="/instructor/students/new"
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Add student
          </Link>
        )}
      </div>

      {pendingApplicants.length > 0 && (
        <Link
          href="/admin"
          className="mb-6 flex items-center justify-between rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm hover:bg-red-100"
        >
          <span className="font-semibold text-red-900">
            Action needed: {pendingApplicants.length} new sign-up
            {pendingApplicants.length > 1 ? "s" : ""} waiting to be verified
            {pendingApplicants.length === 1 ? ` -- ${pendingApplicants[0].name}` : ""}
          </span>
          <span className="font-semibold text-red-700">Review in verification queue &rarr;</span>
        </Link>
      )}

      {activeStudents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No students yet.
          {isCFI
            ? " Add one, or students will appear here once they register through Shopify and get tagged “Student”."
            : " Ask your Chief Flight Instructor to add one."}
        </div>
      ) : (
        <StudentTable
          students={activeStudents}
          archived={false}
          isCFI={isCFI}
          pendingExamsByStudent={pendingExamsByStudent}
          examStatusByStudent={examStatusByStudent}
        />
      )}

      {isCFI && archivedStudents.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-slate-500">
            Archived students ({archivedStudents.length})
          </summary>
          <div className="mt-3">
            <StudentTable
              students={archivedStudents}
              archived={true}
              isCFI={isCFI}
              pendingExamsByStudent={pendingExamsByStudent}
              examStatusByStudent={examStatusByStudent}
            />
          </div>
        </details>
      )}
    </div>
  );
}
