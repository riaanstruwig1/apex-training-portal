"use client";

import { useState } from "react";
import { formatPhone } from "@/lib/invite-message";
import type { FormsSendLogEntry } from "@/lib/forms-send-log";

/** Batch 88 (Riaan, 29 Oct 2026): log sheet of every Forms & procedures
 * WhatsApp send -- no., date, name, number, what was sent. Newest first;
 * No. 1 is the first send ever logged. */
const SHOW_FIRST = 20;

function Row({ e, no }: { e: FormsSendLogEntry; no: number }) {
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-3 py-2 text-slate-500">{no}</td>
      <td className="whitespace-nowrap px-3 py-2 text-slate-700">{e.dateText}</td>
      <td className="px-3 py-2 font-medium text-slate-900">{e.recipientName ?? <span className="text-slate-400">--</span>}</td>
      <td className="whitespace-nowrap px-3 py-2 text-slate-700">{formatPhone(e.phone)}</td>
      <td className="px-3 py-2 text-slate-800">
        {e.kind === "pack" ? (
          <>
            <span className="font-medium">{e.title}</span>{" "}
            <span className="text-xs text-slate-500">(send pack, {e.documents.length} document{e.documents.length === 1 ? "" : "s"})</span>
            <div className="text-xs text-slate-500">{e.documents.join(" · ")}</div>
          </>
        ) : (
          e.title
        )}
      </td>
      <td className="px-3 py-2 text-slate-600">{e.sentByName ?? "--"}</td>
      <td className="px-3 py-2">
        {e.status === "sent" ? (
          <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">Sent</span>
        ) : (
          <span
            title={e.detail ?? ""}
            className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700"
          >
            {e.status === "partial" ? "Partly sent" : "Failed"}
          </span>
        )}
      </td>
    </tr>
  );
}

export default function SendLog({ entries, total }: { entries: FormsSendLogEntry[]; total: number }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? entries : entries.slice(0, SHOW_FIRST);
  const hidden = entries.length - shown.length;
  const header = (
    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      <tr>
        <th className="px-3 py-2">No.</th>
        <th className="px-3 py-2">Date</th>
        <th className="px-3 py-2">Name</th>
        <th className="px-3 py-2">Cell number</th>
        <th className="px-3 py-2">What was sent</th>
        <th className="px-3 py-2">Sent by</th>
        <th className="px-3 py-2">Result</th>
      </tr>
    </thead>
  );

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Send log</h2>
          <p className="text-xs text-slate-500">Every document and send pack sent on WhatsApp from this page, newest first.</p>
        </div>
        {total > 0 && (
          <a
            href="/api/forms-send-log"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Download Excel
          </a>
        )}
      </div>
      {total === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          Nothing sent yet. Sends from the Send (WhatsApp) buttons and the send packs will be listed here.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            {header}
            <tbody>
              {shown.map((e, i) => (
                <Row key={e.id} e={e} no={total - i} />
              ))}
            </tbody>
          </table>
          {hidden > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full border-t border-slate-200 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              Show {hidden} older send{hidden === 1 ? "" : "s"}
            </button>
          )}
          {showAll && total > entries.length && (
            <p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
              The newest {entries.length} are shown here. Download Excel for the full log.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
