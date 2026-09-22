"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateApplicantTrainingType } from "@/lib/actions/verification";
import { parseTrainingTypes, type TrainingType } from "@/lib/training-types";

const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  pg: "Paraglider (PG)",
  ppg: "Powered Paragliding (PPG)",
  ppt: "Powered Paratrike (PPT)",
};
const TRAINING_TYPE_ORDER: TrainingType[] = ["pg", "ppg", "ppt"];

/** A student can be enrolled in more than one course at once (e.g. PG and
 * PPG), so this is a checkbox group rather than a single dropdown. */
export default function ApplicantTrainingTypeEditor({
  studentUserId,
  trainingType,
}: {
  studentUserId: string;
  trainingType: string | null;
}) {
  const [selected, setSelected] = useState<Set<TrainingType>>(
    new Set(parseTrainingTypes(trainingType))
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(t: TrainingType) {
    const next = new Set(selected);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setSelected(next);
    startTransition(async () => {
      await updateApplicantTrainingType(studentUserId, [...next]);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {TRAINING_TYPE_ORDER.map((t) => (
        <label key={t} className="flex items-center gap-1.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={selected.has(t)}
            disabled={isPending}
            onChange={() => toggle(t)}
            className="rounded border-slate-300 disabled:opacity-60"
          />
          {TRAINING_TYPE_LABELS[t]}
        </label>
      ))}
      {isPending && <span className="text-xs text-slate-400">Saving...</span>}
    </div>
  );
}
