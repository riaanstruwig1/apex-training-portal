"use client";

import { useActionState, useState, useTransition, useRef } from "react";
import {
  saveFormsProcedureSlot,
  deleteFormsProcedureSlot,
  addFormsProcedureSlot,
  sendFormsProcedureWhatsApp,
  type FormsProcedureSlot,
  type SaveSlotState,
  type SendFormState,
} from "@/lib/actions/forms-procedures";

export type Recipient = { name: string; role: "Student" | "Pilot"; phone: string; display: string };

/** Batch 82 (Riaan, 26 Oct 2026): WhatsApp this document to a student/pilot
 * or any number -- the file itself, with the fixed reference note. */
function SendPanel({
  slot,
  recipients,
  note,
  whatsappReady,
  onClose,
}: {
  slot: FormsProcedureSlot;
  recipients: Recipient[];
  note: string;
  whatsappReady: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<SendFormState, FormData>(sendFormsProcedureWhatsApp, undefined);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pick, setPick] = useState("");

  return (
    <form action={action} className="mt-3 space-y-3 rounded-lg border border-green-200 bg-green-50/50 p-3">
      <input type="hidden" name="slot" value={slot.slot} />
      <input type="hidden" name="name" value={name} />
      <div className="text-sm font-semibold text-slate-800">Send &ldquo;{slot.title}&rdquo; on WhatsApp</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600">
          Student or pilot
          <select
            value={pick}
            onChange={(e) => {
              const r = recipients.find((x) => x.phone === e.target.value);
              setPick(e.target.value);
              setPhone(r ? r.display : "");
              setName(r ? r.name : "");
            }}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">-- choose a person --</option>
            {recipients.map((r) => (
              <option key={r.phone + r.name} value={r.phone}>
                {r.name} ({r.role}) {r.display}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          or cell number
          <input
            name="phone"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setPick("");
              setName("");
            }}
            placeholder="082 123 4567"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <p className="rounded-md bg-white px-3 py-2 text-xs text-slate-600">
        <span className="font-semibold">Message with the file:</span> {note}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !phone.trim()}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {pending ? "Sending..." : "Send on WhatsApp"}
        </button>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
          Close
        </button>
        {!whatsappReady && (
          <span className="text-xs text-amber-700">WhatsApp isn&apos;t set up on this server (Green-API variables missing).</span>
        )}
        {state?.ok && <span className="text-sm text-green-700">{state.ok}</span>}
        {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SlotForm({ slot, onDone }: { slot: FormsProcedureSlot; onDone: () => void }) {
  const [state, formAction, isPending] = useActionState<SaveSlotState, FormData>(
    saveFormsProcedureSlot,
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
          placeholder="e.g. Pre-flight checklist"
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
          accept=".zip,.ppt,.pptx,.pdf,.jpg,.jpeg,.png,.gif,.webp,.heic"
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

type SendProps = { recipients: Recipient[]; note: string; whatsappReady: boolean };

function SlotRow({ slot, send }: { slot: FormsProcedureSlot; send: SendProps }) {
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleClear() {
    if (!confirm(`Clear "${slot.title}"? Students and pilots will no longer see this download.`)) return;
    startDeleteTransition(async () => {
      await deleteFormsProcedureSlot(slot.slot);
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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-slate-900">{slot.title}</div>
        <div className="text-xs text-slate-500">
          {slot.originalName} ({formatBytes(slot.fileSize)})
          {slot.uploadedAt && ` · uploaded ${slot.uploadedAt.toLocaleDateString()}`}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <a
          href={`/api/forms-procedures/${slot.filename}`}
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
        <button
          type="button"
          onClick={() => setSending((v) => !v)}
          className="rounded-md bg-green-600 px-2.5 py-1 text-sm font-semibold text-white hover:bg-green-700"
          title="Send this document on WhatsApp"
        >
          Send (WhatsApp)
        </button>
      </div>
    </div>
    {sending && <SendPanel slot={slot} {...send} onClose={() => setSending(false)} />}
    </div>
  );
}

export default function FormsProceduresEditor({
  slots,
  recipients,
  note,
  whatsappReady,
}: {
  slots: FormsProcedureSlot[];
  recipients: Recipient[];
  note: string;
  whatsappReady: boolean;
}) {
  const [isAdding, startAddTransition] = useTransition();

  return (
    <div className="space-y-3">
      {slots.map((slot) => (
        <SlotRow key={slot.slot} slot={slot} send={{ recipients, note, whatsappReady }} />
      ))}
      <button
        type="button"
        disabled={isAdding}
        onClick={() => startAddTransition(() => addFormsProcedureSlot())}
        className="w-full rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 hover:border-red-400 hover:text-red-600 disabled:opacity-60"
      >
        {isAdding ? "Adding slot..." : "+ Add another slot"}
      </button>
    </div>
  );
}
