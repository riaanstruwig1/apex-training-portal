import Link from "next/link";
import { getLatestSafetyNotice, snRef, fmtSaDate } from "@/lib/safety-notices";

/** Batch 108 (Riaan, 27 Nov 2026): the latest safety notice, under "Log a
 * flight" on the student (and pilot) dashboard, with a button to all notices. */
export default async function SafetyNoticeBanner() {
  const n = await getLatestSafetyNotice();
  if (!n) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <Link href={`/safety/${n.number}`} className="min-w-0 hover:underline">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
          ⚠️ Latest safety notice · {snRef(n.number)} · {fmtSaDate(n.createdAt)}
        </p>
        <p className="mt-0.5 font-semibold text-slate-900">{n.title}</p>
        <p className="truncate text-sm text-slate-700">{n.subject}</p>
      </Link>
      <Link
        href="/safety"
        className="shrink-0 self-start rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-600 sm:self-center"
      >
        All safety notices
      </Link>
    </div>
  );
}
