"use client";

import { useState } from "react";
import { adminResetPassword } from "@/lib/actions/profile";

const WA_TEXT: Record<string, string> = {
  sent: "New password sent to him by WhatsApp.",
  failed: "The WhatsApp didn't go through -- give him the password yourself.",
  no_phone: "No cell number on file, so no WhatsApp -- give him the password yourself.",
  not_configured: "WhatsApp isn't connected, so no message was sent -- give him the password yourself.",
};

/** Batch 98 (Riaan, 24 Nov 2026): CFI/Admin resets a password and the new
 * one goes to the person by WhatsApp (also shown here once, as a fallback). */
export default function ResetPasswordButton({
  userId,
  name,
  compact = false,
  onDone,
}: {
  userId: string;
  name?: string;
  compact?: boolean;
  onDone?: () => void;
}) {
  const [result, setResult] = useState<{ tempPassword: string; whatsapp: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleReset() {
    if (!confirm(`Reset the password${name ? ` of ${name}` : ""}? A new password is set and sent to him by WhatsApp.`)) return;
    setPending(true);
    setError(null);
    const r = await adminResetPassword(userId);
    setPending(false);
    if (r.tempPassword) {
      setResult({ tempPassword: r.tempPassword, whatsapp: r.whatsapp ?? "failed" });
      onDone?.();
    } else setError(r.error ?? "Could not reset the password.");
  }

  if (result) {
    return (
      <p className={`text-xs ${result.whatsapp === "sent" ? "text-green-700" : "text-amber-800"}`}>
        {WA_TEXT[result.whatsapp] ?? WA_TEXT.failed} New password (shown once):{" "}
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-900">{result.tempPassword}</span>
      </p>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleReset}
        disabled={pending}
        className={
          compact
            ? "font-medium text-red-700 hover:underline disabled:opacity-50"
            : "rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        }
      >
        {pending ? "Resetting..." : "Reset password + WhatsApp"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
