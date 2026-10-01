"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addSection,
  updateSection,
  moveSection,
  addExercise,
  updateExercise,
  deleteExercise,
  deleteSection,
  updateSectionTags,
} from "@/lib/actions/syllabus";
import {
  SECTION_TRAINING_TYPES,
  SECTION_TRAINING_TYPE_LABELS,
  SECTION_PHASES,
  SECTION_PHASE_LABELS,
  type SectionPhase,
  exerciseLabel,
} from "@/lib/syllabus-tags";
import type { InferSelectModel } from "drizzle-orm";
import ExerciseInfoButton from "@/components/exercise-info-button";
import type { sections, exercises } from "@/db/schema";

type Section = InferSelectModel<typeof sections> & {
  exercises: InferSelectModel<typeof exercises>[];
  /** Next free default code for this section, e.g. "PPG-P1-Ex8". */
  suggestedCode: string;
};

const selectClass = "rounded-md border border-slate-300 px-2 py-1 text-xs";

function TagSelects({
  trainingType,
  phase,
  onChange,
  disabled,
}: {
  trainingType: string;
  phase: string;
  onChange?: (trainingType: string, phase: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <select
        name="trainingType"
        aria-label="Training type"
        defaultValue={trainingType}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value, phase)}
        className={selectClass}
      >
        {SECTION_TRAINING_TYPES.map((t) => (
          <option key={t} value={t}>
            {SECTION_TRAINING_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      <select
        name="phase"
        aria-label="Phase"
        defaultValue={phase}
        disabled={disabled}
        onChange={(e) => onChange?.(trainingType, e.target.value)}
        className={selectClass}
      >
        {SECTION_PHASES.map((p) => (
          <option key={p} value={p}>
            {SECTION_PHASE_LABELS[p]}
          </option>
        ))}
      </select>
    </div>
  );
}

type Exercise = InferSelectModel<typeof exercises>;

function useServerAction() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }
  return { isPending, run };
}

function ExerciseRow({ exercise, infoCount }: { exercise: Exercise; infoCount: number }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isPending, run } = useServerAction();

  if (editing) {
    return (
      <form
        action={(formData) => {
          setError(null);
          run(async () => {
            const result = await updateExercise(exercise.id, formData);
            if ("error" in result) {
              setError(result.error);
            } else {
              setEditing(false);
            }
          });
        }}
        className="flex flex-wrap items-end gap-2 px-4 py-2"
      >
        <div>
          <label className="block text-xs text-slate-500">Code</label>
          <input
            name="code"
            required
            defaultValue={exercise.code}
            className="w-36 rounded-md border border-slate-300 px-2 py-1 font-mono text-sm"
          />
        </div>
        <div className="flex-1 min-w-[10rem]">
          <label className="block text-xs text-slate-500">Title</label>
          <input
            name="title"
            required
            defaultValue={exercise.title}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex-1 min-w-[10rem]">
          <label className="block text-xs text-slate-500">
            Description (optional)
          </label>
          <input
            name="description"
            defaultValue={exercise.description ?? ""}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
        >
          Cancel
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="text-sm">
        <span className="font-medium">{exerciseLabel(exercise.code, exercise.title)}</span>
      </div>
      <div className="flex items-center gap-3">
        <ExerciseInfoButton
          exerciseId={exercise.id}
          label={exerciseLabel(exercise.code, exercise.title)}
          count={infoCount}
          canEdit
        />
        <button
          disabled={isPending}
          onClick={() => setEditing(true)}
          className="text-xs text-red-600 hover:underline"
        >
          Edit
        </button>
        <button
          disabled={isPending}
          onClick={() => run(() => deleteExercise(exercise.id))}
          className="text-xs text-red-600 hover:underline"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  index,
  total,
  infoCounts,
}: {
  infoCounts: Record<string, number>;
  section: Section;
  /** Position among sections with the same training type + phase. */
  index: number;
  total: number;
}) {
  const [name, setName] = useState(section.name);
  const [description, setDescription] = useState(section.description ?? "");
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const { isPending, run } = useServerAction();

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => run(() => updateSection(section.id, name, description))}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm font-semibold"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => run(() => updateSection(section.id, name, description))}
            placeholder="Description (optional)"
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600"
          />
          <TagSelects
            key={`${section.trainingType}-${section.phase}`}
            trainingType={section.trainingType}
            phase={section.phase}
            disabled={isPending}
            onChange={(t, p) => run(() => updateSectionTags(section.id, t, p))}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            disabled={index === 0 || isPending}
            onClick={() => run(() => moveSection(section.id, "up"))}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-30"
          >
            ↑
          </button>
          <button
            disabled={index === total - 1 || isPending}
            onClick={() => run(() => moveSection(section.id, "down"))}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-30"
          >
            ↓
          </button>
          <button
            disabled={isPending}
            onClick={() => {
              if (confirm(`Delete "${section.name}" and all its exercises?`)) {
                run(() => deleteSection(section.id));
              }
            }}
            className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            Delete section
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {section.exercises.map((ex) => (
          <ExerciseRow key={ex.id} exercise={ex} infoCount={infoCounts[ex.id] ?? 0} />
        ))}
      </div>

      <div className="p-4">
        {showAddExercise ? (
          <form
            action={(formData) => {
              setExerciseError(null);
              run(async () => {
                const result = await addExercise(section.id, formData);
                if ("error" in result) {
                  setExerciseError(result.error);
                } else {
                  setShowAddExercise(false);
                }
              });
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <div>
              <label className="block text-xs text-slate-500">Code</label>
              <input
                name="code"
                required
                key={section.suggestedCode}
                defaultValue={section.suggestedCode}
                className="w-36 rounded-md border border-slate-300 px-2 py-1 font-mono text-sm"
              />
            </div>
            <div className="flex-1 min-w-[10rem]">
              <label className="block text-xs text-slate-500">Name</label>
              <input
                name="title"
                required
                placeholder="e.g. Straight glide"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[10rem]">
              <label className="block text-xs text-slate-500">
                Description (optional)
              </label>
              <input
                name="description"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {isPending ? "Adding..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddExercise(false);
                setExerciseError(null);
              }}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
            >
              Cancel
            </button>
            {exerciseError && (
              <p className="w-full text-sm text-red-600">{exerciseError}</p>
            )}
          </form>
        ) : (
          <button
            onClick={() => setShowAddExercise(true)}
            className="text-sm text-red-600 hover:underline"
          >
            + Add exercise
          </button>
        )}
      </div>
    </div>
  );
}

