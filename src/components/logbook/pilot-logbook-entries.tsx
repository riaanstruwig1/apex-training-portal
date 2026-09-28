"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLogbookEntry, deleteLogbookEntry, type LogEntryState } from "@/lib/actions/logbook";
import { useActionState } from "react";
import {
  computeAccumulatedMinutes,
  formatHoursMinutes,
  formatExerciseCodes,
  formatFlightType,
} from "@/lib/logbook-format";
import { PILOT_FLIGHT_TASKS } from "@/lib/logbook-flight-tasks";
import LogEntryFields from "@/components/logbook/log-entry-fields";
import type { getLogbookEntries } from "@/lib/logbook";

type Entry = Awaited<ReturnType<typeof getLogbookEntries>>[number];

/** Pilot self-sign status ("V23" items 7-9, 25 Sep 2026) -- a pilot-side
 * entry is always self-signed once logged (see addLogbookEntry), so this
 * never shows "Pending" the way the student-facing StatusBadge does; it's
 * still worth a badge so a pre-batch-34 entry that's somehow still
 * unverified (shouldn't happen after the 0029 backfill, but defensively)
 * is visibly different rather than silently blank. */
function SelfSignBadge({ selfSigned }: { selfSigned: boolean }) {
  return selfSigned ? (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      Self-signed
    </span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
      Unsigned
    </span>
  );
}

function DeleteButton({ entryId }: { entryId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="text-slate-600">Delete this flight?</span>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await deleteLogbookEntry(entryId);
              router.refresh();
            })
          }
          className="rounded-md bg-red-600 px-2 py-1 font-semibold text-white disabled:opacity-60"
        >
          {isPending ? "..." : "Confirm"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-slate-400 hover:text-slate-600">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-xs font-medium text-red-600 hover:text-red-800"
    >
      Delete
    </button>
  );
}

/** Inline "Edit" form for one of the pilot's own entries -- same fields as
 * adding a new one (LogEntryFields), pre-filled, submitting to
 * updateLogbookEntry bound to this entry's id. */
function EditForm({
  entry,
  instructors,
  onDone,
}: {
  entry: Entry;
  instructors: { id: string; name: string }[];
  onDone: () => void;
}) {
  const boundAction = updateLogbookEntry.bind(null, entry.id);
  const [state, action, pending] = useActionState<LogEntryState, FormData>(boundAction, undefined);
  const router = useRouter();

  return (
    <form
      action={async (formData) => {
        await action(formData);
        router.refresh();
      }}
      className="grid grid-cols-1 gap-3 rounded-xl border border-red-200 bg-red-50/30 p-4 sm:grid-cols-2"
    >
      <LogEntryFields
        checklist={PILOT_FLIGHT_TASKS}
        checklistLabel="Flight Task"
        instructors={instructors}
        defaultValues={{
          date: entry.date.toISOString().slice(0, 10),
          site: entry.site,
          aircraftType: entry.aircraftType,
          flightType: entry.flightType,
          durationMinutes: entry.durationMinutes,
          launches: entry.launches,
          exerciseCodes: entry.exerciseCodesCovered
            ? entry.exerciseCodesCovered.split(",").map((c) => c.trim())
            : [],
          notes: entry.notes ?? undefined,
          instructorUserId: entry.instructorUserId ?? undefined,
        }}
      />
      {state?.error && (
        <p className="sm:col-span-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Pilot's own flight logbook ("V23" items 7-9 and 11, 25 Sep 2026) -- the
 * counterpart to the student-facing LogbookEntries, but with self-sign
 * status instead of Verified/Pending, "Flight Task" instead of "Exercises",
 * and Edit/Delete on every one of the pilot's own entries (a student never
 * gets this -- their entries are edited/deleted by a CFI/instructor
 * instead, see logbook-table.tsx).
 */
export default function PilotLogbookEntries({
  entries,
  instructors,
}: {
  entries: Entry[];
  instructors: { id: string; name: string }[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const accumulatedById = computeAccumulatedMinutes(entries);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-400">
        No flights logged yet.
      </div>
    );
  }

  return (
    <>
      {/* Mobile: one card per flight */}
      <div className="space-y-3 sm:hidden">
        {entries.map((e) =>
          editingId === e.id ? (
            <EditForm key={e.id} entry={e} instructors={instructors} onDone={() => setEditingId(null)} />
          ) : (
            <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {new Date(e.date).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-slate-500">{e.site}</div>
                </div>
                <SelfSignBadge selfSigned={e.selfSigned} />
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <div>
                  <dt className="text-xs text-slate-400">Aircraft</dt>
                  <dd className="text-slate-700">{e.aircraftType}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Type</dt>
                  <dd className="text-slate-700">{formatFlightType(e.flightType)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Duration</dt>
                  <dd className="text-slate-700">{e.durationMinutes} min</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Accumulated</dt>
                  <dd className="text-slate-700">{formatHoursMinutes(accumulatedById.get(e.id) ?? 0)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Launches</dt>
                  <dd className="text-slate-700">{e.launches}</dd>
                </div>
                {e.instructorName && (
                  <div>
                    <dt className="text-xs text-slate-400">Instructor</dt>
                    <dd className="text-slate-700">{e.instructorName}</dd>
                  </div>
                )}
              </dl>
              {e.exerciseCodesCovered && (
                <div className="mt-2 text-xs text-slate-500">
                  <span className="text-slate-400">Flight Task: </span>
                  {formatExerciseCodes(e.exerciseCodesCovered)}
                </div>
              )}
              <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingId(e.id)}
                  className="text-xs font-medium text-slate-700 hover:text-slate-900"
                >
                  Edit
                </button>
                <DeleteButton entryId={e.id} />
              </div>
            </div>
          )
        )}
      </div>

      {/* Desktop / tablet: table, with an edit row expanding below when active */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Site</th>
              <th className="px-3 py-2">Aircraft</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Accumulated</th>
              <th className="px-3 py-2">Launches</th>
              <th className="px-3 py-2">Instructor</th>
              <th className="px-3 py-2">Flight Task</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) =>
              editingId === e.id ? (
                <tr key={e.id}>
                  <td colSpan={11} className="px-3 py-3">
                    <EditForm entry={e} instructors={instructors} onDone={() => setEditingId(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={e.id}>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{e.site}</td>
                  <td className="px-3 py-2">{e.aircraftType}</td>
                  <td className="px-3 py-2">{formatFlightType(e.flightType)}</td>
                  <td className="px-3 py-2">{e.durationMinutes} min</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                    {formatHoursMinutes(accumulatedById.get(e.id) ?? 0)}
                  </td>
                  <td className="px-3 py-2">{e.launches}</td>
                  <td className="px-3 py-2 text-slate-600">{e.instructorName ?? "—"}</td>
                  <td className="max-w-[12rem] px-3 py-2 text-xs text-slate-500">
                    {formatExerciseCodes(e.exerciseCodesCovered)}
                  </td>
                  <td className="px-3 py-2">
                    <SelfSignBadge selfSigned={e.selfSigned} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingId(e.id)}
                        className="text-xs font-medium text-slate-700 hover:text-slate-900"
                      >
                        Edit
                      </button>
                      <DeleteButton entryId={e.id} />
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
