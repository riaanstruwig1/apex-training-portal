"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  grantStudentEndorsement,
  revokeStudentEndorsement,
} from "@/lib/actions/student-endorsements";

/** Grant/revoke a single student endorsement -- no self-declare step, so
 * this is a plain toggle (unlike PilotEndorsementToggle's Verify/Decline
 * pair, which reacts to a pilot's own prior "Apply"). */
export default function StudentEndorsementToggle({
  studentUserId,
  endorsementKey,
  label,
  granted,
}: {
  studentUserId: string;
  endorsementKey: string;
  label: string;
  granted: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          if (granted) {
            await revokeStudentEndorsement(studentUserId, endorsementKey);
          } else {
            await grantStudentEndorsement(studentUserId, endorsementKey);
          }
          router.refresh();
        })
      }
      className={`rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${
        granted
          ? "bg-green-100 text-green-800 hover:bg-green-200"
          : "border border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
      {isPending ? " …" : granted ? " ✓" : ""}
    </button>
  );
}
