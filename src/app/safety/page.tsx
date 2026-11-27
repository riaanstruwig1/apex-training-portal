import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { getSafetyNotices, snRef, fmtSaDate, homeFor } from "@/lib/safety-notices";

export const metadata: Metadata = { title: "Apex Flight Hub - Safety notices", description: "Apex Adventures safety notices - log in to the Apex Flight Hub to read them." };

/** Batch 108: every safety notice, newest first (any logged-in account). */
export default async function SafetyNoticesPage() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/safety")}`);
  const notices = await getSafetyNotices();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href={homeFor(user.role)} className="text-sm text-slate-500 hover:text-red-600">
        &larr; Back to the Hub
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">⚠️ Safety notices</h1>
      <p className="mb-5 text-sm text-slate-500">Apex Adventures safety notices, newest first.</p>
      {notices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No safety notices yet.</p>
      ) : (
        <div className="space-y-2">
          {notices.map((n) => (
            <Link key={n.id} href={`/safety/${n.number}`} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-amber-400">
              <p className="text-xs font-semibold text-amber-800">
                {snRef(n.number)} · {fmtSaDate(n.createdAt)}
                {n.file ? " · 📎 document" : ""}
              </p>
              <p className="font-semibold text-slate-900">{n.title}</p>
              <p className="text-sm text-slate-600">{n.subject}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
