"use client";

import { useActionState, useState, useTransition, useRef } from "react";
import {
  saveStudyMaterialSlot,
  deleteStudyMaterialSlot,
  type StudyMaterialSlot,
  type SaveSlotState,
} from "@/lib/actions/study-materials";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SlotForm({ slot, onDone }: { slot: StudyMaterialSlot; onDone: () => void }) {
  const [state, formAction, isPending] = useActionState<SaveSlotState, FormData>(
    saveStudyMaterialSlot,
    undefined
  );
  const [title, setTitle] = useState(slot.title ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A successful save closes the form back to the read-only view.
  if (state && "success" in state) {
    onDone();
  }

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <input type="hidden" name="slot" value={slot.slot} />
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Title</label>
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Airlaw Study Notes"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          {slot.filename ? "Replace file (leave blank to keep the current one)" : "File"}
        </label>
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept=".zip,.ppt,.pptx,.doc,.docx,.pdf"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        {slot.filename && (
          <p className="mt-1 text-xs text-slate-400">
            Currently: {slot.originalName} ({formatBytes(slot.fileSize)})
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
        {state && "error" in state && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

function SlotRow({ slot }: { slot: StudyMaterialSlot }) {
  const [editing, setEditing] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleClear() {
    if (!confirm(`Clear "${slot.title}"? Students will no longer see this download.`)) return;
    startDeleteTransition(async () => {
      await deleteStudyMaterialSlot(slot.slot);
    });
  }

  if (editing) {
    return <SlotForm slot={slot} onDone={() => setEditing(false)} />;
  }

  if (!slot.filename) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 hover:border-red-400 hover:text-red-600"
      >
        <span>Slot {slot.slot} &mdash; empty</span>
        <span>+ Add item</span>
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
      <div>
        <div className="text-sm font-medium text-slate-900">{slot.title}</div>
        <div className="text-xs text-slate-500">
          {slot.originalName} ({formatBytes(slot.fileSize)})
          {slot.uploadedAt && ` · uploaded ${slot.uploadedAt.toLocaleDateString()}`}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <a
          href={`/api/study-material/${slot.filename}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Download
        </a>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm text-red-600 hover:text-red-700"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={isDeleting}
          onClick={handleClear}
          className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-60"
        >
          {isDeleting ? "Clearing..." : "Clear"}
        </button>
      </div>
    </div>
  );
}

export default function StudyMaterialEditor({ slots }: { slots: StudyMaterialSlot[] }) {
  return (
    <div className="space-y-3">
      {slots.map((slot) => (
        <SlotRow key={slot.slot} slot={slot} />
      ))}
    </div>
  );
}
