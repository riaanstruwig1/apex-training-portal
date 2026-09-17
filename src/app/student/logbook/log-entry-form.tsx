"use client";

import { useActionState } from "react";
import { addLogbookEntry, type LogEntryState } from "@/lib/actions/logbook";
import { LOGBOOK_EXERCISES } from "@/lib/logbook-exercises";
import { FLIGHT_TYPE_OPTIONS } from "@/lib/logbook-format";

export default function LogEntryForm({
  defaultSite,
  defaultAircraftType,
  instructors,
}: {
  defaultSite?: string;
  defaultAircraftType?: string;
  instructors: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<LogEntryState, FormData>(
    addLogbookEntry,
    undefined
  );

  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className="block text-xs font-medium text-slate-700">Date</label>
        <input
          type="date"
          name="date"
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Site</label>
        <input
          name="site"
          required
          defaultValue={defaultSite}
          placeholder="Grasslands Flying Club"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">
          Wing / motor used
        </label>
        <input
          name="aircraftType"
          required
          defaultValue={defaultAircraftType}
          placeholder="Ozone MotoP 24 / Cumulus"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Flight type</label>
        <select
          name="flightType"
          defaultValue="pg"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {FLIGHT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">
          Duration (minutes)
        </label>
        <input
          type="number"
          name="durationMinutes"
          min={1}
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Launches</label>
        <input
          type="number"
          name="launches"
          min={1}
          defaultValue={1}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-700">
          Instructor for this flight <span className="text-slate-400">(optional)</span>
        </label>
        <select
          name="instructorUserId"
          defaultValue=""
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Not sure / not applicable</option>
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-700">
          Exercises covered <span className="text-slate-400">(optional)</span>
        </label>
        <div className="mt-1 grid max-h-48 grid-cols-1 gap-x-3 overflow-y-auto rounded-md border border-slate-300 p-2 sm:grid-cols-2">
          {LOGBOOK_EXERCISES.map((exercise) => (
            <label
              key={exercise.code}
              className="flex items-center gap-1.5 py-0.5 text-xs text-slate-700"
            >
              <input
                type="checkbox"
                name="exerciseCodesCovered"
                value={exercise.code}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              {exercise.code}. {exercise.label}
            </label>
          ))}
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-700">
          Notes <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          name="notes"
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {state?.error && (
        <p className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Add flight"}
        </button>
      </div>
    </form>
  );
}
