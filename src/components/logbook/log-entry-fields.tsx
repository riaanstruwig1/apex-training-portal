import { FLIGHT_TYPE_OPTIONS, WIND_DIRECTIONS, WIND_SPEEDS } from "@/lib/logbook-format";

/**
 * The shared set of flight-log input fields -- factored out of the "Add
 * flight" form ("V23" item 11, 25 Sep 2026) so the exact same fields can
 * also be reused, pre-filled, inside a pilot's own "Edit" form
 * (pilot-logbook-entries.tsx, item 7) and an instructor's "Edit" form on a
 * student's logbook (logbook-table.tsx, item 6) -- three different <form>
 * wrappers (different action, different submit button/error handling),
 * one shared body.
 *
 * `checklist`/`checklistLabel` let the caller swap the student-side
 * "Exercises covered" checklist (LOGBOOK_EXERCISES) for the pilot-side
 * "Flight Task" checklist (PILOT_FLIGHT_TASKS) -- both are stored in the
 * same `exerciseCodesCovered` field, this only changes which options and
 * label are shown (see logbook-flight-tasks.ts).
 */
export default function LogEntryFields({
  checklist,
  checklistLabel,
  showChecklistCode = false,
  instructors,
  defaultValues,
  aircraftOptions,
}: {
  checklist: { code: string; label: string }[];
  checklistLabel: string;
  // The student-side exercise list numbers each item ("1. Forward
  // launch...") -- the pilot-side flight-task list has no natural numbering
  // (its codes are just internal slugs like "solo"), so that prefix is
  // opt-in rather than always shown.
  showChecklistCode?: boolean;
  instructors: { id: string; name: string }[];
  // Previously used wings / motors, offered as a drop-down list while typing.
  aircraftOptions?: { wings: string[]; motors: string[] };
  defaultValues?: {
    date?: string; // "YYYY-MM-DD"
    site?: string;
    wing?: string;
    motor?: string;
    windDirection?: string;
    windSpeed?: string;
    flightType?: string;
    durationMinutes?: number;
    launches?: number;
    exerciseCodes?: string[];
    notes?: string;
    instructorUserId?: string;
  };
}) {
  const checkedSet = new Set(defaultValues?.exerciseCodes ?? []);

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-slate-700">Date</label>
        <input
          type="date"
          name="date"
          required
          defaultValue={defaultValues?.date}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Site</label>
        <input
          name="site"
          required
          defaultValue={defaultValues?.site}
          placeholder="Grasslands Flying Club"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Wing</label>
        <input
          name="wing"
          required
          list="wing-options"
          autoComplete="off"
          defaultValue={defaultValues?.wing}
          placeholder="Ozone Rush 6"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <datalist id="wing-options">
          {(aircraftOptions?.wings ?? []).map((w) => (
            <option key={w} value={w} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">
          Motor <span className="text-slate-400">(leave empty for a paraglider flight)</span>
        </label>
        <input
          name="motor"
          list="motor-options"
          autoComplete="off"
          defaultValue={defaultValues?.motor}
          placeholder="Paramotor Rotex 503"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <datalist id="motor-options">
          {(aircraftOptions?.motors ?? []).map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">
          Wind direction <span className="text-slate-400">(optional)</span>
        </label>
        <select
          name="windDirection"
          defaultValue={defaultValues?.windDirection ?? ""}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">-</option>
          {WIND_DIRECTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">
          Wind speed <span className="text-slate-400">(optional)</span>
        </label>
        <select
          name="windSpeed"
          defaultValue={defaultValues?.windSpeed ?? ""}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">-</option>
          {WIND_SPEEDS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Flight type</label>
        <select
          name="flightType"
          defaultValue={defaultValues?.flightType ?? "pg"}
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
          defaultValue={defaultValues?.durationMinutes}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Launches</label>
        <input
          type="number"
          name="launches"
          min={1}
          defaultValue={defaultValues?.launches ?? 1}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-700">
          Instructor for this flight <span className="text-slate-400">(optional)</span>
        </label>
        <select
          name="instructorUserId"
          defaultValue={defaultValues?.instructorUserId ?? ""}
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
          {checklistLabel} <span className="text-slate-400">(optional)</span>
        </label>
        <div className="mt-1 grid max-h-48 grid-cols-1 gap-x-3 overflow-y-auto rounded-md border border-slate-300 p-2 sm:grid-cols-2">
          {checklist.map((item) => (
            <label
              key={item.code}
              className="flex items-center gap-1.5 py-0.5 text-xs text-slate-700"
            >
              <input
                type="checkbox"
                name="exerciseCodesCovered"
                value={item.code}
                defaultChecked={checkedSet.has(item.code)}
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              {showChecklistCode ? `${item.code}. ${item.label}` : item.label}
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
          defaultValue={defaultValues?.notes}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
    </>
  );
}
