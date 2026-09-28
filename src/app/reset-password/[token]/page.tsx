import Link from "next/link";
import { isResetTokenValid } from "@/lib/actions/reset-password";
import ResetPasswordForm from "./reset-password-form";

/**
 * Landing page for the emailed reset link ("V23" item 5, 25 Sep 2026).
 * Checks the token up front so an expired/already-used/bogus link shows a
 * clear message immediately, rather than only failing once someone's typed
 * a new password and hit submit.
 */
export default async function ResetPasswordPage(
  props: PageProps<"/reset-password/[token]">
) {
  const { token } = await props.params;
  const valid = await isResetTokenValid(token);

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Reset your password
          </h1>
          {valid && (
            <p className="mt-1 text-sm text-slate-500">Choose a new password for your account.</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {valid ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="space-y-4">
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                This reset link is invalid or has expired. Reset links are only good for 1 hour.
              </p>
              <Link
                href="/forgot-password"
                className="block w-full rounded-md bg-red-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-red-700"
              >
                Request a new link
              </Link>
            </div>
          )}
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
