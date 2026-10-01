"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addExerciseContent,
  deleteContentItem,
  getExerciseContent,
  type AddContentState,
  type ContentItemView,
} from "@/lib/actions/content-items";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(item: ContentItemView) {
  return !!item.mimeType?.startsWith("image/");
}

function AddForm({ exerciseId, onAdded }: { exerciseId: string; onAdded: () => Promise<void> }) {
  // Submitted by hand (not a form action) so the form is cleared exactly
  // once, at the moment the new item appears -- React's automatic reset
  // after a form action could otherwise land late and wipe what the CFI
  // has started typing for the next sub-section.
  const [state, setState] = useState<AddContentState>(undefined);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await addExerciseContent(undefined, fd);
      if (result && "success" in result) {
        await onAdded();
        form.reset();
      }
      setState(result);
    });
  }
  const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
      <input type="hidden" name="exerciseId" value={exerciseId} />
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add+ sub-section</div>
      <input name="title" placeholder="Title, e.g. Forward launch -- step by step" className={inputClass} />
      <textarea name="body" rows={3} placeholder="Note (optional)" className={inputClass} />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate-500">
          Picture or document (optional, max 25MB)
          <input
            type="file"
            name="file"
            accept="image/png,image/jpeg,image/webp,image/gif,.pdf,.doc,.docx,.ppt,.pptx,.zip"
            className="mt-1 block w-full text-xs"
          />
        </label>
        <label className="text-xs text-slate-500">
          Or a link (video, Google Drive...)
          <input name="linkUrl" placeholder="https://..." className={`${inputClass} mt-1`} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "Adding..." : "Add"}
        </button>
        {state && "error" in state && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

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
                items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                      {canEdit && (
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => {
                            if (!confirm(`Remove "${item.title}"?`)) return;
                            startDeleting(async () => {
                              await deleteContentItem(item.id);
                              load();
                              router.refresh();
                            });
                          }}
                          className="shrink-0 text-xs text-slate-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {item.body && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.body}</p>
                    )}
                    {item.filename && isImage(item) && (
                      // eslint-disable-next-line @next/next/no-img-element -- auth-gated upload, not a static asset
                      <img
                        src={`/api/content-items/${item.filename}`}
                        alt={item.title}
                        className="mt-2 max-h-96 w-auto rounded-md border border-slate-100"
                      />
                    )}
                    {item.filename && !isImage(item) && (
                      <a
                        href={`/api/content-items/${item.filename}`}
                        className="mt-2 inline-block text-sm font-medium text-red-600 hover:underline"
                      >
                        Download {item.originalName} ({formatBytes(item.fileSize)})
                      </a>
                    )}
                    {item.linkUrl && (
                      <a
                        href={item.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block text-sm font-medium text-red-600 hover:underline"
                      >
                        Open link →
                      </a>
                    )}
                  </div>
                ))
              )}

              {canEdit && (
                <AddForm
                  exerciseId={exerciseId}
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
