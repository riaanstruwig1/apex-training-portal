import Link from "next/link";
import { requireAdminOrCFI } from "@/lib/auth/dal";
import { getAdminStudentList, type AdminStudentRow } from "@/lib/admin-students";
import { parseTrainingTypes } from "@/lib/exams";
import Avatar from "@/components/avatar";

function fmt(d: Date) {
  return d.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

function trainingLabel(raw: string | null) {
  const types = parseTrainingTypes(raw);
  return types.length ? types.map((t) => t.toUpperCase()).join(" + ") : "—";
}

function SahpaExpiry({ date }: { date: Date | null }) {
  if (!date) return <span className="text-slate-300">—</span>;
  if (date < new Date()) return <span className="font-medium text-red-600">Expired {fmt(date)}</span>;
  return <span className="text-slate-600">{fmt(date)}</span>;
}

function StatusBadge({ s }: { s: AdminStudentRow }) {
  if (s.status !== "active") {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
        {s.status}
      </span>
    );
  }
  if (!s.consentComplete) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Consent not signed
      </span>
    );
  }
  return <span className="text-xs text-green-700">Active</span>;
}

function Actions({ id }: { id: string }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/admin/applicants/${id}`}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        View / edit
      </Link>
      <Link
        href={`/admin/applicants/${id}/print`}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Print
      </Link>
    </div>
  );
}

/** Admin/CFI student list (30 Sep 2026, Riaan: Admin must be able to check,
 * view and edit student profiles -- and print them). Each row opens the
 * same profile page the verification queue and Pilots list use
 * (/admin/applicants/[id]), which has the edit form, or its print view. */
export default async function AdminStudentsPage() {
  await requireAdminOrCFI();
  const students = await getAdminStudentList();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Students</h1>
        <p className="mt-1 text-sm text-slate-500">
          All approved students. Open one to check or edit their profile details, or print their
          profile. New sign-ups appear here once approved in the verification queue.
        </p>
      </div>

      {students.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No approved students yet.
        </div>
      ) : (
        <>
          {/* Mobile: one card per student */}
          <div className="space-y-3 sm:hidden">
            {students.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar userId={s.id} filename={s.profilePictureFile} name={s.name} size={32} />
                    <div>
                      <div className="font-medium text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-500">{trainingLabel(s.trainingType)}</div>
                    </div>
                  </div>
                  <StatusBadge s={s} />
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                  <div>
                    <dt className="text-xs text-slate-400">Apex No.</dt>
                    <dd className="text-slate-700">{s.apexNumber ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Cell</dt>
                    <dd className="text-slate-700">{s.phone ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Signed up</dt>
                    <dd className="text-slate-700">
                      {fmt(s.signUpDate)}
                      {!s.signUpDateConfirmed && <span className="text-slate-400"> *</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">SAHPA expiry</dt>
                    <dd>
                      <SahpaExpiry date={s.sahpaExpiryDate} />
                    </dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <Actions id={s.id} />
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Training</th>
                  <th className="px-4 py-3">Apex No.</th>
                  <th className="px-4 py-3">Cell</th>
                  <th className="px-4 py-3">Signed up</th>
                  <th className="px-4 py-3">SAHPA expiry</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar userId={s.id} filename={s.profilePictureFile} name={s.name} size={28} />
                        <div>
                          <div className="font-medium text-slate-900">{s.name}</div>
                          <div className="text-xs text-slate-500">{s.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{trainingLabel(s.trainingType)}</td>
                    <td className="px-4 py-3 text-slate-600">{s.apexNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{s.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {fmt(s.signUpDate)}
                      {!s.signUpDateConfirmed && <span className="text-slate-400"> *</span>}
                    </td>
                    <td className="px-4 py-3">
                      <SahpaExpiry date={s.sahpaExpiryDate} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge s={s} />
                    </td>
                    <td className="px-4 py-3">
                      <Actions id={s.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            * account creation date -- the real sign-up date hasn&apos;t been set yet (set it on the
            student&apos;s profile).
          </p>
        </>
      )}
    </div>
  );
}
