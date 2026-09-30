import "server-only";

/**
 * WhatsApp sending via Riaan's Green-API account (30 Sep 2026).
 *
 * Credentials live ONLY in Railway -> Variables, never in code:
 *   GREEN_API_ID_INSTANCE     e.g. 7103123456
 *   GREEN_API_TOKEN_INSTANCE  the long apiTokenInstance string
 *   GREEN_API_URL             optional -- the "apiUrl" shown for the instance
 *                             in the Green-API console (e.g.
 *                             https://7103.api.greenapi.com). Falls back to
 *                             https://api.green-api.com if not set.
 */

export function isWhatsAppConfigured(): boolean {
  return !!(process.env.GREEN_API_ID_INSTANCE && process.env.GREEN_API_TOKEN_INSTANCE);
}

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendWhatsAppText(phone: string, message: string): Promise<SendResult> {
  const idInstance = process.env.GREEN_API_ID_INSTANCE;
  const token = process.env.GREEN_API_TOKEN_INSTANCE;
  if (!idInstance || !token) {
    return {
      ok: false,
      error:
        "WhatsApp isn't set up yet -- add GREEN_API_ID_INSTANCE and GREEN_API_TOKEN_INSTANCE in Railway -> Variables.",
    };
  }
  const base = (process.env.GREEN_API_URL || "https://api.green-api.com").replace(/\/+$/, "");
  const url = `${base}/waInstance${idInstance}/sendMessage/${token}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: `${phone}@c.us`, message }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // Never echo the URL -- it contains the token.
      return {
        ok: false,
        error: `WhatsApp send failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
      };
    }
    const data = (await res.json().catch(() => null)) as { idMessage?: string } | null;
    if (!data?.idMessage) {
      return { ok: false, error: "WhatsApp send failed: no message ID came back from Green-API." };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `WhatsApp send failed: ${msg}` };
  }
}
