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

// ---------------------------------------------------------------------------
// Batch 82 (26 Oct 2026): sending to a group chat (Team Apex birthday wishes),
// sending a file (Forms & procedures -> Send), and listing the groups the
// Hub's WhatsApp number belongs to (to pick the Team Apex group in Settings).
// ---------------------------------------------------------------------------

function greenBase(): { base: string; media: string; id: string; token: string } | null {
  const id = process.env.GREEN_API_ID_INSTANCE;
  const token = process.env.GREEN_API_TOKEN_INSTANCE;
  if (!id || !token) return null;
  const base = (process.env.GREEN_API_URL || "https://api.green-api.com").replace(/\/+$/, "");
  // Files go to the instance's media host: https://7105.api.greenapi.com ->
  // https://7105.media.greenapi.com (GREEN_API_MEDIA_URL overrides).
  const media = (
    process.env.GREEN_API_MEDIA_URL ||
    (base.includes(".api.") ? base.replace(".api.", ".media.") : "https://media.green-api.com")
  ).replace(/\/+$/, "");
  return { base, media, id, token };
}

const NOT_SET_UP =
  "WhatsApp isn't set up yet -- add GREEN_API_ID_INSTANCE and GREEN_API_TOKEN_INSTANCE in Railway -> Variables.";

/** Text to any chat id: "2782...@c.us" (person) or "...@g.us" (group). */
export async function sendWhatsAppToChat(chatId: string, message: string): Promise<SendResult> {
  const g = greenBase();
  if (!g) return { ok: false, error: NOT_SET_UP };
  try {
    const res = await fetch(`${g.base}/waInstance${g.id}/sendMessage/${g.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `WhatsApp send failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}` };
    }
    const data = (await res.json().catch(() => null)) as { idMessage?: string } | null;
    return data?.idMessage ? { ok: true } : { ok: false, error: "WhatsApp send failed: no message ID came back from Green-API." };
  } catch (err) {
    return { ok: false, error: `WhatsApp send failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Sends a file (as an attachment) with a caption to a person's number. */
export async function sendWhatsAppFile(
  phone: string,
  file: { bytes: Buffer; fileName: string; mime?: string },
  caption: string
): Promise<SendResult> {
  const g = greenBase();
  if (!g) return { ok: false, error: NOT_SET_UP };
  try {
    const form = new FormData();
    form.append("chatId", `${phone}@c.us`);
    form.append("fileName", file.fileName);
    form.append("caption", caption.slice(0, 1024));
    form.append("file", new Blob([new Uint8Array(file.bytes)], { type: file.mime || "application/octet-stream" }), file.fileName);
    const res = await fetch(`${g.media}/waInstance${g.id}/sendFileByUpload/${g.token}`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `WhatsApp send failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}` };
    }
    const data = (await res.json().catch(() => null)) as { idMessage?: string } | null;
    return data?.idMessage ? { ok: true } : { ok: false, error: "WhatsApp send failed: no message ID came back from Green-API." };
  } catch (err) {
    return { ok: false, error: `WhatsApp send failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export type WhatsAppGroup = { id: string; name: string };

/** Groups the Hub's WhatsApp number is in (Green-API getContacts?group=true). */
export async function listWhatsAppGroups(): Promise<{ ok: true; groups: WhatsAppGroup[] } | { ok: false; error: string }> {
  const g = greenBase();
  if (!g) return { ok: false, error: NOT_SET_UP };
  try {
    const res = await fetch(`${g.base}/waInstance${g.id}/getContacts/${g.token}?group=true`, {
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { ok: false, error: `Couldn't load WhatsApp groups (${res.status}).` };
    const data = (await res.json().catch(() => [])) as { id?: string; name?: string; contactName?: string; type?: string }[];
    const groups = (Array.isArray(data) ? data : [])
      .filter((c) => c.id && (c.type === "group" || c.id.endsWith("@g.us")))
      .map((c) => ({ id: c.id as string, name: c.name || c.contactName || c.id! }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, groups };
  } catch (err) {
    return { ok: false, error: `Couldn't load WhatsApp groups: ${err instanceof Error ? err.message : String(err)}` };
  }
}
