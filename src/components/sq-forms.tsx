"use client";

import { useActionState } from "react";
import type { SqState } from "@/lib/actions/sq";
import {
  addManualSirsl, completeAudit, createOccurrence, raiseManualAction, reviewOccurrence,
  saveAuditResult, setQualityPerson, signOffAction, startAudit, submitAction,
} from "@/lib/actions/sq";

/** Batch 111: the small forms of the Safety (SO) and Quality (QA) modules. */

const input = "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm";
const label = "block text-xs font-medium text-slate-600";
const btn = "rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60";
const btnGrey = "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60";

function Msg({ s }: { s: SqState }) {
  if (!s) return null;
  return (
    <>
      {s.success && <p className="text-sm text-green-700">{s.success}</p>}
      {s.error && <p className="text-sm text-red-700">{s.error}</p>}
    </>
  );
}

export function OccurrenceForm() {
  const [s, action, pending] = useActionState<SqState, FormData>(createOccurrence, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>
          Type
          <select name="type" className={input} defaultValue="" required>
            <option value="" disabled>Choose...</option>
            <option value="accident">Accident</option>
            <option value="incident">Incident</option>
            <option value="near_miss">Near miss</option>
            <option value="hazard">Hazard / safety concern</option>
            <option value="equipment">Equipment defect</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className={label}>
          Date and time (blank = now)
          <input type="datetime-local" name="occurredAt" className={input} />
        </label>
        <label className={label}>
          Injuries
          <select name="injuries" className={input} defaultValue="none">
            <option value="none">None</option>
            <option value="minor">Minor</option>
            <option value="serious">Serious</option>
            <option value="fatal">Fatal</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Site<input name="site" className={input} placeholder="e.g. Grasslands" /></label>
        <label className={label}>Wing / motor / equipment<input name="equipment" className={input} /></label>
        <label className={label}>People involved<input name="people" className={input} /></label>
        <label className={label}>Weather and wind<input name="weather" className={input} /></label>
      </div>
      <label className={label}>
        What happened
        <textarea name="description" rows={4} required className={input} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Damage<input name="damage" className={input} /></label>
        <label className={label}>Immediate action taken<input name="immediateAction" className={input} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="confidential" /> Keep my name confidential (Just Culture)
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btn}>{pending ? "Sending..." : "Submit report"}</button>
        <Msg s={s} />
      </div>
    </form>
  );
}

export function ReviewOccurrenceForm({ id, soNotes, external, canSo, closed }: { id: string; soNotes: string; external: string; canSo: boolean; closed: boolean }) {
  const [s, action, pending] = useActionState<SqState, FormData>(reviewOccurrence, undefined);
  if (!canSo) return <p className="text-sm text-slate-500">Only the Safety Officer reviews, closes or raises actions on occurrence reports.</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <label className={label}>
        Safety Officer notes (what was found, what intervention was made)
        <textarea name="soNotes" rows={3} defaultValue={soNotes} className={input} />
      </label>
      <label className={label}>
        Reported externally (when, to whom: SAHPA National Safety Officer, SAHPA system, AIID...)
        <input name="externalReportedAt" defaultValue={external} className={input} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" name="mode" value="save" disabled={pending} className={btnGrey}>Save notes</button>
        {!closed && (
          <button type="submit" name="mode" value="close" disabled={pending} className={btnGrey}>
            Close: immediate intervention made
          </button>
        )}
      </div>
      {!closed && (
        <fieldset className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <legend className="px-1 text-xs font-semibold text-amber-900">Or send a corrective action to the CFI</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={`${label} sm:col-span-2`}>What must be done<input name="actionTitle" className={input} /></label>
            <label className={label}>Due date<input type="date" name="dueDate" className={input} /></label>
          </div>
          <label className={`${label} mt-2`}>Details<textarea name="actionDescription" rows={2} className={input} /></label>
          <button type="submit" name="mode" value="action" disabled={pending} className={`${btn} mt-3`}>Send action to the CFI</button>
        </fieldset>
      )}
      <Msg s={s} />
    </form>
  );
}

export function SubmitActionForm({ id, returnComment }: { id: string; returnComment?: string | null }) {
  const [s, action, pending] = useActionState<SqState, FormData>(submitAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      {returnComment && <p className="rounded-md bg-red-50 p-2 text-xs text-red-800">Returned: {returnComment}</p>}
      <label className={label}>
        What was done to correct it (and the root cause)
        <textarea name="response" rows={3} required className={input} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btn}>{pending ? "Submitting..." : "Complete and submit for sign-off"}</button>
        <Msg s={s} />
      </div>
    </form>
  );
}

export function SignOffForm({ id, canSign, who }: { id: string; canSign: boolean; who: string }) {
  const [s, action, pending] = useActionState<SqState, FormData>(signOffAction, undefined);
  if (!canSign) return <p className="text-xs text-slate-500">Waiting for sign-off by {who}.</p>;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className={label}>
        Comment (needed if you return it)
        <input name="comment" className={input} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" name="decision" value="signoff" disabled={pending} className={btn}>Sign off and log</button>
        <button type="submit" name="decision" value="return" disabled={pending} className={btnGrey}>Return to the CFI</button>
        <Msg s={s} />
      </div>
    </form>
  );
}

