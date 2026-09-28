import Link from "next/link";
import ForgotPasswordForm from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Forgot your password?
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter your account email and we&rsquo;ll send you a link to reset your password.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ForgotPasswordForm />
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-red-600 hover:text-red-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
