"use client";

import { useState } from "react";
import {
  BANK_DETAILS,
  PAYMENT_OPTIONS,
  QUOTE_INFO,
  paymentOption,
  paymentTotal,
  rand,
  type PaymentOptionKey,
} from "@/lib/payment-options";

type InfoBlock = { title: string; points: string[]; notes: string[] };

/** Batch 94 (Riaan, 9 Nov 2026): (i) button with the wording from Apex's
 * sample quote -- opens on hover, or on tap/click (phones). */
function InfoTip({ label, blocks }: { label: string; blocks: InfoBlock[] }) {
  // Hover shows it; a click/tap pins it open (and a second click unpins).
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;
  return (
    <span className="inline-block align-middle" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((v) => !v);
        }}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-green-600 bg-white text-xs font-bold italic text-green-700 hover:bg-green-600 hover:text-white"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute inset-x-2 top-10 z-20 block rounded-lg border border-green-300 bg-white p-3 text-left text-xs font-normal leading-relaxed text-slate-700 shadow-lg"
        >
          {blocks.map((b) => (
            <span key={b.title} className="mb-2 block last:mb-0">
              <span className="block font-semibold text-green-900">{b.title}</span>
              {b.points.map((pt) => (
                <span key={pt} className="block pl-3 -indent-3">&bull; {pt}</span>
              ))}
              {b.notes.map((n) => (
                <span key={n} className="block italic text-slate-600">{n}</span>
              ))}
            </span>
          ))}
          <span className="block border-t border-slate-100 pt-1 text-slate-500">
            {QUOTE_INFO.general.map((g) => (
              <span key={g} className="block">{g}</span>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}

/** Batch 92 (Riaan, 9 Nov 2026): green "Payment options" block just before
 * the student submits -- choose an option (invoice shown), who the invoice
 * goes to, bank details, and the proof of payment upload (required). */
export default function PaymentBlock({
  introCourse,
  trainingTypes,
  fullName,
}: {
  introCourse: boolean;
  trainingTypes: string[];
  fullName: string;
}) {
  // Batch 93 (Riaan, 9 Nov 2026): three round options 1 / 2 / 3. The default
  // follows what he ticked at the top (Intro -> 1, PPG -> 2, PG or PPT/PPC
  // only -> 3) until he clicks another option himself.
  const defaultMain: "1" | "2" | "3" | null = introCourse
    ? "1"
    : trainingTypes.includes("ppg")
      ? "2"
      : trainingTypes.length > 0
        ? "3"
        : null;
  const [pickedMain, setPickedMain] = useState<"1" | "2" | "3" | null>(null);
  const main = pickedMain ?? defaultMain;
  const [ppgPlan, setPpgPlan] = useState<"ppg_p1" | "ppg_full">("ppg_p1");
  const choice: PaymentOptionKey | null = main === "1" ? "intro" : main === "2" ? ppgPlan : main === "3" ? "other" : null;
  const [invoiceTo, setInvoiceTo] = useState<"self" | "company">("self");
  const [discuss, setDiscuss] = useState(false);
  const opt = paymentOption(choice);
  const total = opt ? paymentTotal(opt) : null;

  const intro = PAYMENT_OPTIONS[0];
  const p1 = PAYMENT_OPTIONS[1];
  const full = PAYMENT_OPTIONS[2];
  const other = PAYMENT_OPTIONS[3];
  const box = (on: boolean) =>
    `relative flex items-start gap-2 rounded-md border p-3 ${on ? "border-green-500 bg-white ring-1 ring-green-500" : "border-green-200 bg-white"}`;

  return (
    <div className="space-y-4 rounded-lg border-2 border-green-400 bg-green-50 p-4 text-sm text-slate-800">
      <p className="text-base font-semibold text-green-900">Payment options</p>
      {/* What the server reads */}
      <input type="hidden" name="paymentOption" value={choice ?? ""} />

      {/* 1. Intro */}
      <label className={`cursor-pointer ${box(main === "1")}`}>
        <input type="radio" name="paymentMain" value="1" checked={main === "1"} onChange={() => setPickedMain("1")} className="mt-1" />
        <span className="flex-1">
          <span className="font-semibold">1. {intro.label}</span>
          <InfoTip label="What Phase 1 includes" blocks={[QUOTE_INFO.phase1]} />
          <span className="float-right font-semibold">{rand(paymentTotal(intro)!)}</span>
        </span>
      </label>

      {/* 2. PPG */}
      <div className={box(main === "2")}>
        <input
          id="paymentMain2"
          type="radio"
          name="paymentMain"
          value="2"
          checked={main === "2"}
          onChange={() => setPickedMain("2")}
          className="mt-1"
        />
        <div className="flex-1">
          <label htmlFor="paymentMain2" className="cursor-pointer font-semibold">
            2. Powered Paragliding (PPG) - Full course on school equipment
          </label>
          <InfoTip
            label="What the PPG full course includes"
            blocks={[QUOTE_INFO.phase1, QUOTE_INFO.phase2, QUOTE_INFO.discount]}
          />
          <div className={`mt-2 space-y-2 ${main === "2" ? "" : "opacity-50"}`}>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="ppgPlan"
                value="ppg_p1"
                checked={ppgPlan === "ppg_p1"}
                onClick={() => setPickedMain("2")}
                onChange={() => {
                  setPpgPlan("ppg_p1");
                  setPickedMain("2");
                }}
                className="mt-1"
              />
              <span className="flex-1">
                <span className="font-medium">a. PPG Phase 1 - PG/PPG</span>
                <span className="float-right font-semibold">{rand(paymentTotal(p1)!)}</span>
                <span className="block text-xs text-slate-600">{p1.note}</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="ppgPlan"
                value="ppg_full"
                checked={ppgPlan === "ppg_full"}
                onClick={() => setPickedMain("2")}
                onChange={() => {
                  setPpgPlan("ppg_full");
                  setPickedMain("2");
                }}
                className="mt-1"
              />
              <span className="flex-1">
                <span className="font-medium">b. PPG Phase 1 and 2 - full course on school equipment (discount applies)</span>
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
      </div>

      {/* 3. Other */}
      <label className={`cursor-pointer ${box(main === "3")}`}>
        <input type="radio" name="paymentMain" value="3" checked={main === "3"} onChange={() => setPickedMain("3")} className="mt-1" />
        <span className="font-semibold">3. {other.label}</span>
      </label>

      {!choice && <p className="text-xs font-semibold text-amber-800">Choose option 1, 2 or 3.</p>}

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
        Upload your proof of payment {discuss ? <span className="font-normal text-slate-500">(optional)</span> : <span className="text-red-600">*</span>}
        <span className="block text-xs font-normal text-slate-600">PDF or photo of the payment. It is kept on your profile.</span>
        <input
          name="popFile"
          type="file"
          required={!discuss}
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          className="mt-1 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-green-100 file:px-3 file:py-1.5 file:text-sm"
        />
      </label>
      {/* Batch 95: submit without a POP, Apex contacts him about payment. */}
      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3">
        <input
          type="checkbox"
          name="paymentDiscussFirst"
          value="1"
          checked={discuss}
          onChange={(e) => setDiscuss(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="font-semibold">I&apos;d like to discuss payment first - please contact me</span>
          <span className="block text-xs text-slate-600">
            You can submit without a proof of payment. Apex will contact you; upload the POP later on your profile.
          </span>
        </span>
      </label>
    </div>
  );
}
