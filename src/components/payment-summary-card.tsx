import { paymentOption, paymentTotal, rand } from "@/lib/payment-options";

/** Batch 92 (Riaan, 9 Nov 2026): the payment option, invoice and proof of
 * payment from sign-up, shown at the top of the student's profile (and on the
 * CFI/Admin profile page) so the POP can be viewed at any time. */
export default function PaymentSummaryCard({
  userId,
  profile,
  showUploadHint = false,
}: {
  userId: string;
  profile: {
    paymentOption: string | null;
    invoiceTo: string | null;
    invoiceCompanyName: string | null;
    invoiceCompanyVat: string | null;
    invoiceCompanyAddress: string | null;
    popFile: string | null;
    popUploadedAt: Date | null;
  } | null | undefined;
  showUploadHint?: boolean;
}) {
  if (!profile) return null;
  const opt = paymentOption(profile.paymentOption);
  if (!opt && !profile.popFile) return null;
  const total = opt ? paymentTotal(opt) : null;
  return (
    <section className="rounded-xl border-2 border-green-300 bg-green-50 p-4 text-sm text-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-green-900">Payment</h2>
          <p className="mt-1 font-medium">{opt ? opt.label : "No payment option chosen"}</p>
          {opt && opt.lines.length > 0 && (
            <table className="mt-1 text-xs">
              <tbody>
                {opt.lines.map((l) => (
                  <tr key={l.label}>
                    <td className="pr-6">{l.label}</td>
                    <td className="text-right">{rand(l.amount)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="pr-6 pt-0.5">Total</td>
                  <td className="pt-0.5 text-right">{rand(total!)}</td>
                </tr>
              </tbody>
            </table>
          )}
          <p className="mt-1 text-xs text-slate-600">
            Invoice to:{" "}
            {profile.invoiceTo === "company"
              ? `${profile.invoiceCompanyName ?? "company"}${profile.invoiceCompanyVat ? ` (VAT ${profile.invoiceCompanyVat})` : ""}${profile.invoiceCompanyAddress ? `, ${profile.invoiceCompanyAddress}` : ""}`
              : "the student personally"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-900">Proof of payment</p>
          {profile.popFile ? (
            <>
              <a
                href={`/api/uploads/${userId}/${profile.popFile}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                View proof of payment
              </a>
              {profile.popUploadedAt && (
                <p className="mt-1 text-xs text-slate-600">Uploaded {profile.popUploadedAt.toLocaleDateString()}</p>
              )}
            </>
          ) : (
            <p className="mt-1 text-xs font-semibold text-red-700">Not uploaded yet</p>
          )}
          {showUploadHint && <p className="mt-1 text-xs text-slate-500">Upload a new one at the bottom of this page.</p>}
        </div>
      </div>
    </section>
  );
}
