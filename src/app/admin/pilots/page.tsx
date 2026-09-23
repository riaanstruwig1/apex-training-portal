import Link from "next/link";
import { getAllPilotsWithSummary } from "@/lib/pilots";

const roleLabel: Record<string, string> = {
  pilot: "Pilot",
  cfi: "CFI",
  instructor: "Instructor",
};

/** V22 rollout items 6/7: surface an at-a-glance licence status so Admin/CFI
 * can spot lapsed pilots without opening each profile. Mirrors the
 * red-when-expired treatment already used on the applicant detail page.
 * `null` means no expiry date has been captured yet (e.g. a pilot who
 * signed up before this field existed) -- shown as a plain dash, not a
 * warning, since there's nothing wrong to flag. */
function licenceStatus(date: Date | null): { label: string; className: string } {
  if (!date) return { label: "—", className: "text-slate-300" };
  const formatted = date.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
  if (date < new Date()) {
    return { label: `Expired ${formatted}`, className: "font-medium text-red-600" };
  }
  return { label: formatted, className: "text-slate-600" };
}

export default async function PilotsPage() {
  const pilots = await getAllPilotsWithSummary();
  const pendingTotal = pilots.reduce((sum, p) => sum + p.pendingCount, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Pilots</h1>
        {pendingTotal > 0 ? (
          <p className="mt-1 text-sm font-semibold text-red-600">
            Action needed: {pendingTotal} endorsement application{pendingTotal > 1 ? "s" : ""} across
            {" "}
            {pilots.filter((p) => p.pendingCount > 0).length} pilot(s) waiting for review.
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            Active pilots and club members -- open a pilot to review their ratings ladder and
            verify declared endorsements.
          </p>
        )}
      </div>

      {pilots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No active pilots yet -- they&apos;ll appear here once approved from the verification queue.
        </div>
      ) : (
        <>
          {/* Mobile: one card per pilot, avoids horizontal-scrolling a 7-column table */}
          <div className="space-y-3 sm:hidden">
            {pilots.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">{roleLabel[p.role] ?? p.role}</div>
                  </div>
                  {p.pendingCount > 0 ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      {p.pendingCount} to review
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>
                <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
                  <div>
                    <dt className="text-xs text-slate-400">Call sign</dt>
                    <dd className="text-slate-700">{p.callSign ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Apex No.</dt>
                    <dd className="text-slate-700">{p.apexNumber ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Verified</dt>
                    <dd className="text-slate-700">{p.verifiedCount}</dd>
                  </div>
                  <div className="col-span-3">
                    <dt className="text-xs text-slate-400">Licence</dt>
                    <dd className={licenceStatus(p.caaLicenceExpiryDate).className}>
                      {licenceStatus(p.caaLicenceExpiryDate).label}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/admin/applicants/${p.id}`}
                  className="mt-3 inline-block rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open
                </Link>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Call sign</th>
                  <th className="px-4 py-3">Apex No.</th>
                  <th className="px-4 py-3">Verified</th>
                  <th className="px-4 py-3">Pending</th>
                  <th className="px-4 py-3">Licence</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pilots.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-slate-600">{roleLabel[p.role] ?? p.role}</td>
                    <td className="px-4 py-3 text-slate-600">{p.callSign ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{p.apexNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{p.verifiedCount}</td>
                    <td className={`px-4 py-3 ${licenceStatus(p.caaLicenceExpiryDate).className}`}>
                      {licenceStatus(p.caaLicenceExpiryDate).label}
                    </td>
                    <td className="px-4 py-3">
                      {p.pendingCount > 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          {p.pendingCount} to review
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/applicants/${p.id}`}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
