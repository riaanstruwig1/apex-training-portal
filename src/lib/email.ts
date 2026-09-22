import "server-only";
import nodemailer from "nodemailer";

/**
 * Outbound email, added 22 Sep 2026 for the decline-notification feature
 * (Notes item #8: notify a pilot when a CFI/Admin declines a rating).
 *
 * Uses plain SMTP via nodemailer rather than a transactional-email provider
 * (Resend, SendGrid, ...) -- Riaan already has a Gmail account for the
 * school, and Gmail's own SMTP relay (with an App Password, not the real
 * account password) needs no new signup, no domain verification, and no
 * extra cost, unlike a new provider account. 500 messages/day is Gmail's
 * relay cap, far beyond what a single small school needs for decline
 * notices. Any standard SMTP provider works the same way if that ever
 * needs to change -- only the env vars below need to point elsewhere.
 *
 * Deliberately fails soft: this app has no mail queue or retry, and a
 * decline is a real action that must never be blocked or rolled back just
 * because email happens to be unset or unreachable at that moment (e.g.
 * before Riaan has added the SMTP env vars on Railway, or Gmail is briefly
 * down). Every call site awaits this but never lets its result change
 * whether the surrounding action succeeds -- see declineEndorsement in
 * lib/actions/verification.ts.
 */

export type SendEmailResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "send_failed"; detail?: string };

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(port),
    // 465 = implicit TLS (Gmail's usual port); anything else assumes STARTTLS.
    secure: Number(port) === 465,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendEmailResult> {
  const transport = getTransport();
  if (!transport) {
    console.warn(
      `[email] Not configured (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS) -- skipped "${opts.subject}" to ${opts.to}.`
    );
    return { sent: false, reason: "not_configured" };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;

  try {
    await transport.sendMail({
      from: `"Apex Flight Hub" <${from}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return { sent: true };
  } catch (err) {
    console.error(`[email] Failed to send "${opts.subject}" to ${opts.to}:`, err);
    return { sent: false, reason: "send_failed", detail: err instanceof Error ? err.message : String(err) };
  }
}
