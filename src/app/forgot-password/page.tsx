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
            This app doesn&rsquo;t send reset emails yet -- enter your account email below and
            we&rsquo;ll flag your account for your CFI or Admin, who can reset it and get the new
            password to you directly.
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
