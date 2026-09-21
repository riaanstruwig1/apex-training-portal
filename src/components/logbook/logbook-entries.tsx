import {
  computeAccumulatedMinutes,
  formatHoursMinutes,
  formatExerciseCodes,
  formatFlightType,
} from "@/lib/logbook-format";
import type { getLogbookEntries } from "@/lib/logbook";

function StatusBadge({ entry }: { entry: Awaited<ReturnType<typeof getLogbookEntries>>[number] }) {
  return (
    <>
      {entry.verified ? (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
          Verified
        </span>
      ) : (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          Pending
        </span>
      )}
      {entry.instructorComment && (
        <div className="mt-1 text-xs italic text-slate-500">
          &ldquo;{entry.instructorComment}&rdquo;
        </div>
      )}
    </>
  );
}

/**
 * Renders one student's flight log two ways: a dense table for wider
 * screens, and stacked cards for phones -- a 9-column table doesn't fit a
 * phone screen without an awkward horizontal scroll, so below `sm` we swap
 * to a card per flight instead.
 */
export default function LogbookEntries({
  entries,
}: {
  entries: Awaited<ReturnType<typeof getLogbookEntries>>;
}) {
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
        {entries.map((e) => (
          <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {new Date(e.date).toLocaleDateString()}
                </div>
                <div className="text-xs text-slate-500">{e.site}</div>
              </div>
              <StatusBadge entry={e} />
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
                <dd className="text-slate-700">
                  {formatHoursMinutes(accumulatedById.get(e.id) ?? 0)}
                </dd>
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
                <span className="text-slate-400">Exercises: </span>
                {formatExerciseCodes(e.exerciseCodesCovered)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop / tablet: table */}
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
              <th className="px-3 py-2">Status</th>
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
                <td className="max-w-[12rem] px-3 py-2 text-xs text-slate-500">
                  {formatExerciseCodes(e.exerciseCodesCovered)}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge entry={e} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
