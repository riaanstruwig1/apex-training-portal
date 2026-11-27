import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { occurrenceReports } from "@/db/schema";
import { requireInstructor } from "@/lib/auth/dal";
import { fmtDate, occRef } from "@/lib/sq";
import SqSubnav from "@/components/sq-subnav";
import { OccurrenceForm } from "@/components/sq-forms";

const STATUS: Record<string, string> = { new: "New", action: "Action with CFI", closed: "Closed" };

export default async function SafetyPage() {
  await requireInstructor();
  const rows = await db.select().from(occurrenceReports).orderBy(desc(occurrenceReports.number)).limit(300);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Safety (Safety Officer)</h1>
        <p className="mt-1 text-sm text-slate-500">
          Occurrence and hazard reports. Each one is recorded within the month it happens; accidents and incidents go to SAHPA within the SAHPA timelines (4 hours to 7 days, MOP 13.2).
        </p>
      </div>
      <SqSubnav active="safety" />
      <details className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-amber-900">Report an occurrence or hazard</summary>
        <div className="mt-3">
          <OccurrenceForm />
        </div>
      </details>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">No.</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Injuries</th>
              <th className="px-3 py-2">What happened</th>
              <th className="px-3 py-2">Reported by</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">No occurrence reports yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-3 py-2 font-semibold text-amber-800">
                  <Link href={`/instructor/sq/safety/${r.id}`} className="hover:underline">{occRef(r.number)}</Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(r.occurredAt)}</td>
                <td className="px-3 py-2 capitalize">{r.type.replace("_", " ")}</td>
                <td className={`px-3 py-2 capitalize ${r.injuries === "serious" || r.injuries === "fatal" ? "font-bold text-red-700" : ""}`}>{r.injuries}</td>
                <td className="max-w-md truncate px-3 py-2 text-slate-700">{r.description}</td>
                <td className="px-3 py-2 text-slate-600">{r.confidential ? "Confidential" : r.reporterName ?? "--"}</td>
                <td className="px-3 py-2">{STATUS[r.status] ?? r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
