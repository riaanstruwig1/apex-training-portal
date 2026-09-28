"use client";

import { useActionState } from "react";
import { addLogbookEntry, type LogEntryState } from "@/lib/actions/logbook";
import { LOGBOOK_EXERCISES } from "@/lib/logbook-exercises";
import { PILOT_FLIGHT_TASKS } from "@/lib/logbook-flight-tasks";
import LogEntryFields from "@/components/logbook/log-entry-fields";

export default function LogEntryForm({
  mode,
  defaultSite,
  defaultAircraftType,
  instructors,
}: {
  // "V23" item 11 (25 Sep 2026): the pilot side of the logbook shows a fixed
  // "Flight Task" checklist instead of the student "Exercises covered"
  // list -- see log-entry-fields.tsx and logbook-flight-tasks.ts.
  mode: "student" | "pilot";
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
      <LogEntryFields
        checklist={mode === "pilot" ? PILOT_FLIGHT_TASKS : LOGBOOK_EXERCISES}
        checklistLabel={mode === "pilot" ? "Flight Task" : "Exercises covered"}
        showChecklistCode={mode === "student"}
        instructors={instructors}
        defaultValues={{ site: defaultSite, aircraftType: defaultAircraftType }}
      />

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
