"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { whatsappInvites } from "@/db/schema";
import { requireAdminOrCFI } from "@/lib/auth/dal";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { getMemberPhones } from "@/lib/invites";
import { normalizePhone, formatPhone, type InviteAudience } from "@/lib/invite-message";

export type InviteState =
  | { error: string; success?: never }
  | { success: string; error?: never }
  | undefined;

/** CFI/Admin: send a new WhatsApp invite from the Pilots page. */
export async function sendWhatsAppInvite(
  _prev: InviteState,
  formData: FormData
): Promise<InviteState> {
  const staff = await requireAdminOrCFI();

  const audienceRaw = String(formData.get("audience") ?? "pilot");
  const audience: InviteAudience = audienceRaw === "student" ? "student" : "pilot";
  const name = String(formData.get("name") ?? "").trim();
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const message = String(formData.get("message") ?? "").trim();

  if (!name) return { error: "Enter the person's name." };
  if (!phone) return { error: "Enter a valid cell number, e.g. 082 123 4567 or +27 82 123 4567." };
  if (!message) return { error: "The message can't be empty." };
  if (message.length > 4000) return { error: "That message is too long for WhatsApp." };

  const memberPhones = await getMemberPhones();
  const existingMember = memberPhones.get(phone);
  if (existingMember) {
    return { error: `${formatPhone(phone)} already belongs to ${existingMember} in the Hub.` };
  }

  const [pending] = await db
    .select()
    .from(whatsappInvites)
    .where(and(eq(whatsappInvites.phone, phone), isNull(whatsappInvites.removedAt)))
    .limit(1);
  if (pending) {
    const where =
      pending.audience === audience
        ? "use Re-invite in the list below"
        : `they're on the ${pending.audience === "student" ? "Students" : "Pilots"} page's Invites list`;
    return {
      error: `${pending.name} was already invited on ${pending.createdAt.toLocaleDateString("en-ZA")} -- ${where}.`,
    };
  }

  const result = await sendWhatsAppText(phone, message);
  // A config problem (no Green-API credentials yet) isn't worth logging as
  // an invite -- nothing was attempted. Anything else is saved, so a failed
  // send shows in the list with its reason and can be retried via Re-invite.
  if (!result.ok && result.error.startsWith("WhatsApp isn't set up")) {
    return { error: result.error };
  }

  await db.insert(whatsappInvites).values({
    audience,
    name,
    phone,
    message,
    invitedByUserId: staff.id,
    lastSentAt: new Date(),
    sendCount: 1,
    lastStatus: result.ok ? "sent" : "failed",
    lastError: result.ok ? null : result.error,
  });

  revalidatePath("/admin/pilots");
  revalidatePath("/admin/students");
  revalidatePath("/instructor");
  if (!result.ok) return { error: `Saved, but not delivered. ${result.error}` };
  return { success: `Invite sent to ${name} (${formatPhone(phone)}).` };
}

/** CFI/Admin: resend the same message to an existing invite. */
export async function resendWhatsAppInvite(inviteId: string): Promise<InviteState> {
  await requireAdminOrCFI();

  const [invite] = await db
    .select()
    .from(whatsappInvites)
    .where(eq(whatsappInvites.id, inviteId))
    .limit(1);
  if (!invite || invite.removedAt) return { error: "That invite no longer exists." };

  const result = await sendWhatsAppText(invite.phone, invite.message);
  if (!result.ok && result.error.startsWith("WhatsApp isn't set up")) {
    return { error: result.error };
  }

  await db
    .update(whatsappInvites)
    .set({
      lastSentAt: new Date(),
      sendCount: sql`${whatsappInvites.sendCount} + 1`,
      lastStatus: result.ok ? "sent" : "failed",
      lastError: result.ok ? null : result.error,
    })
    .where(eq(whatsappInvites.id, inviteId));

  revalidatePath("/admin/pilots");
  revalidatePath("/admin/students");
  revalidatePath("/instructor");
  if (!result.ok) return { error: result.error };
  return { success: `Re-invite sent to ${invite.name}.` };
}

/** CFI/Admin: take a name off the Invites list by hand (e.g. they signed up
 * with a different number, or aren't interested). */
export async function removeWhatsAppInvite(inviteId: string): Promise<void> {
  await requireAdminOrCFI();
  await db
    .update(whatsappInvites)
    .set({ removedAt: new Date() })
    .where(eq(whatsappInvites.id, inviteId));
  revalidatePath("/admin/pilots");
  revalidatePath("/admin/students");
  revalidatePath("/instructor");
}
