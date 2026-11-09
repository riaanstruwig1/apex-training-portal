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

// Batch 94 (Riaan, 9 Nov 2026): Phase 2 on school equipment is R21,900
// (his sample quote QT-000032), so the full course is R27,900.
export const PHASE2_PRICE = 21900;

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
    label: "Powered Paragliding (PPG) - Full course on school equipment, Phase 1 and 2 (discount applies)",
    lines: [
      { label: "Phase 1", amount: 9900 },
      { label: "Phase 2 (school equipment)", amount: PHASE2_PRICE },
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

/** Batch 94: the wording from Apex's sample quote, shown in the (i) info
 * pop-ups on the sign-up payment options. */
export const QUOTE_INFO = {
  phase1: {
    title: "Phase 1 - Paramotor and Paragliding Intro training (R9,900)",
    points: [
      "Phase one: all ground training, including 10 winch flights",
      "GFC membership (6 months)",
      "Access to all theory classes and material, intro to engine training and sim training",
    ],
    notes: [
      "You need Phase 2 to complete the full course for the NPL licence.",
      "Excludes the SAHPA sign-up fee of R440 (done via the SAHPA sign-up portal).",
    ],
  },
  phase2: {
    title: "Phase 2 - Engine training on school equipment (R21,900, after Phase 1)",
    points: [
      "Ground engine training and flight training - minimum 35 flights",
      "Three theory classes, three exams and three exam corrections included",
      "All Phase 2 training on school equipment (any breakage or damage for your account)",
      "Must be a valid SAHPA and GFC member",
    ],
    notes: [
      "Phase 1 is required before Phase 2 engine training.",
      "Excludes the final SACAA licence fees, est. R2,000 on completion.",
      "Yearly renewal applies for the first year, thereafter every two years.",
    ],
  },
  discount: {
    title: "Full upfront payment discount (-R3,900)",
    points: [
      "Only applies if Phase 1 and Phase 2 are paid in full upfront - you save around 13%.",
      "If you pay Phase 1 first and Phase 2 later, the discount falls away.",
    ],
    notes: [],
  },
  general: [
    "Additional 10% discount for family members signing up with you.",
    "To ensure availability and booking, full payment (POP) must be sent before training.",
    "T&C as per www.apexadventures.co.za",
  ],
};
