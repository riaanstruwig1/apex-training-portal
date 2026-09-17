"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStudentDetails } from "@/lib/actions/students";
import type { TrainingType } from "@/lib/exams";

const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  pg: "Paraglider (PG)",
  ppg: "Powered Paragliding (PPG)",
  ppt: "Powered Paratrike (PPT)",
};

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
  sahpaNumber,
  sahpaExpiryDate,
  trainingType,
}: {
  studentUserId: string;
  callSign: string | null;
  startDate: Date | null;
  sahpaNumber: string | null;
  sahpaExpiryDate: Date | null;
  trainingType: TrainingType | null;
}) {
  const [editing, setEditing] = useState(false);
  const [callSignValue, setCallSignValue] = useState(callSign ?? "");
  const [startDateValue, setStartDateValue] = useState(formatDate(startDate));
  const [sahpaNumberValue, setSahpaNumberValue] = useState(sahpaNumber ?? "");
  const [sahpaExpiryValue, setSahpaExpiryValue] = useState(
    formatDate(sahpaExpiryDate)
  );
  const [trainingTypeValue, setTrainingTypeValue] = useState<TrainingType | "">(
    trainingType ?? ""
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      await updateStudentDetails(studentUserId, {
        callSign: callSignValue,
        startDate: startDateValue,
        sahpaNumber: sahpaNumberValue,
        sahpaExpiryDate: sahpaExpiryValue,
        trainingType: trainingTypeValue || null,
      });
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setCallSignValue(callSign ?? "");
    setStartDateValue(formatDate(startDate));
    setSahpaNumberValue(sahpaNumber ?? "");
    setSahpaExpiryValue(formatDate(sahpaExpiryDate));
    setTrainingTypeValue(trainingType ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="mt-1 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[11px] text-slate-500">Training type</label>
          <select
            value={trainingTypeValue}
            onChange={(e) => setTrainingTypeValue(e.target.value as TrainingType | "")}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">Not set</option>
            {(Object.entries(TRAINING_TYPE_LABELS) as [TrainingType, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
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
  const hasAnyDetail = callSign || startDate || sahpaNumber || sahpaExpiryDate || trainingType;

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
              <span className="font-medium text-slate-900">
                {TRAINING_TYPE_LABELS[trainingType]}
              </span>
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
          {sahpaNumber && (
            <>
              {trainingType || callSign || startDate ? " · " : ""}
              SAHPA No. (SPL): <span className="font-medium text-slate-900">{sahpaNumber}</span>
            </>
          )}
          {sahpaExpiryDate && (
            <>
              {trainingType || callSign || startDate || sahpaNumber ? " · " : ""}
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
