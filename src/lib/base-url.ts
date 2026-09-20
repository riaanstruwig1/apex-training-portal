import "server-only";

/**
 * The site's own public base URL, for building absolute links (invite
 * emails/links, etc.) from inside a Server Action -- there's no incoming
 * request to read a Host header from there.
 *
 * Bug fixed 20 Sep 2026: this used to fall back straight to
 * "http://localhost:3000" whenever NEXT_PUBLIC_APP_URL wasn't set, which it
 * never was on Railway -- every instructor- and student-invite link
 * generated in production silently pointed at localhost and couldn't work
 * for the person who received it. Railway auto-injects RAILWAY_PUBLIC_DOMAIN
 * (e.g. "apex-portal-production.up.railway.app") on every service, so that's
 * now the middle fallback -- NEXT_PUBLIC_APP_URL still wins if it's ever set
 * (e.g. once a custom domain is attached), and localhost is the last resort
 * for local dev only.
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  return "http://localhost:3000";
}
