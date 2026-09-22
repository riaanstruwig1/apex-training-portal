import { requireStudent } from "@/lib/auth/dal";
import { getStudentProgress } from "@/lib/progress";
import { getLogbookEntries, summarizeLogbook } from "@/lib/logbook";
import Avatar from "@/components/avatar";
import PrintButton from "@/components/print-button";
import { parseTrainingTypes, type TrainingType } from "@/lib/exams";

const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  pg: "Paraglider (PG)",
  ppg: "Powered Paragliding (PPG)",
  ppt: "Powered Paratrike (PPT)",
};

/** Printable student portfolio (Notes4 item 22) -- see the pilot version's
 * comment for why this is a print-CSS view rather than a generated file. */
export default async function StudentPortfolioPrintPage() {
  const { user, profile } = await requireStudent();
  const [sections, logEntries] = await Promise.all([
    getStudentProgress(user.id),
    getLogbookEntries(user.id),
  ]);
  const summary = summarizeLogbook(logEntries);
  const totalExercises = sections.reduce((n, s) => n + s.totalCount, 0);
  const signedOff = sections.reduce((n, s) => n + s.signedOffCount, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="print-hide flex justify-end">
        <PrintButton />
      </div>

      <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
        <Avatar userId={user.id} filename={user.profilePictureFile} name={user.name} size={64} />
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{user.name}</h1>
          <p className="text-sm text-slate-500">Student Portfolio -- Apex Flight Hub</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <div className="text-xs text-slate-500">SACAA No.</div>
          <div className="text-sm font-medium text-slate-900">{profile?.sacaaNumber ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">SAHPA No.</div>
          <div className="text-sm font-medium text-slate-900">{profile?.sahpaNumber ?? "—"}</div>
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

      {profile?.trainingType && (
        <p className="text-sm text-slate-700">
          <span className="font-medium">Training:</span>{" "}
          {parseTrainingTypes(profile.trainingType)
            .map((t) => TRAINING_TYPE_LABELS[t])
            .join(" + ")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Total flights</div>
          <div className="text-xl font-semibold text-slate-900">{summary.totalFlights}</div>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Total flight time</div>
          <div className="text-xl font-semibold text-slate-900">
            {Math.round(summary.totalMinutes / 6) / 10} h
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Launches</div>
          <div className="text-xl font-semibold text-slate-900">{summary.totalLaunches}</div>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Exercises signed off</div>
          <div className="text-xl font-semibold text-slate-900">
            {signedOff} / {totalExercises}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Progress by section
        </h2>
        <div className="space-y-2">
          {sections.map((section) => {
            const isComplete = section.totalCount > 0 && section.signedOffCount === section.totalCount;
            return (
              <div key={section.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-900">
                  {section.name}
                  {isComplete && <span className="ml-2 text-xs text-green-600">Complete</span>}
                </span>
                <span className="text-slate-500">
                  {section.signedOffCount} / {section.totalCount}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="border-t border-slate-200 pt-3 text-xs text-slate-400">
        Printed {new Date().toLocaleDateString()} from Apex Flight Hub.
      </p>
    </div>
  );
}