export function ManualActionForm({ area }: { area: "safety" | "quality" }) {
  const [s, action, pending] = useActionState<SqState, FormData>(raiseManualAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="area" value={area} />
      <div className="grid gap-3 sm:grid-cols-4">
        <label className={`${label} sm:col-span-2`}>{area === "quality" ? "Finding" : "Action"}<input name="title" required className={input} /></label>
        {area === "quality" && (
          <label className={label}>
            Level
            <select name="level" className={input} defaultValue="2">
              <option value="1">Level 1</option>
              <option value="2">Level 2</option>
            </select>
          </label>
        )}
        <label className={label}>Due date<input type="date" name="dueDate" className={input} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Reference (MOP section / CAR clause)<input name="reference" className={input} /></label>
        <label className={label}>Details<input name="description" className={input} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btn}>Send to the CFI</button>
        <Msg s={s} />
      </div>
    </form>
  );
}

export function SirslForm() {
  const [s, action, pending] = useActionState<SqState, FormData>(addManualSirsl, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Event / activity<input name="event" required className={input} placeholder="e.g. Fire extinguisher check" /></label>
        <label className={label}>Action<input name="action" className={input} /></label>
        <label className={label}>Date completed<input type="date" name="completedAt" className={input} /></label>
        <label className={label}>Comments<input name="comments" className={input} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btn}>Add to the SIRSL</button>
        <Msg s={s} />
      </div>
    </form>
  );
}

export function StartAuditForm({ checklists }: { checklists: { id: string; title: string; n: number }[] }) {
  const [s, action, pending] = useActionState<SqState, FormData>(startAudit, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>
          Checklist
          <select name="checklistId" required className={input} defaultValue="">
            <option value="" disabled>Choose...</option>
            {checklists.map((c) => (
              <option key={c.id} value={c.id}>{c.title} ({c.n} items)</option>
            ))}
          </select>
        </label>
        <label className={label}>Date (blank = today)<input type="date" name="auditDate" className={input} /></label>
        <label className={label}>Scope (site, instructor, sample)<input name="scope" className={input} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btn}>Start audit</button>
        <Msg s={s} />
        {s?.id && <a href={`/instructor/sq/quality/${s.id}`} className="text-sm font-semibold text-red-600 underline">Open the audit</a>}
      </div>
    </form>
  );
}

export function AuditItemForm(p: {
  id: string; position: number; question: string; reference: string | null;
  result: string | null; comment: string | null; evidence: string | null; level: number | null; locked: boolean;
}) {
  const [s, action, pending] = useActionState<SqState, FormData>(saveAuditResult, undefined);
  const tone =
    p.result === "compliant" ? "border-green-300 bg-green-50"
    : p.result === "non_compliant" ? "border-red-300 bg-red-50"
    : p.result === "observation" ? "border-amber-300 bg-amber-50"
    : p.result === "na" ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white";
  return (
    <form action={action} className={`rounded-xl border-2 p-3 ${tone}`}>
      <input type="hidden" name="id" value={p.id} />
      <p className="text-sm font-semibold text-slate-900">
        {p.position}. {p.question}
      </p>
      {p.reference && <p className="text-xs text-slate-500">Reference: {p.reference}</p>}
      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        {[
          ["compliant", "Compliant"],
          ["non_compliant", "Non-compliant"],
          ["observation", "Observation"],
          ["na", "N/A"],
        ].map(([v, l]) => (
          <label key={v} className="flex items-center gap-1">
            <input type="radio" name="result" value={v} defaultChecked={p.result === v} disabled={p.locked} required /> {l}
          </label>
        ))}
        <label className="flex items-center gap-1 text-xs text-slate-600">
          If non-compliant:
          <select name="level" defaultValue={String(p.level ?? 2)} disabled={p.locked} className="rounded border border-slate-300 px-1 py-0.5">
            <option value="1">Level 1</option>
            <option value="2">Level 2</option>
          </select>
        </label>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <input name="comment" defaultValue={p.comment ?? ""} disabled={p.locked} placeholder="Comment (needed for non-compliant / observation)" className={`${input} sm:col-span-2`} />
        <input name="evidence" defaultValue={p.evidence ?? ""} disabled={p.locked} placeholder="Evidence checked" className={input} />
      </div>
      {!p.locked && (
        <div className="mt-2 flex items-center gap-3">
          <button type="submit" disabled={pending} className={btnGrey}>{pending ? "Saving..." : "Save"}</button>
          <Msg s={s} />
        </div>
      )}
    </form>
  );
}

export function CompleteAuditForm({ auditId, conclusion }: { auditId: string; conclusion: string }) {
  const [s, action, pending] = useActionState<SqState, FormData>(completeAudit, undefined);
  return (
    <form action={action} className="space-y-3 rounded-xl border-2 border-red-300 bg-white p-4">
      <input type="hidden" name="auditId" value={auditId} />
      <label className={label}>
        Conclusion
        <textarea name="conclusion" rows={3} defaultValue={conclusion} className={input} />
      </label>
      <p className="text-xs text-slate-500">Completing signs the audit in your name, locks it, sends every non-compliant item to the CFI as a finding and writes it in the SIRSL.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btn}>{pending ? "Completing..." : "Complete and sign the audit"}</button>
        <Msg s={s} />
      </div>
    </form>
  );
}

export function QualityPersonForm({ current, staff }: { current: string | null; staff: { id: string; name: string }[] }) {
  const [s, action, pending] = useActionState<SqState, FormData>(setQualityPerson, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="block flex-1 text-xs font-medium text-slate-600">
        Quality (QA) person
        <select name="qualityPersonUserId" defaultValue={current ?? ""} className={input}>
          <option value="">-- none --</option>
          {staff.map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className={btn}>{pending ? "Saving..." : "Save"}</button>
      <Msg s={s} />
    </form>
  );
}
