"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStudentDetails } from "@/lib/actions/students";
import { parseTrainingTypes, type TrainingType } from "@/lib/training-types";

const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  pg: "Paraglider (PG)",
  ppg: "Powered Paragliding (PPG)",
  ppt: "Powered Paratrike (PPT)",
};
const TRAINING_TYPE_ORDER: TrainingType[] = ["pg", "ppg", "ppt"];

function formatDate(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

function isExpired(d: Date | null): boolean {
  return !!d && d.getTime() < Date.now();
}

export default function CallSignEditor({
  studentUserId,
  callSign,
  startDate,
  sacaaNumber,
  sahpaNumber,
  sahpaExpiryDate,
  trainingType,
}: {
  studentUserId: string;
  callSign: string | null;
  startDate: Date | null;
  sacaaNumber: string | null;
  sahpaNumber: string | null;
  sahpaExpiryDate: Date | null;
  /** Comma-separated, e.g. "pg,ppg" -- a student can be enrolled in more
   * than one course at once. */
  trainingType: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [callSignValue, setCallSignValue] = useState(callSign ?? "");
  const [startDateValue, setStartDateValue] = useState(formatDate(startDate));
  const [sacaaNumberValue, setSacaaNumberValue] = useState(sacaaNumber ?? "");
  const [sahpaNumberValue, setSahpaNumberValue] = useState(sahpaNumber ?? "");
  const [sahpaExpiryValue, setSahpaExpiryValue] = useState(
    formatDate(sahpaExpiryDate)
  );
  const [trainingTypeValue, setTrainingTypeValue] = useState<Set<TrainingType>>(
    new Set(parseTrainingTypes(trainingType))
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggleTrainingType(t: TrainingType) {
    setTrainingTypeValue((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      await updateStudentDetails(studentUserId, {
        callSign: callSignValue,
        startDate: startDateValue,
        sacaaNumber: sacaaNumberValue,
        sahpaNumber: sahpaNumberValue,
        sahpaExpiryDate: sahpaExpiryValue,
        trainingType: [...trainingTypeValue],
      });
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setCallSignValue(callSign ?? "");
    setStartDateValue(formatDate(startDate));
    setSacaaNumberValue(sacaaNumber ?? "");
    setSahpaNumberValue(sahpaNumber ?? "");
    setSahpaExpiryValue(formatDate(sahpaExpiryDate));
    setTrainingTypeValue(new Set(parseTrainingTypes(trainingType)));
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="mt-1 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[11px] text-slate-500">
            Training type <span className="font-normal">(a student can be enrolled in more than one)</span>
          </label>
          <div className="mt-0.5 flex flex-wrap gap-3 rounded-md border border-slate-300 px-2 py-1.5">
            {TRAINING_TYPE_ORDER.map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={trainingTypeValue.has(t)}
                  onChange={() => toggleTrainingType(t)}
                  className="rounded border-slate-300"
                />
                {TRAINING_TYPE_LABELS[t]}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[11px] text-slate-500">Call sign</label>
          <input
            autoFocus
            value={callSignValue}
            onChange={(e) => setCallSignValue(e.target.value)}
            placeholder="PPG-DYB"
            className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm uppercase"
          />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500">Start date</label>
          <input
            type="date"
            value={startDateValue}
            onChange={(e) => setStartDateValue(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500">SACAA No.</label>
          <input
            value={sacaaNumberValue}
            onChange={(e) => setSacaaNumberValue(e.target.value)}
            placeholder="0279002604"
            className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500">SAHPA No. (SPL)</label>
          <input
            value={sahpaNumberValue}
            onChange={(e) => setSahpaNumberValue(e.target.value)}
            placeholder="12345"
            className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500">SAHPA expiry</label>
          <input
            type="date"
            value={sahpaExpiryValue}
            onChange={(e) => setSahpaExpiryValue(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <button
          onClick={save}
          disabled={isPending}
          className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending ? "..." : "Save"}
        </button>
        <button
          onClick={cancel}
          className="px-1 py-1.5 text-xs text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  const expired = isExpired(sahpaExpiryDate);
  const trainingTypeLabel = parseTrainingTypes(trainingType)
    .map((t) => TRAINING_TYPE_LABELS[t])
    .join(" + ");
  const hasAnyDetail =
    callSign || startDate || sacaaNumber || sahpaNumber || sahpaExpiryDate || trainingType;

  return (
    <button
      onClick={() => setEditing(true)}
      className="mt-1 block text-sm text-slate-500 hover:text-red-600"
    >
      {hasAnyDetail ? (
        <>
          {trainingType && (
            <>
              Training:{" "}
              <span className="font-medium text-slate-900">{trainingTypeLabel}</span>
            </>
          )}
          {callSign && (
            <>
              {trainingType ? " · " : ""}
              Call sign: <span className="font-medium text-slate-900">{callSign}</span>
            </>
          )}
          {startDate && (
            <>
              {trainingType || callSign ? " · " : ""}
              Start date:{" "}
              <span className="font-medium text-slate-900">
                {startDate.toLocaleDateString()}
              </span>
            </>
          )}
          {sacaaNumber && (
            <>
              {trainingType || callSign || startDate ? " · " : ""}
              SACAA No.: <span className="font-medium text-slate-900">{sacaaNumber}</span>
            </>
          )}
          {sahpaNumber && (
            <>
              {trainingType || callSign || startDate || sacaaNumber ? " · " : ""}
              SAHPA No. (SPL): <span className="font-medium text-slate-900">{sahpaNumber}</span>
            </>
          )}
          {sahpaExpiryDate && (
            <>
              {trainingType || callSign || startDate || sacaaNumber || sahpaNumber ? " · " : ""}
              SAHPA expires:{" "}
              <span className={`font-medium ${expired ? "text-red-600" : "text-slate-900"}`}>
                {sahpaExpiryDate.toLocaleDateString()}
                {expired ? " (expired)" : ""}
              </span>
            </>
          )}
        </>
      ) : (
        "Set training type / call sign / start date / SAHPA details"
      )}
    </button>
  );
}
