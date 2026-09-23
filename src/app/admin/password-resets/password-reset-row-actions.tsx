"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminResetPassword } from "@/lib/actions/profile";
import { dismissPasswordResetRequest } from "@/lib/actions/password-reset-request";

export default function PasswordResetRowActions({ userId }: { userId: string }) {
  const router = useRouter();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleReset() {
    if (
      !confirm(
        "Reset this account's password? They'll need the new temporary password to sign in -- give it to them directly (there's no email to send it to)."
      )
    ) {
      return;
    }
    setIsPending(true);
    setError(null);
    const result = await adminResetPassword(userId);
    if (result.tempPassword) {
      setTempPassword(result.tempPassword);
      // The reset itself doesn't clear the flag (someone might request
      // again if it doesn't work out) -- clear it here as the natural
      // "I've handled this" follow-through once a new password exists.
      await dismissPasswordResetRequest(userId);
      router.refresh();
    } else {
      setError(result.error ?? "Could not reset password.");
    }
    setIsPending(false);
  }

  async function handleDismiss() {
    if (!confirm("Dismiss this request without resetting the password?")) return;
    setIsPending(true);
    await dismissPasswordResetRequest(userId);
    setIsPending(false);
    router.refresh();
  }

  if (tempPassword) {
    return (
      <p className="text-xs text-slate-600">
        New temporary password (shown once -- copy it now):{" "}
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-900">
          {tempPassword}
        </span>
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleReset}
        disabled={isPending}
        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {isPending ? "Working..." : "Reset password"}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        disabled={isPending}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        Dismiss
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
