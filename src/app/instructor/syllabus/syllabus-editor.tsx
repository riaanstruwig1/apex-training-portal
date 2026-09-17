"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addSection,
  updateSection,
  moveSection,
  addExercise,
  deleteExercise,
  deleteSection,
} from "@/lib/actions/syllabus";
import type { InferSelectModel } from "drizzle-orm";
import type { sections, exercises } from "@/db/schema";

type Section = InferSelectModel<typeof sections> & {
  exercises: InferSelectModel<typeof exercises>[];
};

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

function SectionCard({
  section,
  index,
  total,
}: {
  section: Section;
  index: number;
  total: number;
}) {
  const [name, setName] = useState(section.name);
  const [description, setDescription] = useState(section.description ?? "");
  const [showAddExercise, setShowAddExercise] = useState(false);
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
          <div key={ex.id} className="flex items-center justify-between px-4 py-2">
            <div className="text-sm">
              <span className="font-medium">Ex {ex.code}</span> &mdash; {ex.title}
            </div>
            <button
              disabled={isPending}
              onClick={() => run(() => deleteExercise(ex.id))}
              className="text-xs text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="p-4">
        {showAddExercise ? (
          <form
            action={(formData) => {
              run(async () => {
                await addExercise(section.id, formData);
                setShowAddExercise(false);
              });
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <div>
              <label className="block text-xs text-slate-500">Code</label>
              <input
                name="code"
                required
                placeholder="e.g. 19"
                className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[10rem]">
              <label className="block text-xs text-slate-500">Title</label>
              <input
                name="title"
                required
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
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAddExercise(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
            >
              Cancel
            </button>
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

export default function SyllabusEditor({ sections }: { sections: Section[] }) {
  const { isPending, run } = useServerAction();
  const [showAddSection, setShowAddSection] = useState(false);

  return (
    <div className="space-y-6">
      {sections.map((s, i) => (
        <SectionCard key={s.id} section={s} index={i} total={sections.length} />
      ))}

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
