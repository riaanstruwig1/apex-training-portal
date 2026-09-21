import { requirePilot } from "@/lib/auth/dal";
import { getLogbookEntries, getInstructorRoster } from "@/lib/logbook";
import LogEntryForm from "@/components/logbook/log-entry-form";
import LogbookEntries from "@/components/logbook/logbook-entries";
import CsvImportForm from "@/components/logbook/csv-import-form";

// Same flight logbook as the student side (Notes4: "as instructor, CFI ...
// have we added it in that an instructor is also a pilot with the same
// screen as a normal pilot") -- a CFI/instructor's own pilot profile had no
// logbook at all, only students did. flightLogEntries.studentId is really
// just "whichever user this flight belongs to" (a plain FK to users.id, no
// role check in the schema), so this reuses the exact same components and
// server actions as /student/logbook rather than a parallel pilot-only
// implementation.
export default async function PilotLogbookPage() {
  const { user } = await requirePilot();
  const [entries, instructors] = await Promise.all([
    getLogbookEntries(user.id),
    getInstructorRoster(),
  ]);

  const lastEntry = entries[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Flight logbook</h1>
        <p className="text-sm text-slate-500">
          Log every flight. Your instructor countersigns entries once verified.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <LogEntryForm
          defaultSite={lastEntry?.site}
          defaultAircraftType={lastEntry?.aircraftType}
          instructors={instructors}
        />
      </div>

      <CsvImportForm />

      <LogbookEntries entries={entries} />
    </div>
  );
}
