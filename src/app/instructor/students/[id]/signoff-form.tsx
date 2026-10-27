"use client";

import { useActionState } from "react";
import { signOffStudent, regenerateSubmissionPack, type SignoffState } from "@/lib/actions/signoff";

const GRADE_ITEMS: { key: string; label: string; ppOnly?: boolean }[] = [
  { key: "takeoff", label: "Good take-off" },
  { key: "landing", label: "Landing ability" },
  { key: "turns360", label: "Consecutive 360 turns" },
  { key: "ridge", label: "Ridge soaring" },
  { key: "spot", label: "Spot landing" },
  { key: "engine", label: "Engine & power management", ppOnly: true },
  { key: "weather", label: "Theory: weather" },
  { key: "airlaw", label: "Theory: air law" },
  { key: "turbulence", label: "Theory: turbulence" },
];

const input = "w-full rounded-md border border-slate-300 px-2 py-1 text-sm";

function Messages({ state }: { state: SignoffState }) {
  return (
    <>
      {state?.error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}
      {state?.success && <p className="rounded bg-green-50 p-2 text-sm text-green-800">{state.success}</p>}
      {state?.warnings && state.warnings.length > 0 && (
        <ul className="list-disc rounded bg-amber-50 p-2 pl-6 text-sm text-amber-900">
          {state.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
    </>
  );
}

export function SignoffForm(props: {
  studentId: string;
  trainingType: "pg" | "ppg" | "ppt";
  surname: string;
  firstNames: string;
  callSign: string;
  unverifiedCount: number;
  hasSignature: boolean;
  signatureConsent: "yes" | "no" | null;
  hasPhoto: boolean;
  hasId: boolean;
  instructorCaaNo: string;
  examinerName: string;
}) {
  const [state, action, pending] = useActionState(signOffStudent, undefined);
  const checks = [
    { ok: props.hasPhoto, text: "Profile picture (passport photo)" },
    { ok: props.hasId, text: "ID / passport copy" },
    { ok: props.hasSignature && props.signatureConsent === "yes", text: !props.hasSignature ? "Student has no saved signature (sign by hand)" : props.signatureConsent === "yes" ? "Student signature saved and he agreed to its use on the forms" : props.signatureConsent === "no" ? "Student answered NO to using his signature (sign by hand)" : "Student has NOT answered the signature consent question - ask him to answer under Edit profile first" },
    { ok: props.unverifiedCount === 0, text: props.unverifiedCount ? `${props.unverifiedCount} logbook flight(s) not yet countersigned - they will be countersigned by you at sign-off` : "All logbook flights countersigned" },
  ];
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="studentId" value={props.studentId} />
      <ul className="space-y-1 text-sm">
        {checks.map((c) => (
          <li key={c.text} className={c.ok ? "text-green-700" : "text-amber-700"}>{c.ok ? "✓" : "!"} {c.text}</li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Programme
          <select name="trainingType" defaultValue={props.trainingType} className={input}>
            <option value="pg">Paragliding (PG)</option>
            <option value="ppg">Powered Paragliding (PPG)</option>
            <option value="ppt">Powered Trike/Chute (PPT/PPC)</option>
          </select>
        </label>
        <label className="text-sm">Surname (as on ID)<input name="surname" defaultValue={props.surname} className={input} /></label>
        <label className="text-sm">First names<input name="firstNames" defaultValue={props.firstNames} className={input} /></label>
        <label className="text-sm">Your CAA No. (027...)<input name="instructorLicenceNumber" defaultValue={props.instructorCaaNo} placeholder="027..." required className={input} /></label>
        <label className="text-sm">Rating line on the DTO certificate
          <input name="instructorRatingLine" placeholder="e.g. CFI-Grade A PPG, PPT, PPC / Grade B PG" className={input} />
        </label>
        <label className="text-sm">Radio examiner (CA 62-16 C)<input name="radioExaminerName" defaultValue={props.examinerName} className={input} /></label>
        <label className="text-sm">Examiner licence no.<input name="radioExaminerLicence" defaultValue="RA-RTE013" className={input} /></label>
        {[1, 2, 3].map((n) => (
          <label key={n} className="text-sm">Call sign choice {n}
            <input name={`callSign${n}`} defaultValue={n === 1 ? props.callSign : ""} className={input} />
          </label>
        ))}
      </div>
      <fieldset className="rounded-md border border-slate-200 p-3">
        <legend className="px-1 text-sm font-semibold text-slate-700">CA 62-15 skill test grades</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {GRADE_ITEMS.map((g) => (
            <label key={g.key} className="text-sm">{g.label}{g.ppOnly ? " (PPG/PPT/PPC)" : ""}
              <select name={`grade_${g.key}`} defaultValue="good" className={input}>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="average">Average</option>
                <option value="need_practice">Need practice</option>
              </select>
            </label>
          ))}
        </div>
        <label className="mt-2 block text-sm">Remedial action (if any)
          <textarea name="remedialAction" rows={2} className={input} />
        </label>
      </fieldset>
      <Messages state={state} />
      <button disabled={pending} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
        {pending ? "Signing off and building pack..." : "Sign off student - award Solo wings"}
      </button>
      <p className="text-xs text-slate-500">The student stays on the Student list until his CAA licence is submitted. This builds the SAHPA/CAA submission pack.</p>
    </form>
  );
}

export function RegenerateForm({ studentId, trainingType }: { studentId: string; trainingType: string }) {
  const [state, action, pending] = useActionState(regenerateSubmissionPack, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="trainingType" value={trainingType} />
      <button disabled={pending} className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
        {pending ? "Rebuilding..." : "Regenerate pack"}
      </button>
      <Messages state={state} />
    </form>
  );
}
