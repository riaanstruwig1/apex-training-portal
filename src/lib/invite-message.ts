/**
 * Shared (client + server) helpers for WhatsApp invites -- the default
 * message, name fill-in and phone-number normalising. No secrets here; the
 * actual sending lives in lib/whatsapp.ts (server-only).
 */

export const HUB_URL = "https://apex-portal-production.up.railway.app";

export type InviteAudience = "pilot" | "student";

/** Default WhatsApp invite text per list -- Riaan's own wording (30 Sep
 * 2026), spelling tidied and pointed at /signup. "{name}" becomes the
 * person's first name. Editable per invite before sending. */
export const INVITE_TEMPLATES: Record<InviteAudience, string> = {
  pilot:
    "Hi {name}, Team Apex invites you to join our Apex Flight Hub. The hub will help you keep " +
    "track of your flight logs and, more importantly, your expiries, endorsement upgrades and " +
    `renewals. You're welcome to sign up via this link: ${HUB_URL}/signup\n\n` +
    "Regards,\nRiaan, Team Apex",
  student:
    "Hi {name}, please sign up as a student with Team Apex using this link: " +
    `${HUB_URL}/signup\n\n` +
    "Please provide all your details and upload the necessary documents so we can verify and " +
    "approve your application. The Hub gives you access to all your exams, training documents " +
    "and more. As soon as you're verified, you'll receive a WhatsApp to confirm.\n\n" +
    "Regards,\nRiaan, Team Apex",
};

/** Kept for callers from batch 46. */
export const DEFAULT_INVITE_TEMPLATE = INVITE_TEMPLATES.pilot;

/** Sent automatically when a CFI/Admin approves a pending sign-up. */
export const APPROVAL_TEMPLATES: Record<InviteAudience, string> = {
  student:
    "Hi {name}, good news! Your Apex Flight Hub student application has been verified and " +
    `approved. You can now log in here: ${HUB_URL}/login\n\n` +
    "Regards,\nRiaan, Team Apex",
  pilot:
    "Hi {name}, good news! Your Apex Flight Hub pilot application has been verified and " +
    `approved. You can now log in here: ${HUB_URL}/login\n\n` +
    "Regards,\nRiaan, Team Apex",
};

export function fillInviteTemplate(name: string, template = DEFAULT_INVITE_TEMPLATE): string {
  // Empty name (form just opened/cleared) reads "Hi there," rather than "Hi ,".
  const first = name.trim().split(/\s+/)[0] || "there";
  return template.replaceAll("{name}", first);
}

/**
 * Normalises a phone number to international digits with no "+", e.g.
 * "082 123 4567" -> "27821234567", "+27 82 123 4567" -> "27821234567",
 * "0027821234567" -> "27821234567". A local number starting with 0 is
 * assumed South African. Returns null if it doesn't look like a real number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "27" + digits.slice(1);
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

/** "27821234567" -> "+27 82 123 4567" for display (non-SA numbers just get a "+"). */
export function formatPhone(normalized: string): string {
  if (normalized.startsWith("27") && normalized.length === 11) {
    const n = normalized.slice(2);
    return `+27 ${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
  }
  return `+${normalized}`;
}
