import Link from "next/link";
import { requireInstructor } from "@/lib/auth/dal";
import { canSendSafetyNotices, getSafetyNotices, snRef, fmtSaDate } from "@/lib/safety-notices";
import SafetyNoticeForm from "./safety-form";

/** Batch 108 (Riaan, 27 Nov 2026): safety notices -- the CFI and the Safety
 * Officer send them (every student and pilot gets a WhatsApp); all staff see the list. */
export default async function StaffSafetyPage() {
  const staff = await requireInstructor();
  const [notices, canSend] = await Promise.all([getSafetyNotices(), canSendSafetyNotices(staff)]);
  const next = snRef((notices[0]?.number ?? 0) + 1);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">⚠️ Safety notices</h1>
        <p className="mt-1 text-sm text-slate-500">
          Numbered notices (SN-001, SN-002...). Every student and pilot gets a WhatsApp, and the latest one shows under
          &ldquo;Log a flight&rdquo; on their dashboard.{" "}
          <Link href="/safety" className="text-red-600 hover:underline">See them as a student sees them</Link>
        </p>
      </div>
      {canSend ? (
        <section className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-amber-900">New safety notice - {next}</h2>
          <SafetyNoticeForm nextRef={next} recipientsNote="Every student, pilot and instructor with a cell number gets a WhatsApp." />
        </section>
      ) : (
        <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">Only the CFI and the Safety Officer (set in Settings) can send safety notices.</p>
      )}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Sent notices</h2>
        {notices.length === 0 ? (
          <p className="text-sm text-slate-400">None yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">No.</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Title / subject</th>
                  <th className="px-3 py-2">By</th>
                  <th className="px-3 py-2">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n.id} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-amber-800">
                      <Link href={`/safety/${n.number}`} className="hover:underline">{snRef(n.number)}</Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtSaDate(n.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{n.title}{n.file ? " 📎" : ""}</div>
                      <div className="text-xs text-slate-500">{n.subject}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{n.createdByName ?? "--"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      <span className="text-green-700">{n.sentOk} sent</span>
                      {n.sentFailed > 0 && <span className="ml-1 text-red-600">{n.sentFailed} failed</span>}
                      <span className="ml-1 text-slate-400">of {n.recipients}{n.sendDone ? "" : " (sending...)"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
