import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { getSafetyNotice, snRef, fmtSaDate, homeFor } from "@/lib/safety-notices";

export const metadata: Metadata = { title: "Apex Flight Hub - Safety notice", description: "Apex Adventures safety notice - log in to the Apex Flight Hub to read it." };

/** Batch 108: one safety notice (the WhatsApp links here). Login required. */
export default async function SafetyNoticePage(props: PageProps<"/safety/[no]">) {
  const { no } = await props.params;
  const number = Number(no);
  if (!Number.isInteger(number) || number < 1) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/safety/${number}`)}`);
  const n = await getSafetyNotice(number);
  if (!n) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex gap-4 text-sm">
        <Link href={homeFor(user.role)} className="text-slate-500 hover:text-red-600">&larr; Back to the Hub</Link>
        <Link href="/safety" className="text-slate-500 hover:text-red-600">All safety notices</Link>
      </div>
      <article className="mt-3 rounded-xl border-2 border-amber-400 bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
          ⚠️ Safety notice {snRef(n.number)} · {fmtSaDate(n.createdAt)}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{n.title}</h1>
        <p className="mt-1 text-sm font-medium text-slate-700">Subject: {n.subject}</p>
        <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{n.description}</div>
        {n.file && (
          <a
            href={`/api/safety-notice/${n.number}`}
            className="mt-5 inline-block rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-600"
          >
            📎 Download {n.fileOriginalName ?? "document"}
          </a>
        )}
        <p className="mt-5 text-xs text-slate-400">Issued by {n.createdByName ?? "Apex"} · Apex Adventures / Paramotor SA (Pty) Ltd</p>
      </article>
    </main>
  );
}
