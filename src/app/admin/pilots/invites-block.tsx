"use client";

import { useActionState, useState, useTransition } from "react";
import {
  sendWhatsAppInvite,
  resendWhatsAppInvite,
  removeWhatsAppInvite,
  type InviteState,
} from "@/lib/actions/whatsapp-invites";
import {
  INVITE_TEMPLATES,
  fillInviteTemplate,
  formatPhone,
  type InviteAudience,
} from "@/lib/invite-message";
import type { PendingInvite } from "@/lib/invites";

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

function InviteForm({ audience, onClose }: { audience: InviteAudience; onClose: () => void }) {
  const template = INVITE_TEMPLATES[audience];
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(fillInviteTemplate("", template));
  // Until the CFI edits the message by hand, it follows the name typed above.
  const [messageEdited, setMessageEdited] = useState(false);

  // Clear the form after a successful send, ready for the next person.
  const [state, formAction, isPending] = useActionState<InviteState, FormData>(
    async (prev, formData) => {
      const result = await sendWhatsAppInvite(prev, formData);
      if (result?.success) {
        setName("");
        setPhone("");
        setMessage(fillInviteTemplate("", template));
        setMessageEdited(false);
      }
      return result;
    },
    undefined
  );

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <input type="hidden" name="audience" value={audience} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="invite-name" className="mb-1 block text-xs font-medium text-slate-500">
            Name
          </label>
          <input
            id="invite-name"
            name="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!messageEdited) setMessage(fillInviteTemplate(e.target.value, template));
            }}
            placeholder="e.g. John Smith"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="invite-phone" className="mb-1 block text-xs font-medium text-slate-500">
            Cell number (WhatsApp)
          </label>
          <input
            id="invite-phone"
            name="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="082 123 4567"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label htmlFor="invite-message" className="mb-1 block text-xs font-medium text-slate-500">
          Message (you can edit it before sending)
        </label>
        <textarea
          id="invite-message"
          name="message"
          rows={6}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setMessageEdited(true);
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {isPending ? "Sending..." : "Send WhatsApp"}
        </button>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
          Close
        </button>
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
        {state?.success && <span className="text-sm text-green-700">{state.success}</span>}
      </div>
    </form>
  );
}

function InviteRow({ invite }: { invite: PendingInvite }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<InviteState>(undefined);

  function reInvite() {
    if (!confirm(`Send the invite to ${invite.name} again?`)) return;
    startTransition(async () => setResult(await resendWhatsAppInvite(invite.id)));
  }

  function remove() {
    if (!confirm(`Remove ${invite.name} from the invites list? (No message is sent.)`)) return;
    startTransition(async () => {
      await removeWhatsAppInvite(invite.id);
    });
  }

  return (
    <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium text-slate-900">
          {invite.name}{" "}
          <span className="font-normal text-slate-500">{formatPhone(invite.phone)}</span>
        </div>
        <div className="text-xs text-slate-500">
          Invited {fmtDate(invite.createdAt)}
          {invite.sendCount > 1 && ` · sent ${invite.sendCount} times, last ${fmtDate(invite.lastSentAt)}`}
          {invite.lastStatus === "failed" && (
            <span className="text-red-600"> · last send failed{invite.lastError ? `: ${invite.lastError}` : ""}</span>
          )}
        </div>
        {result?.error && <div className="text-xs text-red-600">{result.error}</div>}
        {result?.success && <div className="text-xs text-green-700">{result.success}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <button
          type="button"
          disabled={isPending}
          onClick={reInvite}
          className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {isPending ? "..." : "Re-invite"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={remove}
          className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </li>
  );
}

export default function InvitesBlock({
  invites,
  configured,
  audience = "pilot",
}: {
  invites: PendingInvite[];
  configured: boolean;
  /** Which list this is -- picks the default message and where new invites
   * are filed. Pilots page = "pilot", Students page = "student". */
  audience?: InviteAudience;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {audience === "student" ? "Student invites" : "Invites"}
          </h2>
          <p className="text-sm text-slate-500">
            {audience === "student" ? "Students" : "People"} invited to join the Hub by WhatsApp. A
            name drops off this list automatically once they sign up with the same cell number.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
          >
            {audience === "student" ? "+ Invite student via WhatsApp" : "+ Invite via WhatsApp"}
          </button>
        )}
      </div>

      {!configured && (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          WhatsApp sending isn&apos;t connected yet. Add GREEN_API_ID_INSTANCE and
          GREEN_API_TOKEN_INSTANCE (and GREEN_API_URL from the Green-API console) in Railway →
          Variables.
        </p>
      )}

      {open && (
        <div className="mb-4">
          <InviteForm audience={audience} onClose={() => setOpen(false)} />
        </div>
      )}

      {invites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No open invites.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {invites.map((inv) => (
            <InviteRow key={inv.id} invite={inv} />
          ))}
        </ul>
      )}
    </section>
  );
}
