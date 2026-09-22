import "server-only";

/**
 * Outbound email, added 22 Sep 2026 for the decline-notification feature
 * (Notes item #8: notify a pilot when a CFI/Admin declines a rating).
 *
 * Uses Resend's HTTP API (plain fetch, no SDK needed) rather than SMTP.
 * The original build used Gmail's own SMTP relay to avoid a new signup, but
 * Railway blocks outbound SMTP entirely (confirmed 22 Sep 2026 by testing
 * both port 465 and 587 directly from the running container -- both time
 * out, on every host, not just Gmail's) -- a platform-level anti-abuse
 * policy, not something fixable in this app's code. Resend sends over
 * plain HTTPS (port 443), which Railway does allow.
 *
 * Sending to real pilot addresses needs Riaan's sending domain
 * (apexadventures.co.za) verified in Resend -- see .env.example /
 * README.md for the walkthrough. Until that's done, or if RESEND_API_KEY /
 * EMAIL_FROM aren't set at all, this fails soft (see below) rather than
 * blocking anything.
 *
 * Deliberately fails soft: this app has no mail queue or retry, and a
 * decline is a real action that must never be blocked or rolled back just
 * because email happens to be unset or unreachable at that moment. Every
 * call site awaits this but never lets its result change whether the
 * surrounding action succeeds -- see declineEndorsement in
 * lib/actions/verification.ts.
 */

export type SendEmailResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "send_failed"; detail?: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.warn(
      `[email] Not configured (RESEND_API_KEY/EMAIL_FROM) -- skipped "${opts.subject}" to ${opts.to}.`
    );
    return { sent: false, reason: "not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Apex Flight Hub <${from}>`,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] Failed to send "${opts.subject}" to ${opts.to}: ${res.status} ${detail}`);
      return { sent: false, reason: "send_failed", detail: `${res.status} ${detail}`.trim() };
    }

    return { sent: true };
  } catch (err) {
    console.error(`[email] Failed to send "${opts.subject}" to ${opts.to}:`, err);
    return { sent: false, reason: "send_failed", detail: err instanceof Error ? err.message : String(err) };
  }
}