export default function SyllabusEditor({
  sections,
  infoCounts,
}: {
  sections: Section[];
  /** Line 70: sub-section count per exercise id. */
  infoCounts: Record<string, number>;
}) {
  const { isPending, run } = useServerAction();
  const [showAddSection, setShowAddSection] = useState(false);

  return (
    <div className="space-y-6">
      {sections.map((s, i) => {
        const peers = sections.filter(
          (x) => x.trainingType === s.trainingType && x.phase === s.phase
        );
        const newGroup = i === 0 || sections[i - 1].phase !== s.phase;
        return (
          <div key={s.id} className="space-y-3">
            {newGroup && (
              <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {SECTION_PHASE_LABELS[s.phase as SectionPhase]}
              </h2>
            )}
            <SectionCard
              section={s}
              index={peers.indexOf(s)}
              total={peers.length}
              infoCounts={infoCounts}
            />
          </div>
        );
      })}

      {showAddSection ? (
        <form
          action={(formData) => {
            run(async () => {
              await addSection(formData);
              setShowAddSection(false);
            });
          }}
          className="rounded-xl border border-dashed border-slate-300 bg-white p-4"
        >
          <div className="mb-2">
            <label className="block text-xs text-slate-500">Section name</label>
            <input
              name="name"
              required
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs text-slate-500">
              Description (optional)
            </label>
            <input
              name="description"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-xs text-slate-500">Training type and phase</label>
            <TagSelects trainingType="ppg" phase="p1" />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            Add section
          </button>
          <button
            type="button"
            onClick={() => setShowAddSection(false)}
            className="ml-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowAddSection(true)}
          className="w-full rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-red-600 hover:bg-red-50"
        >
          + Add section
        </button>
      )}
    </div>
  );
}
