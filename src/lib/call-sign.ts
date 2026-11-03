/** Batch 90 (Riaan, 3 Nov 2026): radio call sign choices, e.g. "PPG-ABC" or
 * "PPT-ACB" -- a prefix and three letters/numbers. Shared by the student
 * exam page (client) and the server actions. */
export const CALL_SIGN_PREFIXES = ["PPG", "PPT", "PPC"] as const;
export type CallSignPrefix = (typeof CALL_SIGN_PREFIXES)[number];

export const CALL_SIGN_PATTERN = /^(PPG|PPT|PPC)-[A-Z0-9]{3}$/;

/** Upper-cases and tidies "ppg abc" / "PPG-abc" / "PPGABC" into "PPG-ABC". */
export function normalizeCallSign(raw: string | null | undefined): string {
  const s = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = s.match(/^(PPG|PPT|PPC)([A-Z0-9]{0,3})/);
  if (!m) return String(raw ?? "").trim().toUpperCase();
  return m[2] ? `${m[1]}-${m[2]}` : m[1];
}

export function isValidCallSign(cs: string): boolean {
  return CALL_SIGN_PATTERN.test(cs);
}

/** Stored as "a|b|c"; always returns three strings (empty when missing). */
export function parseCallSignChoices(stored: string | null | undefined): [string, string, string] {
  const parts = String(stored ?? "").split("|");
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
}

/** Error text, or null when all three are valid and different. */
export function checkCallSignChoices(choices: string[]): string | null {
  if (choices.length !== 3 || choices.some((c) => !c)) {
    return "Give all three call sign choices (e.g. PPG-ABC) before submitting.";
  }
  const bad = choices.find((c) => !isValidCallSign(c));
  if (bad) return `"${bad}" isn't a valid call sign -- use PPG, PPT or PPC, a dash and three letters or numbers, e.g. PPG-ABC.`;
  if (new Set(choices).size !== 3) return "Your three call sign choices must all be different.";
  return null;
}

/** Default prefix from the student's training type(s): PPT/PPC first, then PPG. */
export function defaultCallSignPrefix(trainingType: string | null | undefined): CallSignPrefix {
  const t = String(trainingType ?? "").toLowerCase();
  if (t.includes("ppt")) return "PPT";
  return "PPG";
}
