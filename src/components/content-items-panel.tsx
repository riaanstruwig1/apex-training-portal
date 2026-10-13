"use client";

import { useState, useTransition } from "react";
import type { ContentItemView } from "@/lib/actions/content-items";

/* Shared pieces of the CFI "Add+" content overlays: line 70 (exercise
 * info) and line 62 (rating requirements). */

type FormResult = { error: string } | { success: true } | undefined;

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(item: ContentItemView) {
  return !!item.mimeType?.startsWith("image/");
}

export function ContentItemCards({
  items,
  canEdit,
  onRemove,
  removing,
}: {
  items: ContentItemView[];
  canEdit: boolean;
  onRemove: (item: ContentItemView) => void;
  removing?: boolean;
}) {
  return (
    <>
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
            {canEdit && (
              <button
                type="button"
                disabled={removing}
                onClick={() => onRemove(item)}
                className="shrink-0 text-xs text-slate-400 hover:text-red-600"
              >
                Remove
              </button>
            )}
          </div>
          {item.body && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.body}</p>}
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
      ))}
    </>
  );
}

/** The CFI's Add+ form. Submitted by hand (not a form action) so the form
 * is cleared exactly once, at the moment the new item appears -- React's
 * automatic reset after a form action could otherwise land late and wipe
 * what the CFI has started typing for the next one. */
export function ContentAddForm({
  hidden,
  submit,
  onAdded,
  heading,
  titlePlaceholder,
}: {
  hidden: Record<string, string>;
  submit: (fd: FormData) => Promise<FormResult>;
  onAdded: () => Promise<void>;
  heading: string;
  titlePlaceholder: string;
}) {
  const [state, setState] = useState<FormResult>(undefined);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await submit(fd);
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
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</div>
      <input name="title" placeholder={titlePlaceholder} className={inputClass} />
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
