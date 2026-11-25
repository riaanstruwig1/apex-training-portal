"use client";

import { useState } from "react";
import { FLIGHT_TYPE_OPTIONS, WIND_DIRECTIONS, WIND_SPEEDS } from "@/lib/logbook-format";

/** Batch 107 (Riaan, 25 Nov 2026): on "Add flight" the values of the last
 * flight are filled in a shade lighter; they are saved as they are unless
 * the person types or picks something else (then the text turns normal). */
const PREFILL = "text-slate-400";
const clearPrefill = (e: { currentTarget: HTMLElement }) => e.currentTarget.classList.remove(PREFILL);

/** "Reverse launch" can't be done on a trike / chute (PPT/PPC) -- batch 107. */
export function isReverseLaunch(label: string): boolean {
  return /reverse launch/i.test(label);
}

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
  prefilled = false,
}: {
  checklist: { code: string; label: string }[];
  checklistLabel: string;
  // The student-side exercise list numbers each item ("1. Forward
  // launch...") -- the pilot-side flight-task list has no natural numbering
  // (its codes are just internal slugs like "solo"), so that prefix is
  // opt-in rather than always shown.
  showChecklistCode?: boolean;
  instructors: { id: string; name: string }[];
  /** Batch 107: the defaults are copied from the last flight -- show them lighter. */
  prefilled?: boolean;
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
  const [flightType, setFlightType] = useState(defaultValues?.flightType ?? "pg");
  // Lighter text + "turn normal on first change" for copied-from-last-flight values.
  const pf = (has: unknown) => (prefilled && has !== undefined && has !== null && has !== "" ? ` ${PREFILL}` : "");
  const pfProps = { onInput: clearPrefill, onChange: clearPrefill };

  return (
    <>
      {prefilled && (
        <p className="text-xs text-slate-500 sm:col-span-2">
          Light grey = copied from your last flight. It is saved like that unless you type or pick something else.
        </p>
      )}
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
          {...pfProps}
          className={`mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm${pf(defaultValues?.site)}`}
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
          {...pfProps}
          className={`mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm${pf(defaultValues?.wing)}`}
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
          {...pfProps}
          className={`mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm${pf(defaultValues?.motor)}`}
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
          {...pfProps}
          className={`mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm${pf(defaultValues?.windDirection)}`}
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
          {...pfProps}
          className={`mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm${pf(defaultValues?.windSpeed)}`}
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
          onInput={clearPrefill}
          onChange={(e) => {
            clearPrefill(e);
            setFlightType(e.currentTarget.value);
          }}
          className={`mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm${pf(defaultValues?.flightType)}`}
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
          {...pfProps}
          className={`mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm${pf(defaultValues?.durationMinutes)}`}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Launches</label>
        <input
          type="number"
          name="launches"
          min={1}
          defaultValue={defaultValues?.launches ?? 1}
          {...pfProps}
          className={`mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm${pf(defaultValues?.launches)}`}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-700">
          Instructor for this flight <span className="text-slate-400">(optional)</span>
        </label>
        <select
          name="instructorUserId"
          defaultValue={defaultValues?.instructorUserId ?? ""}
          {...pfProps}
          className={`mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm${pf(defaultValues?.instructorUserId)}`}
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
          {checklist.map((item) => {
            // Batch 107: no reverse launch on a trike / chute.
            const off = flightType === "ppt" && isReverseLaunch(item.label);
            return (
              <label
                key={item.code}
                title={off ? "Not for PPT/PPC flights" : undefined}
                className={`flex items-center gap-1.5 py-0.5 text-xs ${off ? "text-slate-300 line-through" : "text-slate-700"}`}
              >
                <input
                  key={off ? "off" : "on"}
                  type="checkbox"
                  name="exerciseCodesCovered"
                  value={item.code}
                  disabled={off}
                  defaultChecked={!off && checkedSet.has(item.code)}
                  className="h-3.5 w-3.5 rounded border-slate-300"
                />
                {showChecklistCode ? `${item.code}. ${item.label}` : item.label}
              </label>
            );
          })}
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
