"use client";

import { useActionState, useState } from "react";
import { importLogbookCsv, type CsvImportState } from "@/lib/actions/logbook";
import { FLIGHT_TYPE_OPTIONS } from "@/lib/logbook-format";

export default function CsvImportForm() {
  const [state, action, pending] = useActionState<CsvImportState, FormData>(
    importLogbookCsv,
    undefined
  );
  const [open, setOpen] = useState(false);

  return (
    <details
      className="rounded-xl border border-slate-200 bg-white p-4"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">
        Import flights from a CSV or Excel file
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-slate-500">
          Upload a .csv or .xlsx export from your flight-tracking app (an .xlsx with one
          sheet per year, e.g. a FlySkyHy export, is read in full). We read the{" "}
          <strong>Date</strong>, <strong>Take Off Site</strong>, <strong>Aircraft</strong> and{" "}
          <strong>Duration</strong> columns (column names can vary a bit, e.g. &ldquo;Site&rdquo;
          or &ldquo;Wing&rdquo; also work). Duration can be minutes (e.g. 45), hours:minutes (e.g.
          0:45), or a decimal-hours column. Everything else (launches, exercises, instructor)
          isn&rsquo;t in a typical export -- add those by hand afterwards if you need them.
        </p>
        <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700">CSV or Excel file</label>
            <input
              type="file"
              name="csvFile"
              accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              required
              className="mt-1 w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Flight type for these rows
            </label>
            <select
              name="flightType"
              defaultValue="ppg"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {FLIGHT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {state?.error && (
            <p className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}
          {state?.imported !== undefined && (
            <div className="sm:col-span-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
              <p>
                Imported {state.imported} flight{state.imported === 1 ? "" : "s"}.
                {state.skipped.length > 0 && ` Skipped ${state.skipped.length} row(s).`}
              </p>
              {state.skipped.length > 0 && (
                <ul className="mt-1 list-inside list-disc text-xs text-green-700">
                  {state.skipped.map((s, i) => (
                    <li key={`${s.row}-${i}`}>
                      {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
            >
              {pending ? "Importing..." : "Import file"}
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}
