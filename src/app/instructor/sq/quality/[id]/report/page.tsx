import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditResults, audits, qsActions } from "@/db/schema";
import { requireInstructor } from "@/lib/auth/dal";
import { actionRef, auditRef, fmtDate } from "@/lib/sq";
import PrintButton from "@/components/print-button";

const LABEL: Record<string, string> = { compliant: "Compliant", non_compliant: "Non-compliant", observation: "Observation", na: "N/A" };

/** Batch 111: the audit report (print / save as PDF), same layout for every audit. */
export default async function AuditReportPage(props: PageProps<"/instructor/sq/quality/[id]/report">) {
  await requireInstructor();
  const { id } = await props.params;
  const [au] = await db.select().from(audits).where(eq(audits.id, id)).limit(1);
  if (!au || au.status !== "completed") notFound();
  const [items, findings] = await Promise.all([
    db.select().from(auditResults).where(eq(auditResults.auditId, id)).orderBy(asc(auditResults.position)),
    db.select().from(qsActions).where(eq(qsActions.sourceId, id)).orderBy(asc(qsActions.number)),
  ]);
  const c = (k: string) => items.filter((i) => i.result === k).length;
  return (
    <div className="mx-auto max-w-4xl space-y-5 bg-white p-6 text-sm text-slate-900">
      <div className="print-hide flex items-center justify-between">
        <Link href={`/instructor/sq/quality/${id}`} className="text-sm text-slate-500 hover:text-red-600">&larr; Back to the audit</Link>
        <PrintButton />
      </div>
      <header className="border-b-2 border-slate-800 pb-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">Paramotor SA (Pty) Ltd t/a Apex Adventures - SACAA DTO 0012</p>
        <h1 className="text-2xl font-bold">Internal audit report {auditRef(au.number)}</h1>
        <p className="text-base">{au.checklistTitle}</p>
        <p className="mt-1 text-slate-600">Date: {fmtDate(au.auditDate)} · Scope: {au.scope || "--"} · Auditor (Quality person): {au.auditorName} · Completed: {fmtDate(au.completedAt)}</p>
      </header>
      <section>
        <h2 className="text-base font-bold">Summary</h2>
        <p>
          {items.length} items: {c("compliant")} compliant, {c("non_compliant")} non-compliant, {c("observation")} observation(s), {c("na")} not applicable.
          {findings.length > 0 ? ` ${findings.length} finding(s) raised.` : " No findings raised."}
        </p>
      </section>
      <section>
        <h2 className="mb-1 text-base font-bold">Results</h2>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-slate-800 text-xs uppercase">
              <th className="py-1 pr-2">No.</th><th className="py-1 pr-2">Item</th><th className="py-1 pr-2">Reference</th><th className="py-1 pr-2">Result</th><th className="py-1">Comment / evidence</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-slate-300 align-top">
                <td className="py-1 pr-2">{i.position}</td>
                <td className="py-1 pr-2">{i.question}</td>
                <td className="py-1 pr-2 text-xs">{i.reference}</td>
                <td className="py-1 pr-2 font-semibold">{LABEL[i.result ?? ""] ?? "--"}{i.findingLevel ? ` (L${i.findingLevel})` : ""}</td>
                <td className="py-1 text-xs">{[i.comment, i.evidence ? `Evidence: ${i.evidence}` : null].filter(Boolean).join(" ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {findings.length > 0 && (
        <section>
          <h2 className="mb-1 text-base font-bold">Findings and actions</h2>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-slate-800 text-xs uppercase">
                <th className="py-1 pr-2">Ref</th><th className="py-1 pr-2">Level</th><th className="py-1 pr-2">Finding</th><th className="py-1 pr-2">Corrective action (CFI)</th><th className="py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.id} className="border-b border-slate-300 align-top">
                  <td className="py-1 pr-2 font-semibold">{actionRef(f.area, f.number)}</td>
                  <td className="py-1 pr-2">{f.level ?? ""}</td>
                  <td className="py-1 pr-2">{f.title}{f.description ? ` - ${f.description}` : ""}</td>
                  <td className="py-1 pr-2 text-xs">{f.cfiResponse ?? "Open"}</td>
                  <td className="py-1 text-xs">{f.status === "closed" ? `Signed off ${fmtDate(f.signedOffAt)} by ${f.signedOffByName}` : f.status === "submitted" ? "Waiting for sign-off" : "With the CFI"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {au.conclusion && (
        <section>
          <h2 className="text-base font-bold">Conclusion</h2>
          <p className="whitespace-pre-wrap">{au.conclusion}</p>
        </section>
      )}
      <footer className="pt-8">
        <p>Signed (Quality person): <strong>{au.auditorName}</strong> &nbsp; Date: <strong>{fmtDate(au.completedAt)}</strong></p>
        <p className="mt-6 text-xs text-slate-500">Generated from the Apex Flight Hub. Findings are Level 1 or Level 2; each is completed by the CFI and signed off by the Quality person, and recorded in the SIRSL (MOP 13.4, 14.4).</p>
      </footer>
    </div>
  );
}
