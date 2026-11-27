import Link from "next/link";
import { asc, desc, eq, count } from "drizzle-orm";
import { db } from "@/db";
import { auditChecklistItems, auditChecklists, audits } from "@/db/schema";
import { requireInstructor } from "@/lib/auth/dal";
import { auditRef, fmtDate, getSqRoles } from "@/lib/sq";
import SqSubnav from "@/components/sq-subnav";
import { StartAuditForm } from "@/components/sq-forms";

export default async function QualityPage() {
  const staff = await requireInstructor();
  const roles = await getSqRoles(staff);
  const [lists, counts, done] = await Promise.all([
    db.select().from(auditChecklists).where(eq(auditChecklists.active, true)).orderBy(asc(auditChecklists.sortOrder)),
    db.select({ id: auditChecklistItems.checklistId, c: count() }).from(auditChecklistItems).groupBy(auditChecklistItems.checklistId),
    db.select().from(audits).orderBy(desc(audits.number)).limit(300),
  ]);
  const n = new Map(counts.map((c) => [c.id, c.c]));
  const last = new Map<string, Date>();
  for (const a of done) if (a.status === "completed" && a.completedAt && !last.has(a.checklistId)) last.set(a.checklistId, a.completedAt);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Quality (Quality person)</h1>
        <p className="mt-1 text-sm text-slate-500">
          The internal review programme from MOP 13.4: one checklist per review item. Only the Quality person does audits; the CFI, the Safety Officer and the instructors can open every completed audit and its report.
        </p>
      </div>
      <SqSubnav active="quality" />
      {roles.qa ? (
        <section className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-blue-900">Start an audit</h2>
          <StartAuditForm checklists={lists.map((l) => ({ id: l.id, title: l.title, n: n.get(l.id) ?? 0 }))} />
        </section>
      ) : (
        <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
          {roles.qaId ? "Only the Quality person can start an audit." : "No Quality person is set yet. The CFI sets one in Settings."}
        </p>
      )}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Audits</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">No.</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Checklist</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2">Auditor</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {done.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No audits yet.</td></tr>}
              {done.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-blue-800">
                    <Link href={`/instructor/sq/quality/${a.id}`} className="hover:underline">{auditRef(a.number)}</Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(a.auditDate)}</td>
                  <td className="px-3 py-2">{a.checklistTitle}</td>
                  <td className="px-3 py-2 text-slate-600">{a.scope ?? ""}</td>
                  <td className="px-3 py-2 text-slate-600">{a.auditorName}</td>
                  <td className="px-3 py-2">{a.status === "completed" ? <span className="text-green-700">Completed {fmtDate(a.completedAt)}</span> : <span className="text-amber-700">In progress</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Checklists (MOP 13.4 review table)</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-3 py-2">Checklist</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Items</th><th className="px-3 py-2">Last completed</th></tr>
            </thead>
            <tbody>
              {lists.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{l.title}</td>
                  <td className="px-3 py-2 text-slate-600">{l.reference}</td>
                  <td className="px-3 py-2">{n.get(l.id) ?? 0}</td>
                  <td className="px-3 py-2 text-slate-600">{last.has(l.id) ? fmtDate(last.get(l.id)) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">Draft wording from the MOP: Riaan approves it before the first real audit.</p>
      </section>
    </div>
  );
}
