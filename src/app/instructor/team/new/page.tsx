import { requireCFI } from "@/lib/auth/dal";
import NewInstructorForm from "./new-instructor-form";

export default async function NewInstructorPage() {
  await requireCFI();

  return (
    <div className="max-w-lg">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Add an instructor</h1>
      <p className="mb-6 text-sm text-slate-500">
        Creates an account and gives you an invite link to send them. They&apos;ll
        be able to sign off exercises and countersign logbook entries, but
        won&apos;t be able to add or remove students, manage other
        instructors, the syllabus, or settings -- those stay with you.
      </p>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <NewInstructorForm />
      </div>
    </div>
  );
}
