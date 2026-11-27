import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditResults, audits } from "@/db/schema";
import { requireInstructor } from "@/lib/auth/dal";
import { auditRef, fmtDate, getSqRoles } from "@/lib/sq";
import SqSubnav from "@/components/sq-subnav";
import { AuditItemForm, CompleteAuditForm } from "@/components/sq-forms";

const LABEL: Record<string, string> = { compliant: "Compliant", non_compliant: "Non-compliant", observation: "Observation", na: "N/A" };

export default async function AuditPage(props: PageProps<"/instructor/sq/quality/[id]">) {
  const staff = await requireInstructor();
  const { id } = await props.params;
  const [au] = await db.select().from(audits).where(eq(audits.id, id)).limit(1);
  if (!au) notFound();
  const [roles, items] = await Promise.all([
    getSqRoles(staff),
    db.select().from(auditResults).where(eq(auditResults.auditId, id)).orderBy(asc(auditResults.position)),
  ]);
  const done = items.filter((i) => i.result).length;
  const canDo = roles.qa && au.status === "in_progress";
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/instructor/sq/quality" className="text-sm text-slate-500 hover:text-red-600">&larr; All audits</Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{auditRef(au.number)} - {au.checklistTitle}</h1>
          <p className="text-sm text-slate-500">
            {fmtDate(au.auditDate)} · Auditor: {au.auditorName}{au.scope ? ` · Scope: ${au.scope}` : ""} ·{" "}
            {au.status === "completed" ? `Completed ${fmtDate(au.completedAt)}` : `In progress: ${done}/${items.length} answered`}
          </p>
        </div>
        {au.status === "completed" && (
          <Link href={`/instructor/sq/quality/${au.id}/report`} className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">Audit report (print / PDF)</Link>
        )}
      </div>
      <SqSubnav active="quality" />
      {au.status === "in_progress" && !roles.qa && (
        <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">This audit is in progress. Only the Quality person fills it in. You can read it once it is completed.</p>
      )}
      <div className="space-y-3">
        {items.map((i) => (
          canDo || au.status === "in_progress" ? (
            roles.qa ? (
              <AuditItemForm key={i.id} id={i.id} position={i.position} question={i.question} reference={i.reference} result={i.result} comment={i.comment} evidence={i.evidence} level={i.findingLevel} locked={false} />
            ) : null
          ) : (
            <div key={i.id} className={`rounded-xl border p-3 ${i.result === "non_compliant" ? "border-red-300 bg-red-50" : i.result === "observation" ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
              <p className="text-sm font-semibold text-slate-900">{i.position}. {i.question}</p>
              <p className="text-xs text-slate-500">{i.reference ? `Reference: ${i.reference} · ` : ""}<strong>{LABEL[i.result ?? ""] ?? "--"}</strong>{i.findingLevel ? ` · Level ${i.findingLevel} finding` : ""}</p>
              {i.comment && <p className="mt-1 text-sm text-slate-700">{i.comment}</p>}
              {i.evidence && <p className="text-xs text-slate-500">Evidence: {i.evidence}</p>}
            </div>
          )
        ))}
      </div>
      {canDo && <CompleteAuditForm auditId={au.id} conclusion={au.conclusion ?? ""} />}
      {au.status === "completed" && au.conclusion && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold text-slate-900">Conclusion</h2>
          <p className="mt-1 whitespace-pre-wrap text-slate-700">{au.conclusion}</p>
        </section>
      )}
    </div>
  );
}
