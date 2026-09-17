"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setExerciseStatus } from "@/lib/actions/students";
import type { SectionWithProgress } from "@/lib/progress";

const statusStyles: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600",
  in_progress: "bg-amber-100 text-amber-800",
  signed_off: "bg-green-100 text-green-800",
};

type ExerciseValue = { status: string; notes: string };

function ExerciseRow({
  exercise,
  value,
  dirty,
  onChange,
  onSaveOne,
  isSavingOne,
}: {
  exercise: SectionWithProgress["exercises"][number];
  value: ExerciseValue;
  dirty: boolean;
  onChange: (next: ExerciseValue) => void;
  onSaveOne: () => void;
  isSavingOne: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-2 border-b border-slate-100 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4 ${
        dirty ? "bg-amber-50/60" : ""
      }`}
    >
      <div className="sm:w-56 shrink-0">
        <div className="text-sm font-medium text-slate-900">
          Ex {exercise.code} &mdash; {exercise.title}
          {dirty && (
            <span
              className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle"
              title="Unsaved change"
            />
          )}
        </div>
        {exercise.description && (
          <div className="text-xs text-slate-500">{exercise.description}</div>
        )}
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <select
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
          className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ${statusStyles[value.status]}`}
        >
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="signed_off">Signed off</option>
        </select>
        <input
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          placeholder="Notes (optional)"
          className="min-w-[10rem] flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
        />
        <button
          onClick={onSaveOne}
          disabled={isSavingOne || !dirty}
          className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {isSavingOne ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

export default function ExerciseChecklist({
  studentId,
  sections,
}: {
  studentId: string;
  sections: SectionWithProgress[];
}) {
  const router = useRouter();

  // Original (last-saved) values, keyed by exercise id -- used to detect
  // which rows have unsaved edits and to know what to revert to.
  const original = useMemo(() => {
    const map = new Map<string, ExerciseValue>();
    for (const section of sections) {
      for (const ex of section.exercises) {
        map.set(ex.id, { status: ex.status, notes: ex.notes ?? "" });
      }
    }
    return map;
  }, [sections]);

  const [values, setValues] = useState<Map<string, ExerciseValue>>(
    () => new Map(original)
  );
  const [isSavingAll, startSaveAll] = useTransition();
  const [savingOneId, setSavingOneId] = useState<string | null>(null);

  function valueFor(id: string): ExerciseValue {
    return values.get(id) ?? original.get(id) ?? { status: "not_started", notes: "" };
  }

  function isDirty(id: string): boolean {
    const v = valueFor(id);
    const orig = original.get(id);
    return !orig || v.status !== orig.status || v.notes !== orig.notes;
  }

  function setValue(id: string, next: ExerciseValue) {
    setValues((prev) => {
      const copy = new Map(prev);
      copy.set(id, next);
      return copy;
    });
  }

  const dirtyIds = [...values.keys()].filter((id) => isDirty(id));
  // An exercise that was never touched still needs its original value
  // available for the dirty check above, even though it's not in `values`
  // yet (only rows the person actually edits get added there by setValue).
  const dirtyCount = dirtyIds.length;

  async function saveOne(id: string) {
    setSavingOneId(id);
    const v = valueFor(id);
    await setExerciseStatus(studentId, id, v.status as never, v.notes);
    setSavingOneId(null);
    router.refresh();
  }

  function saveAll() {
    startSaveAll(async () => {
      await Promise.all(
        dirtyIds.map((id) => {
          const v = valueFor(id);
          return setExerciseStatus(studentId, id, v.status as never, v.notes);
        })
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div
        className={`sticky top-0 z-10 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 transition-colors ${
          dirtyCount > 0
            ? "border-amber-300 bg-amber-50"
            : "border-slate-200 bg-white"
        }`}
      >
        <span className="text-sm text-slate-600">
          {dirtyCount > 0
            ? `${dirtyCount} exercise${dirtyCount === 1 ? "" : "s"} with unsaved changes`
            : "No unsaved changes"}
        </span>
        <button
          onClick={saveAll}
          disabled={isSavingAll || dirtyCount === 0}
          className="rounded-md bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSavingAll ? "Saving..." : "Save all changes"}
        </button>
      </div>

      {sections.map((section) => (
        <div
          key={section.id}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        >
          <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {section.name}
              </h3>
              {section.description && (
                <p className="text-xs text-slate-500">{section.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!section.isUnlocked && (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                  Locked for student
                </span>
              )}
              <span className="text-xs font-medium text-slate-500">
                {section.signedOffCount} / {section.totalCount}
              </span>
            </div>
          </div>
          <div>
            {section.exercises.map((exercise) => (
              <ExerciseRow
                key={exercise.id}
                exercise={exercise}
                value={valueFor(exercise.id)}
                dirty={isDirty(exercise.id)}
                onChange={(next) => setValue(exercise.id, next)}
                onSaveOne={() => saveOne(exercise.id)}
                isSavingOne={savingOneId === exercise.id}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
