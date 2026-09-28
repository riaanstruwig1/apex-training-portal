"use client";

import { useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  verifyLogbookEntry,
  updateLogbookComment,
  adminUpdateLogbookEntry,
  adminDeleteLogbookEntry,
  type LogEntryState,
} from "@/lib/actions/logbook";
import type { getLogbookEntries } from "@/lib/logbook";
import {
  computeAccumulatedMinutes,
  formatHoursMinutes,
  formatExerciseCodes,
  formatFlightType,
} from "@/lib/logbook-format";
import { LOGBOOK_EXERCISES } from "@/lib/logbook-exercises";
import LogEntryFields from "@/components/logbook/log-entry-fields";

/** CFI/Instructor edit of one student entry ("V23" item 6, 25 Sep 2026) --
 * same fields as the student's own "Add flight" form, pre-filled, submitting
 * to adminUpdateLogbookEntry. Deliberately does NOT touch verified status --
 * see that action's own comment. */
function EditForm({
  entry,
  studentId,
  instructors,
  onDone,
}: {
  entry: Awaited<ReturnType<typeof getLogbookEntries>>[number];
  studentId: string;
  instructors: { id: string; name: string }[];
  onDone: () => void;
}) {
  const boundAction = adminUpdateLogbookEntry.bind(null, entry.id, studentId);
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
        checklist={LOGBOOK_EXERCISES}
        checklistLabel="Exercises covered"
        showChecklistCode
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

/** CFI/Instructor delete of a student entry ("V23" item 6), with a confirm
 * step -- same pattern as VerifyPaperButton elsewhere in this app. */
function DeleteEntryButton({ entryId, studentId }: { entryId: string; studentId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="text-slate-600">Delete?</span>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await adminDeleteLogbookEntry(entryId, studentId);
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

function VerifyCell({
  entryId,
  studentId,
  verified,
  instructorComment,
}: {
  entryId: string;
  studentId: string;
  verified: boolean;
  instructorComment: string | null;
}) {
  const [comment, setComment] = useState(instructorComment ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function verify() {
    startTransition(async () => {
      await verifyLogbookEntry(entryId, studentId, comment);
      router.refresh();
    });
  }

  function saveComment() {
    startTransition(async () => {
      await updateLogbookComment(entryId, studentId, comment);
      router.refresh();
    });
  }

  return (
    <div className="flex min-w-[12rem] flex-col gap-1.5">
      {verified ? (
        <span className="w-fit rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
          Verified
        </span>
      ) : null}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comment (optional)"
        rows={1}
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
      />
      {verified ? (
        <button
          onClick={saveComment}
          disabled={isPending}
          className="w-fit rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {isPending ? "..." : "Save comment"}
        </button>
      ) : (
        <button
          onClick={verify}
          disabled={isPending}
          className="w-fit rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {isPending ? "..." : "Verify"}
        </button>
      )}
    </div>
  );
}

/** One flight, as a card -- used below `sm` instead of the table, which
 * forces an awkward horizontal scroll at phone width (10 columns, plus a
 * min-w-[12rem] verify cell -- Notes4 item 31, found 21 Sep 2026 alongside
 * the identical StudentTable/StudentCard split on the instructor list). */
function LogbookEntryCard({
  entry,
  accumulatedMinutes,
  studentId,
  onEdit,
}: {
  entry: Awaited<ReturnType<typeof getLogbookEntries>>[number];
  accumulatedMinutes: number;
  studentId: string;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-slate-900">
            {new Date(entry.date).toLocaleDateString()}
          </div>
          <div className="text-xs text-slate-500">{entry.site}</div>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {formatFlightType(entry.flightType)}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        <div>
          <dt className="text-xs text-slate-400">Aircraft</dt>
          <dd className="text-slate-700">{entry.aircraftType}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Duration</dt>
          <dd className="text-slate-700">{entry.durationMinutes} min</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Accumulated</dt>
          <dd className="text-slate-700">{formatHoursMinutes(accumulatedMinutes)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Launches</dt>
          <dd className="text-slate-700">{entry.launches}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Instructor</dt>
          <dd className="text-slate-700">{entry.instructorName ?? "—"}</dd>
        </div>
        {entry.exerciseCodesCovered && (
          <div className="col-span-2">
            <dt className="text-xs text-slate-400">Exercises</dt>
            <dd className="text-xs text-slate-500">
              {formatExerciseCodes(entry.exerciseCodesCovered)}
            </dd>
          </div>
        )}
      </dl>
      <div className="mt-3 flex items-start justify-between gap-3 border-t border-slate-100 pt-3">
        <VerifyCell
          entryId={entry.id}
          studentId={studentId}
          verified={entry.verified}
          instructorComment={entry.instructorComment}
        />
        {/* "V23" item 6 (25 Sep 2026): CFI/Instructor can edit or delete a
         * student's entry outright, not just verify/comment on it. */}
        <div className="flex shrink-0 items-center gap-3 pt-1">
          <button type="button" onClick={onEdit} className="text-xs font-medium text-slate-700 hover:text-slate-900">
            Edit
          </button>
          <DeleteEntryButton entryId={entry.id} studentId={studentId} />
        </div>
      </div>
    </div>
  );
}

export default function LogbookTable({
  studentId,
  entries,
  instructors,
}: {
  studentId: string;
  entries: Awaited<ReturnType<typeof getLogbookEntries>>;
  instructors: { id: string; name: string }[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-500">No flight log entries yet.</p>
    );
  }

  const accumulatedById = computeAccumulatedMinutes(entries);

  return (
    <>
      {/* Mobile: one card per flight, avoids horizontal-scrolling a 10-column table */}
      <div className="space-y-3 sm:hidden">
        {entries.map((e) =>
          editingId === e.id ? (
            <EditForm
              key={e.id}
              entry={e}
              studentId={studentId}
              instructors={instructors}
              onDone={() => setEditingId(null)}
            />
          ) : (
            <LogbookEntryCard
              key={e.id}
              entry={e}
              accumulatedMinutes={accumulatedById.get(e.id) ?? 0}
              studentId={studentId}
              onEdit={() => setEditingId(e.id)}
            />
          )
        )}
      </div>

      {/* Tablet / desktop: table */}
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
              <th className="px-3 py-2">Exercises</th>
              <th className="px-3 py-2">Status / comment</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) =>
              editingId === e.id ? (
                <tr key={e.id}>
                  <td colSpan={11} className="px-3 py-3">
                    <EditForm
                      entry={e}
                      studentId={studentId}
                      instructors={instructors}
                      onDone={() => setEditingId(null)}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={e.id}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(e.date).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">{e.site}</td>
                  <td className="px-3 py-2">{e.aircraftType}</td>
                  <td className="px-3 py-2">{formatFlightType(e.flightType)}</td>
                  <td className="px-3 py-2">{e.durationMinutes} min</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                    {formatHoursMinutes(accumulatedById.get(e.id) ?? 0)}
                  </td>
                  <td className="px-3 py-2">{e.launches}</td>
                  <td className="px-3 py-2 text-slate-600">{e.instructorName ?? "—"}</td>
                  <td className="max-w-[14rem] px-3 py-2 text-xs text-slate-500">
                    {formatExerciseCodes(e.exerciseCodesCovered)}
                  </td>
                  <td className="px-3 py-2">
                    <VerifyCell
                      entryId={e.id}
                      studentId={studentId}
                      verified={e.verified}
                      instructorComment={e.instructorComment}
                    />
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
                      <DeleteEntryButton entryId={e.id} studentId={studentId} />
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
