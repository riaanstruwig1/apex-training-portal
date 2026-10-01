import { requireStudent } from "@/lib/auth/dal";
import { getStudentProgress } from "@/lib/progress";
import { getExerciseContentCounts } from "@/lib/content-counts";
import ExerciseInfoButton from "@/components/exercise-info-button";
import {
  SECTION_PHASE_LABELS,
  SECTION_TYPE_SHORT,
  exerciseLabel,
  type SectionTrainingType,
} from "@/lib/syllabus-tags";

const statusLabels: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  signed_off: "Signed off",
};

const statusStyles: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600",
  in_progress: "bg-amber-100 text-amber-800",
  signed_off: "bg-green-100 text-green-800",
};

export default async function StudentExercisesPage() {
  const { user } = await requireStudent();
  const [sections, infoCounts] = await Promise.all([
    getStudentProgress(user.id),
    getExerciseContentCounts(),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Training folio</h1>
      <p className="mb-6 text-sm text-slate-500">
        Your instructor signs off each exercise after you&apos;ve demonstrated
        it. You need every exercise in a section signed off before the next
        section unlocks. Only the training you signed up for is shown, in
        order: Phase 1, Phase 2, Phase 3, then Conversion and Practical Theory.
      </p>

      {sections.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No training sections for your training type yet -- your instructor is setting them up.
        </div>
      )}
      <div className="space-y-6">
        {sections.map((section, i) => (
          <div key={section.id} className="space-y-3">
          {(i === 0 || sections[i - 1].phase !== section.phase) && (
            <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {SECTION_PHASE_LABELS[section.phase]}
            </h2>
          )}
          <div
            className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${
              !section.isUnlocked ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  <span className="mr-2 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                    {SECTION_TYPE_SHORT[section.trainingType as SectionTrainingType]}
                  </span>
                  {section.name}
                  {!section.isUnlocked && (
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      Locked &mdash; finish the previous section first
                    </span>
                  )}
                </h3>
                {section.description && (
                  <p className="text-xs text-slate-500">{section.description}</p>
                )}
              </div>
              <span className="text-xs font-medium text-slate-500">
                {section.signedOffCount} / {section.totalCount}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {section.exercises.map((exercise) => (
                <div
                  key={exercise.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div>
                    <div className="flex items-start gap-2 text-sm font-medium text-slate-900">
                      <span>{exerciseLabel(exercise.code, exercise.title)}</span>
                      {(infoCounts[exercise.id] ?? 0) > 0 && (
                        <ExerciseInfoButton
                          exerciseId={exercise.id}
                          label={exerciseLabel(exercise.code, exercise.title)}
                          count={infoCounts[exercise.id]}
                          canEdit={false}
                        />
                      )}
                    </div>
                    {exercise.description && (
                      <div className="text-xs text-slate-500">
                        {exercise.description}
                      </div>
                    )}
                    {exercise.notes && (
                      <div className="mt-1 text-xs italic text-slate-500">
                        Instructor note: {exercise.notes}
                      </div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[exercise.status]}`}
                  >
                    {statusLabels[exercise.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
          </div>
        ))}
      </div>
    </div>
  );
}
