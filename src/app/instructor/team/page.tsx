import Link from "next/link";
import { requireCFI } from "@/lib/auth/dal";
import { listInstructors } from "@/lib/actions/instructors";
import InstructorRowActions from "./instructor-row-actions";

export default async function TeamPage() {
  await requireCFI();
  const staff = await listInstructors();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Instructors</h1>
          <p className="text-sm text-slate-500">
            Regular instructors can sign off exercises and countersign
            logbook entries. Only the Chief Flight Instructor can manage
            students, other instructors, the syllabus, or settings.
          </p>
        </div>
        <Link
          href="/instructor/team/new"
          className="shrink-0 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Add instructor
        </Link>
      </div>

      {/* Mobile: one card per staff member, avoids horizontal-scrolling a 5-column table */}
      <div className="space-y-3 sm:hidden">
        {staff.map((s) => (
          <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-slate-900">{s.name}</div>
                <div className="text-xs text-slate-500">{s.email}</div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  s.active ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {s.active ? "active" : "invited"}
              </span>
            </div>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                s.role === "cfi" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {s.role === "cfi" ? "Chief Flight Instructor" : "Instructor"}
            </span>
            {s.role === "instructor" && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <InstructorRowActions instructorId={s.id} active={s.active} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                <td className="px-4 py-3 text-slate-600">{s.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.role === "cfi"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {s.role === "cfi" ? "Chief Flight Instructor" : "Instructor"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.active
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {s.active ? "active" : "invited"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {s.role === "instructor" && (
                    <InstructorRowActions instructorId={s.id} active={s.active} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
