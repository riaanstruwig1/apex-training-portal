import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, studentProfiles } from "@/db/schema";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Shopify webhook receiver for the "Student" tag.
 *
 * Configure in Shopify Admin -> Settings -> Notifications -> Webhooks:
 *   Topic: customers/update (and customers/create)
 *   URL:   https://<your-domain>/api/webhooks/shopify/customer
 *   Format: JSON
 * Set SHOPIFY_WEBHOOK_SECRET in your environment to the signing secret
 * Shopify shows you for that webhook.
 *
 * On receiving a customer whose tags include "Student", this creates (or
 * links) a portal account with status "invited" and an invite token -- the
 * same flow as an instructor manually adding a student. There's no email
 * sending configured yet, so the instructor grabs the invite link from the
 * dashboard ("Get invite link") and sends it on. Wiring up an email send
 * here is a natural next step once the school wants it automated.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("SHOPIFY_WEBHOOK_SECRET is not set; rejecting webhook.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-shopify-hmac-sha256");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const provided = Buffer.from(signature, "base64");

  if (
    digest.length !== provided.length ||
    !timingSafeEqual(digest, provided)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let customer: {
    id: number | string;
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    tags?: string;
  };
  try {
    customer = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tags = (customer.tags ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase());
  const isStudent = tags.includes("student");

  if (!isStudent || !customer.email) {
    // Not a student-tagged customer (or no email) -- nothing to do.
    return NextResponse.json({ ok: true, skipped: true });
  }

  const email = customer.email.toLowerCase();
  const name =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    email;
  const shopifyCustomerId = String(customer.id);

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    if (existingUser.role !== "student") {
      // An instructor account happens to share this email -- don't touch it.
      return NextResponse.json({ ok: true, skipped: true });
    }
    await db
      .update(studentProfiles)
      .set({ shopifyCustomerId })
      .where(eq(studentProfiles.userId, existingUser.id));
    return NextResponse.json({ ok: true, linked: true });
  }

  const inviteToken = randomBytes(24).toString("base64url");

  const [newUser] = await db
    .insert(users)
    .values({ name, email, role: "student", passwordHash: null })
    .returning();

  await db.insert(studentProfiles).values({
    userId: newUser.id,
    phone: customer.phone,
    shopifyCustomerId,
    status: "invited",
    inviteToken,
    inviteTokenExpiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  return NextResponse.json({ ok: true, created: true });
}
