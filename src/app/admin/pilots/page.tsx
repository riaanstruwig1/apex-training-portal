import Link from "next/link";
import { getAllPilotsWithSummary } from "@/lib/pilots";

const roleLabel: Record<string, string> = {
  pilot: "Pilot",
  cfi: "CFI",
  instructor: "Instructor",
};

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
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Call sign</th>
                <th className="px-4 py-3">Apex No.</th>
                <th className="px-4 py-3">Verified</th>
                <th className="px-4 py-3">Pending</th>
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
      )}
    </div>
  );
}
