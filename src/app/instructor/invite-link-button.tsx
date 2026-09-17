"use client";

import { useState, useTransition } from "react";
import { resendInvite } from "@/lib/actions/students";

export default function InviteLinkButton({ studentId }: { studentId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (url) {
    return (
      <div className="flex items-center gap-1">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="w-40 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-xs"
        />
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(url)}
          className="text-xs text-red-600 hover:underline"
        >
          Copy
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await resendInvite(studentId);
          setUrl(res.inviteUrl);
        })
      }
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {isPending ? "..." : "Get invite link"}
    </button>
  );
}
