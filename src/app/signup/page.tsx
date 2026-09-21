import Link from "next/link";
import SignupForm from "./signup-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Join Apex Flight Hub
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign up as a new student, or as a licensed pilot / club member.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <SignupForm />
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-red-600 hover:text-red-700">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
