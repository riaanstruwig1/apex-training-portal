"use client";

import { useState } from "react";

/**
 * V22 rollout items 6/7 (23 Sep 2026): cumulative + renewal-window flight
 * totals, shown on the pilot's View profile page (item 6) and above the
 * Logbook page's entry form (item 7). Per Riaan's answer, the look-back
 * window isn't a stored setting -- "Viewer picks it on the page" -- so the
 * 12/24-month toggle below is local component state, not persisted
 * anywhere.
 *
 * `entries` is deliberately just {date, durationMinutes} as epoch-ms
 * numbers, not the full logbook entry shape -- this is a client component,
 * and passing only what it needs keeps the server->client payload small and
 * sidesteps any question of how richer field types (Date, etc.) serialize
 * across that boundary.
 */
type Entry = { date: number; durationMinutes: number };

function fmtHours(totalMinutes: number): string {
  return (totalMinutes / 60).toFixed(1);
}

function monthsAgo(months: number): number {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.getTime();
}

export default function FlightSummary({
  entries,
  startingFlightCount,
  startingFlightHours,
}: {
  entries: Entry[];
  startingFlightCount: number;
  startingFlightHours: number;
}) {
  const [months, setMonths] = useState<12 | 24>(12);

  const cumulativeFlights = startingFlightCount + entries.length;
  const cumulativeMinutes =
    startingFlightHours * 60 + entries.reduce((sum, e) => sum + e.durationMinutes, 0);

  // Window totals only ever count logged, dated flights -- the paper-
  // logbook baseline (startingFlightCount/Hours) has no date attached to
  // it, so it can't meaningfully fall inside or outside a look-back window.
  const cutoff = monthsAgo(months);
  const windowEntries = entries.filter((e) => e.date >= cutoff);
  const windowFlights = windowEntries.length;
  const windowMinutes = windowEntries.reduce((sum, e) => sum + e.durationMinutes, 0);

  const toggleBtn = (m: 12 | 24) =>
    `px-2.5 py-1 text-xs font-medium ${
      months === m ? "bg-red-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
    }`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Flight summary</h3>
        <div className="flex overflow-hidden rounded-md border border-slate-300">
          <button type="button" onClick={() => setMonths(12)} className={toggleBtn(12)}>
            Last 12 months
          </button>
          <button type="button" onClick={() => setMonths(24)} className={toggleBtn(24)}>
            Last 24 months
          </button>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-400">Total flights</dt>
          <dd className="text-lg font-semibold text-slate-900">{cumulativeFlights}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Total hours</dt>
          <dd className="text-lg font-semibold text-slate-900">{fmtHours(cumulativeMinutes)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Flights, last {months}mo</dt>
          <dd className="text-lg font-semibold text-slate-900">{windowFlights}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-400">Hours, last {months}mo</dt>
          <dd className="text-lg font-semibold text-slate-900">{fmtHours(windowMinutes)}</dd>
        </div>
      </dl>
      {(startingFlightCount > 0 || startingFlightHours > 0) && (
        <p className="mt-3 text-xs text-slate-400">
          Totals include {startingFlightCount} flight{startingFlightCount === 1 ? "" : "s"} /{" "}
          {fmtHours(startingFlightHours * 60)} hrs logged before joining (paper logbook baseline).
        </p>
      )}
    </div>
  );
}
