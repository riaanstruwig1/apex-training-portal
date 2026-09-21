// SAHPA Appendix R62.22 "Medical Fitness Certificate" support (Notes4 item
// mentioning "flight medical certificate" self-declare vs download-sign-
// upload). The real form (public/documents/sahpa-medical-fitness-r62-22.pdf,
// Revision 5, October 2023) has a self-signable "Pilot's Declaration of
// Medical Fitness" section, but requires a SEPARATE "Medical Practitioner's
// Declaration" (signed by a GP) for anyone 60 or over, or with a flagged
// medical condition -- that half can't be satisfied online, so the online
// self-declare option is only ever offered when we can confirm the pilot is
// under 60. An unknown DOB is treated the same as 60+ (safe default: never
// silently allow an online declaration we can't actually verify is
// permitted).

export function ageFromDob(dob: Date | null | undefined, asOf: Date = new Date()): number | null {
  if (!dob) return null;
  let age = asOf.getFullYear() - dob.getFullYear();
  const monthDiff = asOf.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export type MedicalDeclarationEligibility =
  | { eligible: true }
  | { eligible: false; reason: "over_60" | "unknown_dob" };

export function medicalDeclarationEligibility(
  dob: Date | null | undefined
): MedicalDeclarationEligibility {
  const age = ageFromDob(dob);
  if (age === null) return { eligible: false, reason: "unknown_dob" };
  if (age >= 60) return { eligible: false, reason: "over_60" };
  return { eligible: true };
}

// The Pilot's Declaration of Medical Fitness, quoted verbatim from the real
// form so the online self-declare flow attests to exactly the same text the
// paper form does -- never paraphrased.
export const MEDICAL_DECLARATION_INTRO =
  "I hereby declare that I have never suffered, nor suffer currently, from any of the following, which I understand may create, or lead to, a dangerous situation in flight.";

export const MEDICAL_DECLARATION_BULLETS_1 = [
  "Epilepsy, Fits, Severe Head Injury;",
  "Recurrent fainting, Giddiness or Blackouts. Unusually High Blood Pressure;",
  "A Coronary;",
  "Any defect or disability (including excessive eyesight deficiency) that may jeopardize flight safety;",
  "Any previously sustained injury that could affect my ability to control the aircraft.",
];

export const MEDICAL_DECLARATION_FURTHER =
  "I further declare that -";

export const MEDICAL_DECLARATION_BULLETS_2 = [
  "I am not addicted to any drug or narcotic substance (including alcohol) that may affect my faculties in any manner that may jeopardize flight safety;",
  "I do not suffer from any defect or disability (including excessive eyesight deficiency) that could affect my flying safety;",
  "Any previously sustained injury that could affect my ability to control the aircraft.",
  "In the event of my contracting, or suspecting, any of the above conditions in the future, I will not exercise the privileges of my pilot licence until I have been examined by a suitably qualified medical practitioner and be declared physically fit to fly hang gliders or paragliders, including powered hang gliders or paragliders.",
];
