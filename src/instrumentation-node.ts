import { cronKey } from "@/lib/cron-key";

/**
 * In-process scheduler (batch 78). Every 5 minutes it pings the Hub's own
 * /api/cron/birthdays route; that route decides whether it's 08:00 SA time
 * yet and makes sure the birthday WhatsApp only goes out once a day. Going
 * through the route (instead of calling lib/birthdays directly) keeps the
 * database + WhatsApp code inside Next's normal server bundle.
 *
 * Only runs in production (`next start` on Railway) -- not in `next dev`
 * or during `next build`. Set DISABLE_CRON=1 in Railway to switch it off.
 */
const INTERVAL_MS = 5 * 60 * 1000;

declare global {
  var __apexCronStarted: boolean | undefined;
}

async function tick() {
  const key = cronKey("birthdays");
  if (!key) return;
  const port = process.env.PORT || "3000";
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/cron/birthdays`, {
      method: "POST",
      headers: { "x-cron-key": key },
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) console.error(`[cron] birthdays returned ${res.status}`);
  } catch (err) {
    console.error("[cron] birthdays call failed:", err instanceof Error ? err.message : err);
  }
}

if (
  process.env.NODE_ENV === "production" &&
  process.env.DISABLE_CRON !== "1" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  !globalThis.__apexCronStarted
) {
  globalThis.__apexCronStarted = true;
  // First check shortly after start-up (server needs to be listening), then every 5 min.
  setTimeout(() => {
    void tick();
    setInterval(() => void tick(), INTERVAL_MS).unref();
  }, 30_000).unref();
  console.log("[cron] scheduler started (birthday WhatsApp at 08:00 SA time)");
}
