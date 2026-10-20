import { createHash } from "node:crypto";

/** Shared key for the internal scheduler -> /api/cron/* calls (batch 78).
 * Derived from SESSION_SECRET so there's no extra Railway variable to set.
 * No "server-only" import: the scheduler in instrumentation-node.ts loads
 * this outside the React Server Components graph. */
export function cronKey(name: string): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return createHash("sha256").update(`${secret}:cron:${name}`).digest("hex");
}
