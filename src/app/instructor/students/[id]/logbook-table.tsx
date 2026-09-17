"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyLogbookEntry, updateLogbookComment } from "@/lib/actions/logbook";
import type { getLogbookEntries } from "@/lib/logbook";
import {
  computeAccumulatedMinutes,
  formatHoursMinutes,
  formatExerciseCodes,
  formatFlightType,
} from "@/lib/logbook-format";

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

export default function LogbookTable({
  studentId,
  entries,
}: {
  studentId: string;
  entries: Awaited<ReturnType<typeof getLogbookEntries>>;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-slate-500">No flight log entries yet.</p>
    );
  }

  const accumulatedById = computeAccumulatedMinutes(entries);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((e) => (
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
