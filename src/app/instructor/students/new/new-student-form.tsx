"use client";

import { useActionState, useState } from "react";
import { createInvitedStudent, type NewStudentState } from "@/lib/actions/students";

export default function NewStudentForm() {
  const [state, action, pending] = useActionState<NewStudentState, FormData>(
    createInvitedStudent,
    undefined
  );
  const [copied, setCopied] = useState(false);

  if (state?.inviteUrl) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Student account created. Send them this link to set their password
          and activate their account (valid 7 days):
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={state.inviteUrl}
            className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700"
          />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(state.inviteUrl);
              setCopied(true);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-block text-sm text-red-600 hover:underline"
        >
          Add another student
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Full name
        </label>
        <input
          id="name"
          name="name"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
          Phone <span className="text-slate-400">(optional)</span>
        </label>
        <input
          id="phone"
          name="phone"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>
      <div>
        <label htmlFor="trainingType" className="block text-sm font-medium text-slate-700">
          Training type
        </label>
        <select
          id="trainingType"
          name="trainingType"
          required
          defaultValue=""
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        >
          <option value="" disabled>
            Select...
          </option>
          <option value="pg">Paraglider (PG)</option>
          <option value="ppg">Powered Paragliding (PPG)</option>
          <option value="ppt">Powered Paratrike (PPT)</option>
        </select>
      </div>
      <div>
        <label htmlFor="callSign" className="block text-sm font-medium text-slate-700">
          Call sign <span className="text-slate-400">(optional, can set later)</span>
        </label>
        <input
          id="callSign"
          name="callSign"
          placeholder="PPG-DYB"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>
      <div>
        <label htmlFor="startDate" className="block text-sm font-medium text-slate-700">
          Start date <span className="text-slate-400">(optional)</span>
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>
      <div>
        <label htmlFor="sahpaNumber" className="block text-sm font-medium text-slate-700">
          SAHPA No. (SPL) <span className="text-slate-400">(optional, can set later)</span>
        </label>
        <input
          id="sahpaNumber"
          name="sahpaNumber"
          placeholder="12345"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>
      <div>
        <label htmlFor="sahpaExpiryDate" className="block text-sm font-medium text-slate-700">
          SAHPA expiry date <span className="text-slate-400">(optional)</span>
        </label>
        <input
          id="sahpaExpiryDate"
          name="sahpaExpiryDate"
          type="date"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create student & get invite link"}
      </button>
    </form>
  );
}
