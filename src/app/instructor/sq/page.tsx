import Link from "next/link";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { audits, occurrenceReports, qsActions, users } from "@/db/schema";
import { requireInstructor } from "@/lib/auth/dal";
import { getSqRoles } from "@/lib/sq";
import SqSubnav from "@/components/sq-subnav";

/** Batch 111 (Riaan, 27 Nov 2026): Safety (SO) and Quality (QA) -- two separate
 * functions from the MOP, one action flow (raise -> CFI -> sign-off -> SIRSL). */
export default async function SqOverviewPage() {
  const staff = await requireInstructor();
  const roles = await getSqRoles(staff);
  const [[newOcc], [withCfi], [submittedSafety], [submittedQuality], [running]] = await Promise.all([
    db.select({ c: count() }).from(occurrenceReports).where(eq(occurrenceReports.status, "new")),
    db.select({ c: count() }).from(qsActions).where(eq(qsActions.status, "with_cfi")),
    db.select({ c: count() }).from(qsActions).where(and(eq(qsActions.status, "submitted"), eq(qsActions.area, "safety"))),
    db.select({ c: count() }).from(qsActions).where(and(eq(qsActions.status, "submitted"), eq(qsActions.area, "quality"))),
    db.select({ c: count() }).from(audits).where(eq(audits.status, "in_progress")),
  ]);
  const names = new Map(
    (await db.select({ id: users.id, name: users.name }).from(users)).map((u) => [u.id, u.name])
  );
  const myRoles = [roles.cfi && "CFI", roles.so && "Safety Officer", roles.qa && "Quality person"].filter(Boolean).join(" · ") || "Instructor (view only)";
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Safety &amp; Quality</h1>
      <p className="mt-1 mb-4 text-sm text-slate-500">
        From the DTO Procedures Manual (MOP 13 and 14). Safety Officer: <strong>{roles.soId ? names.get(roles.soId) ?? "?" : "not set"}</strong> · Quality person:{" "}
        <strong>{roles.qaId ? names.get(roles.qaId) ?? "?" : "not set"}</strong> (the CFI sets both in Settings). You are: {myRoles}.
      </p>
      <SqSubnav active="overview" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="New occurrence reports" n={newOcc?.c ?? 0} href="/instructor/sq/safety" hint="for the Safety Officer" />
        <Tile label="With the CFI" n={withCfi?.c ?? 0} href="/instructor/sq/actions" hint="waiting for the CFI" />
        <Tile label="Safety actions to sign off" n={submittedSafety?.c ?? 0} href="/instructor/sq/actions" hint="Safety Officer" />
        <Tile label="Findings to sign off" n={submittedQuality?.c ?? 0} href="/instructor/sq/actions" hint="Quality person" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Safety (Safety Officer)</h2>
          <p className="mt-1 text-sm text-slate-600">Occurrence and hazard reports, safety actions, SAHPA reporting. Anyone can report; the Safety Officer reviews, closes or sends an action to the CFI.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Link href="/instructor/sq/safety" className="rounded-md bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700">Open Safety</Link>
            <Link href="/report-occurrence" className="rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50">Report an occurrence</Link>
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Quality (Quality person)</h2>
          <p className="mt-1 text-sm text-slate-600">Audit checklists from the MOP review table. The Quality person does the audit and ticks it off; Level 1 and Level 2 findings go to the CFI. {running?.c ? `${running.c} audit(s) in progress.` : ""}</p>
          <div className="mt-3 text-sm">
            <Link href="/instructor/sq/quality" className="rounded-md bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700">Open Quality</Link>
          </div>
        </section>
      </div>
      <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-900">How an action travels</h2>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          <li>The Safety Officer (safety action) or the Quality person (audit finding) raises it and sends it to the CFI.</li>
          <li>The CFI does the corrective action and submits it.</li>
          <li>It goes back to the Safety Officer or the Quality person, who signs it off, or returns it to the CFI.</li>
          <li>Every step is written to the Single Integrated Reporting System Log (SIRSL).</li>
        </ol>
      </section>
    </div>
  );
}

function Tile({ label, n, href, hint }: { label: string; n: number; href: string; hint: string }) {
  const busy = n > 0;
  return (
    <Link href={href} className={`rounded-xl border-2 p-4 ${busy ? "border-amber-300 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-900"}`}>
      <span className="text-sm font-semibold">{label}</span>
      <span className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-bold leading-none">{n}</span>
        <span className="text-xs opacity-80">{busy ? hint : "All clear ✓"}</span>
      </span>
    </Link>
  );
}
