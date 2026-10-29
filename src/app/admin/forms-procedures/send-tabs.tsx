"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { groupByCategory } from "@/lib/forms-categories";
import type { FormsProcedureSlot } from "@/lib/actions/forms-procedures";
import {
  saveFormsSendTab,
  clearFormsSendTab,
  sendFormsSendTabWhatsApp,
  type SendTab,
  type SaveTabState,
  type SendTabState,
} from "@/lib/actions/forms-send-tabs";
import type { Recipient } from "./forms-procedures-editor";

/** Batch 87 (Riaan, 29 Oct 2026): six tabs, each a named pack of documents
 * already on the Forms & procedures list, sent together on WhatsApp. */

function TabEditor({ tab, docs, onDone }: { tab: SendTab; docs: FormsProcedureSlot[]; onDone: () => void }) {
  const [state, action, pending] = useActionState<SaveTabState, FormData>(saveFormsSendTab, undefined);
  const [picked, setPicked] = useState<Set<number>>(new Set(tab.slots));
  useEffect(() => {
    if (state && "success" in state) onDone();
  }, [state, onDone]);

  const groups = groupByCategory(docs).filter((g) => g.items.length > 0);
  // Keep the tab's existing order, then add newly ticked documents in screen order.
  const screenOrder = groups.flatMap((g) => g.items.map((d) => d.slot));
  const ordered = [
    ...tab.slots.filter((s) => picked.has(s) && screenOrder.includes(s)),
    ...screenOrder.filter((s) => picked.has(s) && !tab.slots.includes(s)),
  ];

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="position" value={tab.position} />
      {ordered.map((s) => (
        <input key={s} type="hidden" name="slot" value={s} />
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600">
          Tab name
          <input
            name="name"
            defaultValue={tab.name ?? ""}
            maxLength={60}
            placeholder="e.g. General notice to student"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Message with the documents (optional)
          <textarea
            name="message"
            defaultValue={tab.message ?? ""}
            maxLength={600}
            rows={2}
            placeholder="e.g. Welcome to Apex! Here is everything you need before your first lesson."
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div>
        <div className="mb-2 text-xs font-medium text-slate-600">
          Tick the documents for this tab ({picked.size} ticked)
        </div>
        {groups.length === 0 && (
          <p className="text-sm text-slate-500">No documents are loaded yet. Add them under the headings below first.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.label}</div>
              <div className="space-y-1">
                {g.items.map((d) => (
                  <label key={d.slot} className="flex items-start gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={picked.has(d.slot)}
                      onChange={(e) => {
                        const next = new Set(picked);
                        if (e.target.checked) next.add(d.slot);
                        else next.delete(d.slot);
                        setPicked(next);
                      }}
                      className="mt-0.5"
                    />
                    <span className="text-slate-800">{d.title}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save tab"}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-slate-500 hover:text-slate-700">
          Cancel
        </button>
        {state && "error" in state && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

function TabSender({
  tab,
  count,
  recipients,
  whatsappReady,
  onClose,
}: {
  tab: SendTab;
  count: number;
  recipients: Recipient[];
  whatsappReady: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<SendTabState, FormData>(sendFormsSendTabWhatsApp, undefined);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pick, setPick] = useState("");

  return (
    <form action={action} className="mt-4 space-y-3 rounded-lg border border-green-200 bg-green-50/50 p-3">
      <input type="hidden" name="position" value={tab.position} />
      <input type="hidden" name="name" value={name} />
      <div className="text-sm font-semibold text-slate-800">
        Send &ldquo;{tab.name}&rdquo; ({count} document{count === 1 ? "" : "s"}) on WhatsApp
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-600">
          Student or pilot
          <select
            value={pick}
            onChange={(e) => {
              const r = recipients.find((x) => x.phone === e.target.value);
              setPick(e.target.value);
              setPhone(r ? r.display : "");
              setName(r ? r.name : "");
            }}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">-- choose a person --</option>
            {recipients.map((r) => (
              <option key={r.phone + r.name} value={r.phone}>
                {r.name} ({r.role}) {r.display}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          or cell number
          <input
            name="phone"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setPick("");
              setName("");
            }}
            placeholder="082 123 4567"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <p className="rounded-md bg-white px-3 py-2 text-xs text-slate-600">
        WhatsApp sends one file per message, so the documents arrive one after the other in the same chat.
        The first one carries the tab name, your message, the list of documents and the standard reference note.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !phone.trim()}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
        >
          {pending ? `Sending ${count} document${count === 1 ? "" : "s"}...` : "Send all on WhatsApp"}
        </button>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
          Close
        </button>
        {!whatsappReady && (
          <span className="text-xs text-amber-700">WhatsApp isn&apos;t set up on this server (Green-API variables missing).</span>
        )}
        {state?.ok && <span className="text-sm text-green-700">{state.ok}</span>}
        {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}

export default function SendTabs({
  tabs,
  slots,
  recipients,
  whatsappReady,
}: {
  tabs: SendTab[];
  slots: FormsProcedureSlot[];
  recipients: Recipient[];
  whatsappReady: boolean;
}) {
  const [active, setActive] = useState(1);
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [clearing, startClear] = useTransition();

  const docs = slots.filter((s) => s.filename);
  const bySlot = new Map(docs.map((d) => [d.slot, d]));
  const tab = tabs.find((t) => t.position === active) ?? tabs[0];
  const tabDocs = tab.slots.map((s) => bySlot.get(s)).filter((d): d is FormsProcedureSlot => !!d);
  const missing = tab.slots.length - tabDocs.length;

  function choose(p: number) {
    setActive(p);
    setEditing(false);
    setSending(false);
  }

  return (
    <section className="mb-10 rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 pt-4">
        <h2 className="text-base font-semibold text-slate-900">Send packs (WhatsApp)</h2>
        <p className="mb-3 text-xs text-slate-500">
          Up to six tabs, each a set of the documents below that you often send together. Set a tab up once with{" "}
          <strong>Edit</strong>, then send all its documents to a student or pilot in one go.
        </p>
        <div className="-mb-px flex flex-wrap gap-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.position}
              type="button"
              role="tab"
              aria-selected={t.position === active}
              onClick={() => choose(t.position)}
              className={`rounded-t-md border px-3 py-1.5 text-sm ${
                t.position === active
                  ? "border-slate-200 border-b-white bg-white font-semibold text-red-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.name ?? `Tab ${t.position}`}
              {t.name && <span className="ml-1 text-xs text-slate-400">({t.slots.length})</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {editing ? (
          <TabEditor key={tab.position} tab={tab} docs={docs} onDone={() => setEditing(false)} />
        ) : !tab.name ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">Tab {tab.position} isn&apos;t set up yet.</p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Set up this tab
            </button>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{tab.name}</div>
                {tab.message && <p className="mt-1 max-w-2xl text-sm text-slate-600">{tab.message}</p>}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={clearing}
                  onClick={() => {
                    if (!confirm(`Clear the tab "${tab.name}"? The documents stay on the list.`)) return;
                    startClear(async () => {
                      await clearFormsSendTab(tab.position);
                    });
                  }}
                  className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-60"
                >
                  {clearing ? "Clearing..." : "Clear"}
                </button>
                <button
                  type="button"
                  disabled={tabDocs.length === 0}
                  onClick={() => setSending((v) => !v)}
                  className="rounded-md bg-green-600 px-2.5 py-1 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Send (WhatsApp)
                </button>
              </div>
            </div>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              {tabDocs.map((d) => (
                <li key={d.slot}>
                  {d.title}{" "}
                  <a href={`/api/forms-procedures/${d.filename}`} className="text-xs text-slate-400 hover:text-slate-600">
                    download
                  </a>
                </li>
              ))}
            </ol>
            {missing > 0 && (
              <p className="mt-2 text-xs text-amber-700">
                {missing} document{missing === 1 ? " was" : "s were"} cleared from the list and will be skipped. Use Edit to
                tidy up this tab.
              </p>
            )}
            {sending && (
              <TabSender
                tab={tab}
                count={tabDocs.length}
                recipients={recipients}
                whatsappReady={whatsappReady}
                onClose={() => setSending(false)}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
