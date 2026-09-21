import Link from "next/link";
import { getPendingApplicants } from "@/lib/verification";

const roleLabel: Record<string, string> = {
  student: "Student",
  pilot: "Pilot",
};

export default async function AdminVerificationQueue() {
  const applicants = await getPendingApplicants();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Verification queue</h1>
        {applicants.length > 0 ? (
          <p className="mt-1 text-sm font-semibold text-red-600">
            Action needed: {applicants.length} sign-up{applicants.length > 1 ? "s" : ""} waiting
            for review below.
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            New sign-ups wait here until an instructor or admin reviews and approves them.
          </p>
        )}
      </div>

      {applicants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nothing pending -- new sign-ups will show up here.
        </div>
      ) : (
        <>
          {/* Mobile: one card per applicant, avoids horizontal-scrolling a 6-column table */}
          <div className="space-y-3 sm:hidden">
            {applicants.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900">{a.name}</div>
                    <div className="text-xs text-slate-500">{a.email}</div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {roleLabel[a.role]}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <div>
                    <dt className="text-xs text-slate-400">Apex No.</dt>
                    <dd className="text-slate-700">{a.apexNumber ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Submitted</dt>
                    <dd className="text-slate-700">{a.createdAt.toLocaleDateString()}</dd>
                  </div>
                </dl>
                <Link
                  href={`/admin/applicants/${a.id}`}
                  className="mt-3 inline-block rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Apex No.</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applicants.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{a.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {roleLabel[a.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.apexNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{a.email}</td>
                    <td className="px-4 py-3 text-slate-600">{a.createdAt.toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/applicants/${a.id}`}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        Review
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
