/** Batch 92 (Riaan, 9 Nov 2026): payment options shown at student sign-up,
 * with the invoice lines and the bank details. Shared by the sign-up page
 * (client), the server action, the profile pages and the accounts WhatsApp. */

export type PaymentOptionKey = "intro" | "ppg_p1" | "ppg_full" | "other";

export type PaymentOption = {
  key: PaymentOptionKey;
  label: string;
  lines: { label: string; amount: number }[];
  note?: string;
};

export const PHASE2_PRICE = 13900;

export const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    key: "intro",
    label: "PG/PPG Intro Training (Phase 1)",
    lines: [{ label: "PG/PPG Intro Training - Phase 1", amount: 9900 }],
  },
  {
    key: "ppg_p1",
    label: "Powered Paragliding (PPG) - Phase 1 (PG/PPG)",
    lines: [{ label: "PPG Phase 1 - PG/PPG", amount: 9900 }],
    note: `If you continue later with Phase 2, Phase 2 costs R${PHASE2_PRICE.toLocaleString("en-US")}.`,
  },
  {
    key: "ppg_full",
    label: "Powered Paragliding (PPG) - Phase 1 and 2, full course (discount applies)",
    lines: [
      { label: "Phase 1", amount: 9900 },
      { label: "Phase 2", amount: PHASE2_PRICE },
      { label: "Full course once-off payment discount", amount: -3900 },
    ],
  },
  {
    key: "other",
    label: "Other course (PG or PPT/PPC) - Apex will send me a quote",
    lines: [],
  },
];

export function paymentOption(key: string | null | undefined): PaymentOption | null {
  return PAYMENT_OPTIONS.find((o) => o.key === key) ?? null;
}

export function paymentTotal(o: PaymentOption): number | null {
  return o.lines.length ? o.lines.reduce((s, l) => s + l.amount, 0) : null;
}

/** "R9,900" / "-R3,900" */
export function rand(n: number): string {
  return `${n < 0 ? "-" : ""}R${Math.abs(n).toLocaleString("en-US")}`;
}

export const BANK_DETAILS = {
  accountName: "APEX ADVENTURES TRAINING AND SERVICES",
  bank: "Capitec Business",
  accountNo: "1055210865",
  branchCode: "450105",
};

/** One line, e.g. for WhatsApp and the profile. */
export function paymentSummary(key: string | null | undefined): string {
  const o = paymentOption(key);
  if (!o) return "Not chosen";
  const t = paymentTotal(o);
  return t === null ? o.label : `${o.label} - ${rand(t)}`;
}
