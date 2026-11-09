"use client";

import { useState } from "react";
import {
  BANK_DETAILS,
  PAYMENT_OPTIONS,
  paymentOption,
  paymentTotal,
  rand,
  type PaymentOptionKey,
} from "@/lib/payment-options";

/** Batch 92 (Riaan, 9 Nov 2026): green "Payment options" block just before
 * the student submits -- choose an option (invoice shown), who the invoice
 * goes to, bank details, and the proof of payment upload (required). */
export default function PaymentBlock({ introCourse, fullName }: { introCourse: boolean; fullName: string }) {
  // Intro ticked at the top -> option 1 pre-selected (until he picks another).
  const [picked, setPicked] = useState<PaymentOptionKey | null>(null);
  const choice: PaymentOptionKey | null = picked ?? (introCourse ? "intro" : null);
  const [ppgOpen, setPpgOpen] = useState(false);
  const ppgOn = ppgOpen || choice === "ppg_p1" || choice === "ppg_full";
  const [invoiceTo, setInvoiceTo] = useState<"self" | "company">("self");
  const opt = paymentOption(choice);
  const total = opt ? paymentTotal(opt) : null;

  const radio = (key: PaymentOptionKey, disabled = false) => (
    <input
      type="radio"
      name="paymentOption"
      value={key}
      checked={choice === key}
      disabled={disabled}
      required
      onChange={() => setPicked(key)}
      className="mt-1"
    />
  );
  const intro = PAYMENT_OPTIONS[0];
  const p1 = PAYMENT_OPTIONS[1];
  const full = PAYMENT_OPTIONS[2];
  const other = PAYMENT_OPTIONS[3];

  return (
    <div className="space-y-4 rounded-lg border-2 border-green-400 bg-green-50 p-4 text-sm text-slate-800">
      <p className="text-base font-semibold text-green-900">Payment options</p>

      {/* 1. Intro */}
      <label className="flex items-start gap-2 rounded-md border border-green-200 bg-white p-3">
        {radio("intro")}
        <span className="flex-1">
          <span className="font-semibold">1. {intro.label}</span>
          <span className="float-right font-semibold">{rand(paymentTotal(intro)!)}</span>
        </span>
      </label>

      {/* 2. PPG */}
      <div className={`rounded-md border p-3 ${ppgOn ? "border-green-200 bg-white" : "border-slate-200 bg-white/60"}`}>
        <label className="flex items-center gap-2 font-semibold">
          <input
            type="checkbox"
            checked={ppgOn}
            onChange={(e) => {
              setPpgOpen(e.target.checked);
              if (!e.target.checked && (choice === "ppg_p1" || choice === "ppg_full")) setPicked(null);
            }}
          />
          2. Powered Paragliding (PPG)
        </label>
        <div className={`mt-2 space-y-2 pl-6 ${ppgOn ? "" : "opacity-50"}`}>
          <label className="flex items-start gap-2">
            {radio("ppg_p1", !ppgOn)}
            <span className="flex-1">
              <span className="font-medium">a. PPG Phase 1 - PG/PPG</span>
              <span className="float-right font-semibold">{rand(paymentTotal(p1)!)}</span>
              <span className="block text-xs text-slate-600">{p1.note}</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            {radio("ppg_full", !ppgOn)}
            <span className="flex-1">
              <span className="font-medium">b. PPG Phase 1 and 2 - full course (discount applies)</span>
              <span className="mt-1 block text-xs text-slate-600">
                {full.lines.map((l) => (
                  <span key={l.label} className="flex justify-between">
                    <span>{l.label}</span>
                    <span>{rand(l.amount)}</span>
                  </span>
                ))}
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* 3. Other */}
      <label className="flex items-start gap-2 rounded-md border border-green-200 bg-white p-3">
        {radio("other")}
        <span className="font-semibold">3. {other.label}</span>
      </label>

      {/* Invoice */}
      {opt && (
        <div className="rounded-md border border-green-300 bg-white p-3">
          <p className="font-semibold text-green-900">Your invoice</p>
          {opt.lines.length ? (
            <table className="mt-1 w-full text-sm">
              <tbody>
                {opt.lines.map((l) => (
                  <tr key={l.label}>
                    <td className="py-0.5">{l.label}</td>
                    <td className="py-0.5 text-right">{rand(l.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-300 font-bold">
                  <td className="pt-1">Total to pay</td>
                  <td className="pt-1 text-right">{rand(total!)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="mt-1 text-xs text-slate-600">Apex will send you a quote for your course.</p>
          )}
          {opt.note && <p className="mt-1 text-xs text-slate-600">{opt.note}</p>}
        </div>
      )}

      {/* Invoice to */}
      <fieldset className="space-y-2">
        <legend className="font-semibold">Invoice to</legend>
        <div className="flex gap-6">
          <label className="flex items-center gap-2">
            <input type="radio" name="invoiceTo" value="self" checked={invoiceTo === "self"} onChange={() => setInvoiceTo("self")} /> Myself
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="invoiceTo" value="company" checked={invoiceTo === "company"} onChange={() => setInvoiceTo("company")} /> My company
          </label>
        </div>
        {invoiceTo === "company" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-700">
              Company name <span className="text-red-600">*</span>
              <input name="invoiceCompanyName" required className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              VAT number (if registered)
              <input name="invoiceCompanyVat" className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="block text-xs font-medium text-slate-700 sm:col-span-2">
              Company billing address
              <textarea name="invoiceCompanyAddress" rows={2} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
            </label>
          </div>
        )}
      </fieldset>

      {/* Bank details */}
      <div className="rounded-md border border-green-300 bg-white p-3">
        <p className="font-semibold text-green-900">Bank details</p>
        <p className="mt-1 font-semibold">{BANK_DETAILS.accountName}</p>
        <p>
          {BANK_DETAILS.bank} Acc No: <strong>{BANK_DETAILS.accountNo}</strong> Branch Code:{" "}
          <strong>{BANK_DETAILS.branchCode}</strong>
        </p>
        <p>
          Ref: your invoice number, or your name{fullName.trim() ? <> (<strong>{fullName.trim()}</strong>)</> : null}
        </p>
      </div>

      {/* POP */}
      <label className="block font-semibold">
        Upload your proof of payment <span className="text-red-600">*</span>
        <span className="block text-xs font-normal text-slate-600">PDF or photo of the payment. It is kept on your profile.</span>
        <input
          name="popFile"
          type="file"
          required
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          className="mt-1 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-green-100 file:px-3 file:py-1.5 file:text-sm"
        />
      </label>
    </div>
  );
}
