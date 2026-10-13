"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addExerciseContent,
  deleteContentItem,
  getExerciseContent,
  type ContentItemView,
} from "@/lib/actions/content-items";
import { ContentAddForm, ContentItemCards } from "@/components/content-items-panel";

/** Line 70 (1 Oct 2026): the info button next to an exercise. Opens an
 * overlay with the exercise's sub-sections -- notes, pictures, documents,
 * links. The CFI gets an Add+ form and Remove links inside it; everyone
 * else (students, instructors) just reads. */
export default function ExerciseInfoButton({
  exerciseId,
  label,
  count,
  canEdit,
}: {
  exerciseId: string;
  label: string;
  count: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ContentItemView[] | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  function load() {
    startLoading(async () => setItems(await getExerciseContent(exerciseId)));
  }

  function openOverlay() {
    setOpen(true);
    load();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={openOverlay}
        aria-label={`Info for ${label}`}
        title="Exercise info"
        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
          count > 0
            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            : "border-slate-200 text-slate-400 hover:bg-slate-50"
        }`}
      >
        <span aria-hidden className="font-serif italic">i</span>
        {count > 0 ? count : canEdit ? "+" : ""}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="w-full max-w-2xl rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Exercise info</div>
                <h2 className="text-base font-semibold text-slate-900">{label}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
              {items === null || (isLoading && items.length === 0) ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {canEdit
                    ? "No sub-sections yet -- add the first one below."
                    : "Nothing has been added for this exercise yet."}
                </p>
              ) : (
                <ContentItemCards
                  items={items}
                  canEdit={canEdit}
                  removing={isDeleting}
                  onRemove={(item) => {
                    if (!confirm(`Remove "${item.title}"?`)) return;
                    startDeleting(async () => {
                      await deleteContentItem(item.id);
                      load();
                      router.refresh();
                    });
                  }}
                />
              )}

              {canEdit && (
                <ContentAddForm
                  hidden={{ exerciseId }}
                  submit={(fd) => addExerciseContent(undefined, fd)}
                  heading="Add+ sub-section"
                  titlePlaceholder="Title, e.g. Forward launch -- step by step"
                  onAdded={async () => {
                    setItems(await getExerciseContent(exerciseId));
                    router.refresh();
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
