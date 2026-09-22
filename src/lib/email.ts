import "server-only";
import nodemailer from "nodemailer";
import dns from "node:dns/promises";
import net from "node:net";

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

/**
 * Resolves `host` to a literal IPv4 address, or null if that's not possible
 * (already an IP, no A record, DNS error, etc) -- callers fall back to the
 * original hostname in that case.
 *
 * Why: Railway's containers (confirmed 22 Sep 2026, via their own deploy
 * logs) have an IPv6 address configured on the interface but no real route
 * out over it. nodemailer resolves both the A and AAAA records for the SMTP
 * host and connects to a RANDOM one of them -- there's no "IPv4 only"
 * option to set. So roughly half the time it picked the unreachable IPv6
 * address for smtp.gmail.com and every send failed with ENETUNREACH.
 * Resolving to a literal IPv4 address ourselves and handing nodemailer that
 * removes IPv6 from the picture entirely.
 */
async function resolveIPv4(host: string): Promise<string | null> {
  if (net.isIP(host)) return null; // already a literal IP, nothing to do
  try {
    const addresses = await dns.resolve4(host);
    return addresses[0] ?? null;
  } catch {
    return null;
  }
}

async function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;

  const ipv4 = await resolveIPv4(host);

  return nodemailer.createTransport({
    host: ipv4 ?? host,
    // `servername` pins TLS/SNI to the real hostname so Gmail's certificate
    // still validates when we're connecting to it by IP above.
    ...(ipv4 ? { servername: host } : {}),
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
  const transport = await getTransport();
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
