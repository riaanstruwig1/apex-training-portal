"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/actions/password-reset-request";

export default function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  if (state?.success) {
    return (
      <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
        Thanks -- if that email matches an account here, it&rsquo;s now flagged for your CFI or
        Admin&rsquo;s attention. They&rsquo;ll be in touch with a new password.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Sending..." : "Flag my account for a password reset"}
      </button>
    </form>
  );
}
