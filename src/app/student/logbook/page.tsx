import { requireStudent } from "@/lib/auth/dal";
import { getLogbookEntries, getInstructorRoster } from "@/lib/logbook";
import LogEntryForm from "./log-entry-form";
import LogbookEntries from "./logbook-entries";
import CsvImportForm from "./csv-import-form";

export default async function StudentLogbookPage() {
  const { user } = await requireStudent();
  const [entries, instructors] = await Promise.all([
    getLogbookEntries(user.id),
    getInstructorRoster(),
  ]);

  // Entries are sorted most-recent-first for display, but the last flight
  // *logged* (by date) is what we want to default the next entry's site and
  // wing/motor to -- most flights happen at the same place on the same gear
  // as the one before.
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
