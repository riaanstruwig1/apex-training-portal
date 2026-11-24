"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dismissPasswordResetRequest } from "@/lib/actions/password-reset-request";
import ResetPasswordButton from "@/components/reset-password-button";

/** Reset (new password by WhatsApp -- batch 98) or dismiss a request. */
export default function PasswordResetRowActions({ userId }: { userId: string }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleDismiss() {
    if (!confirm("Dismiss this request without resetting the password?")) return;
    setIsPending(true);
    await dismissPasswordResetRequest(userId);
    setIsPending(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ResetPasswordButton userId={userId} onDone={() => void dismissPasswordResetRequest(userId)} />
      <button
        type="button"
        onClick={handleDismiss}
        disabled={isPending}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        Dismiss
      </button>
    </div>
  );
}
