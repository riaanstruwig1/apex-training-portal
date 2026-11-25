"use client";

import { useRouter } from "next/navigation";

/** Batch 107 (Riaan, 25 Nov 2026): a Back button in the menu on every screen.
 * Goes to the previous page; with no history (opened from a link) it goes to
 * the person's home page instead. */
export default function BackButton({ home }: { home: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(home);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-0.5 text-sm text-slate-700 hover:border-red-400 hover:text-red-600"
      title="Back to the previous page"
    >
      &larr; Back
    </button>
  );
}
