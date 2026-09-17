"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveStudent, restoreStudent, deleteStudent } from "@/lib/actions/students";

/** Archive / restore / delete actions for one student row on the roster.
 * Archive and restore are one click (fully reversible). Delete asks for an
 * inline confirmation first, since it permanently removes the student's
 * profile, sign-offs and flight log along with their account. */
export default function StudentRowActions({
  studentId,
  archived,
}: {
  studentId: string;
  archived: boolean;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (confirmingDelete) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">Delete permanently?</span>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await deleteStudent(studentId);
              router.refresh();
            })
          }
          className="font-medium text-red-600 hover:underline disabled:opacity-50"
        >
          {isPending ? "..." : "Yes, delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(false)}
          className="text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (archived) {
    return (
      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await restoreStudent(studentId);
              router.refresh();
            })
          }
          className="text-slate-600 hover:underline disabled:opacity-50"
        >
          {isPending ? "..." : "Restore"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await archiveStudent(studentId);
            router.refresh();
          })
        }
        className="text-slate-600 hover:underline disabled:opacity-50"
      >
        {isPending ? "..." : "Archive"}
      </button>
      <button
        type="button"
        onClick={() => setConfirmingDelete(true)}
        className="text-red-600 hover:underline"
      >
        Delete
      </button>
    </div>
  );
}
