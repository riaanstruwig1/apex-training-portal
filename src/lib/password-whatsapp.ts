import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { studentProfiles, users } from "@/db/schema";
import { HUB_URL, normalizePhone } from "@/lib/invite-message";
import { isWhatsAppConfigured, sendWhatsAppText } from "@/lib/whatsapp";

export type PasswordWhatsApp = "sent" | "failed" | "no_phone" | "not_configured";

/** 10 random letters/digits -- easy to read and type, long enough not to guess. */
export function makeTempPassword(): string {
  let p = "";
  while (p.length < 10) p += randomBytes(8).toString("base64").replace(/[^A-Za-z0-9]/g, "");
  return p.slice(0, 10);
}

/** The person's cell number on file (users.phone, else the student profile's). */
export async function phoneOf(userId: string): Promise<string | null> {
  const [u] = await db.select({ phone: users.phone }).from(users).where(eq(users.id, userId)).limit(1);
  let n = normalizePhone(u?.phone);
  if (!n) {
    const [sp] = await db.select({ phone: studentProfiles.phone }).from(studentProfiles).where(eq(studentProfiles.userId, userId)).limit(1);
    n = normalizePhone(sp?.phone);
  }
  return n;
}

/**
 * Batch 98 (Riaan, 24 Nov 2026): "If a person requests a password reset, send
 * him a WhatsApp with the new password" and "as CFI let me reset a pilot's
 * password and send him the WhatsApp with the new password".
 * Sets a new temporary password and WhatsApps it to the cell number on file.
 * Only changes the password when the number is there and WhatsApp is set up
 * (unless `always` -- the CFI pressing Reset gets a new password regardless).
 */
export async function resetPasswordByWhatsApp(
  userId: string,
  opts: { always?: boolean } = {}
): Promise<{ whatsapp: PasswordWhatsApp; tempPassword: string | null }> {
  const [u] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return { whatsapp: "failed", tempPassword: null };
  const phone = await phoneOf(userId);
  const canSend = !!phone && isWhatsAppConfigured();
  if (!canSend && !opts.always) return { whatsapp: !phone ? "no_phone" : "not_configured", tempPassword: null };

  const tempPassword = makeTempPassword();
  await db
    .update(users)
    .set({ passwordHash: await bcrypt.hash(tempPassword, 12), passwordResetToken: null, passwordResetTokenExpiresAt: null })
    .where(eq(users.id, userId));
  if (!phone) return { whatsapp: "no_phone", tempPassword };
  if (!isWhatsAppConfigured()) return { whatsapp: "not_configured", tempPassword };

  const first = u.name.trim().split(/\s+/)[0] || "there";
  const r = await sendWhatsAppText(
    phone,
    `Hi ${first}, your Apex Flight Hub password has been reset.\n\n` +
      `Email: ${u.email}\nNew password: ${tempPassword}\n\n` +
      `Log in here: ${HUB_URL}/login\nThen change it under Edit profile - Change password.\n\n` +
      "If you didn't ask for this, contact Apex.\n- Team Apex"
  );
  if (!r.ok) console.error("[password WhatsApp]", r.error);
  return { whatsapp: r.ok ? "sent" : "failed", tempPassword };
}
