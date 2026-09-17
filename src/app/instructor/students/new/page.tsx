import { requireCFI } from "@/lib/auth/dal";
import NewStudentForm from "./new-student-form";

export default async function NewStudentPage() {
  await requireCFI();

  return (
    <div className="max-w-lg">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Add a student</h1>
      <p className="mb-6 text-sm text-slate-500">
        Creates an account and gives you an invite link to send them. Once
        Shopify sync is wired up, students tagged &ldquo;Student&rdquo; there
        will appear automatically instead.
      </p>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <NewStudentForm />
      </div>
    </div>
  );
}
