"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setStudentSignUpDate } from "@/lib/actions/students";

/** Lets a CFI/Admin set or correct a student's actual sign-up date, shown
 * next to the account's own "submitted <date>" line above -- which is just
 * when the app account was created, not necessarily when the student
 * really joined (some go back about a year). 29 Sep 2026 fix, Riaan: "add
 * vir CFI or Admin a button, date, for initial student sign up ... On to
 * under studnet application, show initial sign up." Reachable here (unlike
 * the CFI-only editor on the student folio) because this page sits under
 * requireAdminOrCFI. */
export default function SignUpDateEditor({
  studentUserId,
  currentDate,
}: {
  studentUserId: string;
  currentDate: Date | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentDate ? currentDate.toISOString().slice(0, 10) : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!editing) {
    return (
      <span className="mt-1 flex items-center gap-2 text-sm text-slate-500">
        {currentDate ? (
          <>
            Signed up{" "}
            <span className="font-medium text-slate-900">{currentDate.toLocaleDateString()}</span>
          </>
        ) : (
          <span className="text-amber-700">Sign-up date not set</span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-slate-500 underline decoration-dotted hover:text-slate-700"
        >
          {currentDate ? "Edit date" : "Set date"}
        </button>
      </span>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        max={new Date().toISOString().slice(0, 10)}
        className="rounded-md border border-slate-300 px-1.5 py-0.5 text-xs"
      />
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await setStudentSignUpDate(studentUserId, value);
            if (result?.error) {
              setError(result.error);
            } else {
              setError(null);
              setEditing(false);
              router.refresh();
            }
          })
        }
        className="rounded-md bg-slate-700 px-2 py-0.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {isPending ? "..." : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setError(null);
          setValue(currentDate ? currentDate.toISOString().slice(0, 10) : "");
        }}
        className="text-xs text-slate-400 hover:text-slate-600"
      >
        Cancel
      </button>
      {error && <span className="w-full text-xs text-red-600">{error}</span>}
    </div>
  );
}
