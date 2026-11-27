import { desc } from "drizzle-orm";
import { db } from "@/db";
import { sirslEntries } from "@/db/schema";
import { requireInstructor } from "@/lib/auth/dal";
import { fmtDate, getSqRoles, sirslRef } from "@/lib/sq";
import SqSubnav from "@/components/sq-subnav";
import { SirslForm } from "@/components/sq-forms";

/** The Single Integrated Reporting System Log (MOP 14.4). */
export default async function SirslPage() {
  const staff = await requireInstructor();
  const roles = await getSqRoles(staff);
  const rows = await db.select().from(sirslEntries).orderBy(desc(sirslEntries.number)).limit(1000);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Single Integrated Reporting System Log (SIRSL)</h1>
          <p className="mt-1 text-sm text-slate-500">
            One continuous record of events, actions and completions (MOP 14.4). Occurrence reports, audits, findings and sign-offs write here by themselves; the Safety Officer and the Quality person can add other entries.
          </p>
        </div>
        <a href="/api/sirsl" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Download Excel</a>
      </div>
      <SqSubnav active="sirsl" />
      {(roles.so || roles.qa) && (
        <details className="rounded-xl border-2 border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Add an entry</summary>
          <div className="mt-3"><SirslForm /></div>
        </details>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">No.</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Area</th>
              <th className="px-3 py-2">Event log / activity</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Date completed and comments</th>
              <th className="px-3 py-2">By who</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">The log is empty.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{sirslRef(r.number)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(r.entryDate)}</td>
                <td className="px-3 py-2 text-xs capitalize text-slate-600">{r.area}</td>
                <td className="px-3 py-2 text-slate-900">{r.event}</td>
                <td className="px-3 py-2 text-slate-700">{r.action ?? ""}</td>
                <td className="px-3 py-2 text-slate-700">{r.completedAt ? `${fmtDate(r.completedAt)}. ` : ""}{r.comments ?? ""}</td>
                <td className="px-3 py-2 text-slate-600">{r.byName ?? "--"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
