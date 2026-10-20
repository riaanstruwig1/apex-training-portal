/** Runs once when the Hub server starts (Next.js instrumentation hook).
 * Starts the small in-process scheduler for daily jobs -- currently the
 * 08:00 birthday WhatsApp (batch 78). Node.js runtime only. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
