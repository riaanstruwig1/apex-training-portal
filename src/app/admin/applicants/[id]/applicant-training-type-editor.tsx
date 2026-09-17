"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateApplicantTrainingType } from "@/lib/actions/verification";

const TRAINING_TYPE_LABELS: Record<"pg" | "ppg" | "ppt", string> = {
  pg: "Paraglider (PG)",
  ppg: "Powered Paragliding (PPG)",
  ppt: "Powered Paratrike (PPT)",
};

export default function ApplicantTrainingTypeEditor({
  studentUserId,
  trainingType,
}: {
  studentUserId: string;
  trainingType: "pg" | "ppg" | "ppt" | null;
}) {
  const [value, setValue] = useState<"pg" | "ppg" | "ppt" | "">(trainingType ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save(next: "pg" | "ppg" | "ppt") {
    setValue(next);
    startTransition(async () => {
      await updateApplicantTrainingType(studentUserId, next);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        disabled={isPending}
        onChange={(e) => save(e.target.value as "pg" | "ppg" | "ppt")}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-60"
      >
        <option value="" disabled>
          Not set -- select...
        </option>
        {(Object.entries(TRAINING_TYPE_LABELS) as ["pg" | "ppg" | "ppt", string][]).map(
          ([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          )
        )}
      </select>
      {isPending && <span className="text-xs text-slate-400">Saving...</span>}
    </div>
  );
}
