import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { occurrenceReports, qsActions } from "@/db/schema";
import { requireInstructor } from "@/lib/auth/dal";
import { ACTION_STATUS_LABEL, actionRef, fmtDate, fmtDateTime, getSqRoles, occRef } from "@/lib/sq";
import SqSubnav from "@/components/sq-subnav";
import { ReviewOccurrenceForm } from "@/components/sq-forms";

export default async function OccurrencePage(props: PageProps<"/instructor/sq/safety/[id]">) {
  const staff = await requireInstructor();
  const { id } = await props.params;
  const [r] = await db.select().from(occurrenceReports).where(eq(occurrenceReports.id, id)).limit(1);
  if (!r) notFound();
  const [roles, actions] = await Promise.all([
    getSqRoles(staff),
    db.select().from(qsActions).where(and(eq(qsActions.sourceType, "occurrence"), eq(qsActions.sourceId, id))).orderBy(asc(qsActions.number)),
  ]);
  const rows: [string, string | null][] = [
    ["Type", r.type.replace("_", " ")],
    ["Date and time", fmtDateTime(r.occurredAt)],
    ["Injuries", r.injuries],
    ["Site", r.site],
    ["Wing / motor / equipment", r.equipment],
    ["People involved", r.people],
    ["Weather and wind", r.weather],
    ["Damage", r.damage],
    ["Immediate action taken", r.immediateAction],
    ["Reported by", r.confidential ? "Confidential" : r.reporterName],
  ];
  const serious = r.injuries === "serious" || r.injuries === "fatal";
  return (
    <div className="space-y-5">
      <div>
        <Link href="/instructor/sq/safety" className="text-sm text-slate-500 hover:text-red-600">&larr; All occurrence reports</Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{occRef(r.number)} - {r.type.replace("_", " ")}</h1>
      </div>
      <SqSubnav active="safety" />
      {serious && r.status !== "closed" && (
        <p className="rounded-lg border-2 border-red-400 bg-red-50 p-3 text-sm font-semibold text-red-800">
          Serious or fatal: report to the SAHPA National Safety Officer and the SAHPA office (and AIID where required) within the SAHPA timelines (4 hours to 7 days, MOP 13.2), and record when below.
        </p>
      )}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="font-medium capitalize text-slate-900">{v || "--"}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-500">What happened</p>
        <p className="whitespace-pre-wrap text-sm text-slate-900">{r.description}</p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Safety Officer review {r.status === "closed" && <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">Closed {fmtDate(r.closedAt)} by {r.closedByName}</span>}</h2>
        <ReviewOccurrenceForm id={r.id} soNotes={r.soNotes ?? ""} external={r.externalReportedAt ?? ""} canSo={roles.so} closed={r.status === "closed"} />
      </section>
      {actions.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Actions from this report</h2>
          <ul className="space-y-1 text-sm">
            {actions.map((a) => (
              <li key={a.id}>
                <span className="font-semibold text-amber-800">{actionRef(a.area, a.number)}</span> {a.title} - {ACTION_STATUS_LABEL[a.status]}
              </li>
            ))}
          </ul>
          <Link href="/instructor/sq/actions" className="mt-2 inline-block text-sm text-red-600 underline">Open Actions &amp; findings</Link>
        </section>
      )}
    </div>
  );
}
