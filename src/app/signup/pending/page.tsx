import Link from "next/link";
import { TEAM_APEX_GROUP_URL } from "@/lib/team-apex-group";

export default function SignupPendingPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            !
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Application submitted</h1>
          <p className="mt-2 text-sm text-slate-600">
            Thanks -- your application is now pending verification by an instructor or admin.
            You&apos;ll be able to log in once it&apos;s approved.
          </p>
        </div>

        {/* Batch 82 (Riaan, 22 Oct 2026): invite every new student/pilot to
            the Team Apex WhatsApp group -- an announcements group, not a chat. */}
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Join the Team Apex WhatsApp group</h2>
          <p className="mt-2 text-sm text-slate-700">
            Please join our <strong>Team Apex</strong> group. It&apos;s <strong>not a chat group</strong>:
            we post the <strong>training schedule every week</strong>, plus training notifications,
            weather updates and other important news.
          </p>
          <a
            href={TEAM_APEX_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
          >
            Join Team Apex on WhatsApp
          </a>
          <p className="mt-2 text-xs text-slate-500">Opens WhatsApp. Tap &ldquo;Join group&rdquo; there.</p>
        </div>

        <div className="text-center">
          <Link
            href="/login"
            className="inline-block rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}
