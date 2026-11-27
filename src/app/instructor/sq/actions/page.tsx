import { asc, desc, ne, eq } from "drizzle-orm";
import { db } from "@/db";
import { qsActions } from "@/db/schema";
import { requireInstructor } from "@/lib/auth/dal";
import { ACTION_STATUS_LABEL, actionRef, fmtDate, getSqRoles } from "@/lib/sq";
import SqSubnav from "@/components/sq-subnav";
import { ManualActionForm, SignOffForm, SubmitActionForm } from "@/components/sq-forms";

type Row = typeof qsActions.$inferSelect;

function Card({ a, now, children }: { a: Row; now: number; children?: React.ReactNode }) {
  const overdue = a.dueDate && a.status !== "closed" && a.dueDate.getTime() < now;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold text-slate-900">
          <span className={a.area === "quality" ? "text-blue-800" : "text-amber-800"}>{actionRef(a.area, a.number)}</span>
          {a.level ? <span className={`ml-2 rounded px-2 py-0.5 text-xs ${a.level === 1 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>Level {a.level}</span> : null}{" "}
          {a.title}
        </p>
        <span className="text-xs text-slate-500">{ACTION_STATUS_LABEL[a.status]}</span>
      </div>
      {a.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.description}</p>}
      <p className="mt-1 text-xs text-slate-500">
        {a.reference ? `Ref: ${a.reference} · ` : ""}Raised {fmtDate(a.raisedAt)} by {a.raisedByName ?? "--"}
        {a.dueDate ? ` · due ${fmtDate(a.dueDate)}` : ""}
        {overdue ? <span className="ml-1 font-bold text-red-700">OVERDUE</span> : null}
      </p>
      {a.cfiResponse && (
        <p className="mt-2 rounded-md bg-slate-50 p-2 text-sm text-slate-700">
          <span className="text-xs font-semibold text-slate-500">CFI ({a.cfiName}) {fmtDate(a.cfiSubmittedAt)}: </span>
          {a.cfiResponse}
        </p>
      )}
      {a.status === "closed" && (
        <p className="mt-1 text-xs text-green-700">Signed off by {a.signedOffByName} on {fmtDate(a.signedOffAt)}{a.signOffComment ? `: ${a.signOffComment}` : ""}</p>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export default async function ActionsPage() {
  const staff = await requireInstructor();
  const roles = await getSqRoles(staff);
  const now = new Date().getTime();
  const [open, closed] = await Promise.all([
    db.select().from(qsActions).where(ne(qsActions.status, "closed")).orderBy(asc(qsActions.raisedAt)),
    db.select().from(qsActions).where(eq(qsActions.status, "closed")).orderBy(desc(qsActions.signedOffAt)).limit(100),
  ]);
  const withCfi = open.filter((a) => a.status === "with_cfi");
  const submitted = open.filter((a) => a.status === "submitted");
  const drafts = open.filter((a) => a.status === "draft");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Actions &amp; findings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Raised by the Safety Officer (actions) or the Quality person (Level 1 / Level 2 findings) → completed by the CFI → signed off by the person who raised it → logged in the SIRSL. Everyone on staff can read them.
        </p>
      </div>
      <SqSubnav active="actions" />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">With the CFI ({withCfi.length})</h2>
        {withCfi.length === 0 ? <p className="text-sm text-slate-400">Nothing waiting for the CFI.</p> : (
          <div className="space-y-3">
            {withCfi.map((a) => (
              <Card key={a.id} a={a} now={now}>
                {a.returnComment && <p className="mb-2 rounded-md bg-red-50 p-2 text-xs text-red-800">Returned by {a.signedOffByName ?? "the signer"}: {a.returnComment}</p>}
                {roles.cfi ? <SubmitActionForm id={a.id} /> : <p className="text-xs text-slate-500">Waiting for the CFI to complete it.</p>}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Waiting for sign-off ({submitted.length})</h2>
        {submitted.length === 0 ? <p className="text-sm text-slate-400">Nothing waiting for sign-off.</p> : (
          <div className="space-y-3">
            {submitted.map((a) => (
              <Card key={a.id} a={a} now={now}>
                <SignOffForm id={a.id} canSign={a.area === "quality" ? roles.qa : roles.so} who={a.area === "quality" ? "the Quality person" : "the Safety Officer"} />
              </Card>
            ))}
          </div>
        )}
      </section>

      {drafts.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Draft ({drafts.length})</h2>
          <div className="space-y-3">{drafts.map((a) => <Card key={a.id} a={a} now={now} />)}</div>
        </section>
      )}

      {(roles.so || roles.qa) && (
        <section className="rounded-xl border-2 border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Raise one yourself</h2>
          <div className="grid gap-5 lg:grid-cols-2">
            {roles.so && (
              <div>
                <p className="mb-2 text-xs font-semibold text-amber-800">Safety action (Safety Officer)</p>
                <ManualActionForm area="safety" />
              </div>
            )}
            {roles.qa && (
              <div>
                <p className="mb-2 text-xs font-semibold text-blue-800">Quality finding (Quality person)</p>
                <ManualActionForm area="quality" />
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Closed ({closed.length})</h2>
        {closed.length === 0 ? <p className="text-sm text-slate-400">None yet.</p> : (
          <div className="space-y-3">{closed.map((a) => <Card key={a.id} a={a} now={now} />)}</div>
        )}
      </section>
    </div>
  );
}
