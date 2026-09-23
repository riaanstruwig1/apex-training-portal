"use client";

import { useState, useTransition } from "react";
import { signOwnMedicalDeclaration } from "@/lib/actions/medical";
import {
  MEDICAL_DECLARATION_INTRO,
  MEDICAL_DECLARATION_BULLETS_1,
  MEDICAL_DECLARATION_FURTHER,
  MEDICAL_DECLARATION_BULLETS_2,
  medicalDeclarationExpiresAt as computeExpiresAt,
} from "@/lib/medical";
import MedicalDeclarationStatus from "@/components/medical-declaration-status";

/**
 * Online self-declare option for the SAHPA Appendix R62.22 "Pilot's
 * Declaration of Medical Fitness" -- shown only when the server has already
 * confirmed the pilot is under 60 (ProfileEditForm decides whether to
 * render this at all; the action re-checks server-side too). Same e-sign
 * pattern as ConsentGate (quote the real declaration text, type your full
 * name to sign, offer the saved vault signature back for display only), but
 * this lives INSIDE the larger profile <form> (ProfileEditForm), so it
 * can't render its own nested <form> -- a <form> can't contain another.
 * Fires the server action directly via useTransition instead, same pattern
 * already used for button-triggered actions elsewhere (e.g. the CFI
 * instructor-ratings grid).
 */
export default function MedicalDeclarationForm({
  name,
  signatureFile,
  signedAt,
  signedName,
  expiresAt,
}: {
  name: string;
  signatureFile?: string | null;
  signedAt: Date | null;
  signedName: string | null;
  expiresAt?: Date | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [declaredName, setDeclaredName] = useState(signatureFile ? name : "");
  const [error, setError] = useState<string | null>(null);
  const [justSigned, setJustSigned] = useState(false);
  const [open, setOpen] = useState(!signedAt);

  function handleSign() {
    setError(null);
    const fd = new FormData();
    fd.set("declaredName", declaredName);
    startTransition(async () => {
      const result = await signOwnMedicalDeclaration(undefined, fd);
      if (result?.error) {
        setError(result.error);
      } else {
        setJustSigned(true);
        setOpen(false);
      }
    });
  }

  if (signedAt && !open && !justSigned) {
    return (
      <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <MedicalDeclarationStatus signedAt={signedAt} signedName={signedName} expiresAt={expiresAt ?? null} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-medium text-red-600 underline hover:text-red-700"
        >
          Re-sign
        </button>
      </div>
    );
  }

  if (justSigned) {
    const now = new Date();
    return (
      <div className="mt-2 space-y-1 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
        <p>
          Declaration saved -- signed by {declaredName} on {now.toLocaleDateString()}.
        </p>
        <p>Valid until {computeExpiresAt(now).toLocaleDateString()}.</p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-700">
        Pilot&rsquo;s Declaration of Medical Fitness -- sign online
      </p>
      <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-200 bg-white p-2 text-[11px] leading-relaxed text-slate-600">
        <p>
          I, {name}, hereby declare that {MEDICAL_DECLARATION_INTRO.replace(/^I hereby declare that /, "")}
        </p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          {MEDICAL_DECLARATION_BULLETS_1.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="mt-1">{MEDICAL_DECLARATION_FURTHER}</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          {MEDICAL_DECLARATION_BULLETS_2.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>

      {signatureFile && (
        <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <img
            src="/api/signature"
            alt="Your saved signature"
            className="h-8 rounded border border-slate-200 bg-white object-contain p-1"
          />
          Using your saved signature on file.
        </p>
      )}

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="declaredName" className="block text-xs font-medium text-slate-700">
            Type your full name to sign
          </label>
          <input
            id="declaredName"
            name="declaredName"
            required
            value={declaredName}
            onChange={(e) => setDeclaredName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          disabled={isPending || !declaredName.trim()}
          onClick={handleSign}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "Signing..." : "Sign & save declaration"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
