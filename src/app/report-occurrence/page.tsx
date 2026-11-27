import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { homeFor } from "@/lib/safety-notices";
import { OccurrenceForm } from "@/components/sq-forms";

export const metadata: Metadata = { title: "Apex Flight Hub - Report an occurrence" };

/** Batch 111: anyone signed in can report an occurrence or hazard (Just Culture, MOP 13.1). */
export default async function ReportOccurrencePage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/report-occurrence")}`);
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href={homeFor(user.role)} className="text-sm text-slate-500 hover:text-red-600">&larr; Back to the Hub</Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">Report an occurrence or hazard</h1>
      <p className="mb-5 text-sm text-slate-500">
        Apex Adventures uses a Just Culture: reporting a hazard, near miss, incident or accident is welcome. The Safety Officer reads every report. You can keep your name confidential.
      </p>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <OccurrenceForm />
      </div>
    </main>
  );
}
