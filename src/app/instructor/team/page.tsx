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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
