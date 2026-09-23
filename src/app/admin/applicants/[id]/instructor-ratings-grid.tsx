"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminSetInstructorGrade,
  adminSetAssistantInstructor,
} from "@/lib/actions/verification";

type Grade = "c" | "b" | "a";
type Equipment = "pg" | "ppg" | "ppt";

const EQUIPMENT: { key: Equipment; label: string }[] = [
  { key: "pg", label: "PG" },
  { key: "ppg", label: "PPG" },
  { key: "ppt", label: "PPT" },
];
const GRADES: { key: Grade; label: string }[] = [
  { key: "c", label: "Grade C" },
  { key: "b", label: "Grade B" },
  { key: "a", label: "Grade A" },
];

type InstructorEndorsement = { key: string; verified: boolean; declined: boolean };

function stateOf(endorsements: InstructorEndorsement[], key: string) {
  const row = endorsements.find((e) => e.key === key);
  if (!row) return "none" as const;
  if (row.declined) return "declined" as const;
  if (row.verified) return "held" as const;
  return "pending" as const;
}

/**
 * Three-column instructor-ratings grid (Notes4 item 15) -- PG / PPG / PPT
 * columns, each grade independently toggleable on/off, with one built-in
 * conflict rule (V22 rollout item 8, 23 Sep 2026, per Riaan's confirmed
 * combinations): Grade B and Grade A can't both be held for the same
 * equipment type at once -- turning one on clears the other if it was
 * held -- but Grade C is independent and can be held alongside either one
 * (or alone, or with neither). Enforced server-side in
 * adminSetInstructorGrade. Plus the single shared "Assistant Instructor"
 * toggle above the grid since that rating isn't tracked per equipment
 * (see INSTRUCTOR_RATING_REFERENCE_TEXT). Replaces the old flat checkbox/
 * Apply/Grant list for this one group, which let a pilot end up with
 * contradictory state like both Grade B and Grade A declared at once.
 */
export default function InstructorRatingsGrid({
  pilotProfileId,
  applicantUserId,
  endorsements,
}: {
  pilotProfileId: string;
  applicantUserId: string;
  endorsements: InstructorEndorsement[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const assistantState = stateOf(endorsements, "assistant_instructor");

  function setGrade(equipment: Equipment, grade: Grade, held: boolean) {
    startTransition(async () => {
      await adminSetInstructorGrade(pilotProfileId, applicantUserId, equipment, grade, held);
      router.refresh();
    });
  }

  function toggleAssistant() {
    startTransition(async () => {
      await adminSetAssistantInstructor(pilotProfileId, applicantUserId, assistantState !== "held");
      router.refresh();
    });
  }

  const stateClass: Record<ReturnType<typeof stateOf>, string> = {
    held: "bg-green-600 text-white border-green-600",
    pending: "bg-amber-100 text-amber-800 border-amber-300",
    declined: "bg-red-50 text-red-700 border-red-300",
    none: "border-slate-200 text-slate-600 hover:bg-slate-50",
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={isPending}
        onClick={toggleAssistant}
        className={`rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${stateClass[assistantState]}`}
        title="Not tracked per equipment type -- one shared prerequisite rating."
      >
        Assistant Instructor{" "}
        {assistantState === "held"
          ? "✓"
          : assistantState === "declined"
            ? "✕"
            : assistantState === "pending"
              ? "-- applied, click to verify"
              : ""}
      </button>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {EQUIPMENT.map((eq) => {
          const anyDeclared = GRADES.some(
            (g) => stateOf(endorsements, `instructor_${eq.key}_grade_${g.key}`) !== "none"
          );
          return (
            <div key={eq.key} className="rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {eq.label}
              </p>
              <div className="space-y-1.5">
                {GRADES.map((g) => {
                  const key = `instructor_${eq.key}_grade_${g.key}`;
                  const state = stateOf(endorsements, key);
                  return (
                    <button
                      key={g.key}
                      type="button"
                      disabled={isPending}
                      onClick={() => setGrade(eq.key, g.key, state !== "held")}
                      className={`block w-full rounded-md border px-2 py-1 text-left text-xs font-medium disabled:opacity-60 ${stateClass[state]}`}
                    >
                      {g.label}{" "}
                      {state === "held"
                        ? "✓"
                        : state === "declined"
                          ? "✕"
                          : state === "pending"
                            ? "-- applied, click to verify"
                            : ""}
                    </button>
                  );
                })}
              </div>
              {!anyDeclared && (
                <p className="mt-1.5 text-[11px] text-slate-400">None held</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
