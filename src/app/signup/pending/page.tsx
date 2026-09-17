import Link from "next/link";

export default function SignupPendingPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          !
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Application submitted</h1>
        <p className="mt-2 text-sm text-slate-600">
          Thanks -- your application is now pending verification by an instructor or admin.
          You&apos;ll be able to log in once it&apos;s approved.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to login
        </Link>
      </div>
    </main>
  );
}
