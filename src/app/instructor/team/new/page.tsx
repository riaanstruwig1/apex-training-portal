import { requireCFI } from "@/lib/auth/dal";
import { listPromotablePilots } from "@/lib/actions/instructors";
import NewInstructorForm from "./new-instructor-form";
import PromotePilotForm from "./promote-pilot-form";

export default async function NewInstructorPage() {
  await requireCFI();
  const promotablePilots = await listPromotablePilots();

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Add an instructor</h1>
        <p className="mb-6 text-sm text-slate-500">
          Promote a pilot already in the system, or invite someone brand new.
        </p>
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Promote an existing pilot</h2>
        <p className="mb-3 text-sm text-slate-500">
          For someone who already has a pilot account here -- flips their role, no new invite
          needed since they already have a login. Takes you to their profile afterwards to set
          their instructor ratings.
        </p>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <PromotePilotForm pilots={promotablePilots} />
        </div>
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Invite someone new</h2>
        <p className="mb-3 text-sm text-slate-500">
          Creates an account and gives you an invite link to send them. They&apos;ll
          be able to sign off exercises and countersign logbook entries, but
          won&apos;t be able to add or remove students, manage other
          instructors, the syllabus, or settings -- those stay with you.
        </p>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <NewInstructorForm />
        </div>
      </div>
    </div>
  );
}
