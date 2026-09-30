/**
 * Shared (client + server) helpers for WhatsApp invites -- the default
 * message, name fill-in and phone-number normalising. No secrets here; the
 * actual sending lives in lib/whatsapp.ts (server-only).
 */

export const DEFAULT_INVITE_TEMPLATE =
  "Hi {name}, Team Apex invites you to join our Apex Flight Hub. The hub will help you keep " +
  "track of your flight logs and, more importantly, your expiries, endorsement upgrades and " +
  "renewals. You're welcome to sign up via this link: " +
  "https://apex-portal-production.up.railway.app/signup\n\n" +
  "Regards,\nRiaan, Team Apex";

export function fillInviteTemplate(name: string, template = DEFAULT_INVITE_TEMPLATE): string {
  const first = name.trim().split(/\s+/)[0] || name.trim();
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
