import "server-only";
import { inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { studentProfiles, users } from "@/db/schema";
import { formatPhone, normalizePhone } from "@/lib/invite-message";
import { compareByName } from "@/lib/sort-by-name";
import { readFile } from "node:fs/promises";
import path from "node:path";

const MIME: Record<string, string> = {
  pdf: "application/pdf", zip: "application/zip", ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", heic: "image/heic",
};

/** Reads a Forms & procedures document from disk, ready for sendWhatsAppFile.
 * Null when the file is missing on the server. */
export async function loadFormsDocument(row: {
  filename: string;
  originalName: string | null;
  title: string | null;
}): Promise<{ bytes: Buffer; fileName: string; mime?: string } | null> {
  let bytes: Buffer;
  try {
    bytes = await readFile(path.join(process.cwd(), "data", "uploads", "forms-procedures", path.basename(row.filename)));
  } catch {
    return null;
  }
  const ext = (row.filename.split(".").pop() ?? "").toLowerCase();
  const fileName = row.originalName || `${(row.title || "Document").replace(/[^\w .-]+/g, "")}.${ext}`;
  return { bytes, fileName, mime: MIME[ext] };
}

/** Sign-off line under every Forms & procedures WhatsApp. */
export const FORMS_SEND_SIGNOFF = "- Apex Adventures (Team Apex)";

/** The fixed note sent with every Forms & procedures document (Riaan, 26 Oct 2026). */
export const FORMS_SEND_NOTE =
  "The following document/form is sent from the Apex Hub as reference. Please ensure you always use the latest document from SAHPA and SACAA.";

export type SendRecipient = { name: string; role: "Student" | "Pilot"; phone: string; display: string };

/** Active students and pilots with a usable cell number, A-Z. The student's
 * number may be on the user row or the student profile -- two plain queries
 * (no join: same-named `phone` columns trap). */
export async function getSendRecipients(): Promise<SendRecipient[]> {
  const people = await db
    .select({ id: users.id, name: users.name, role: users.role, phone: users.phone, status: users.accountStatus })
    .from(users)
    .where(inArray(users.role, ["student", "pilot"]));
  const active = people.filter((p) => p.status === "active");
  const profilePhones = await db
    .select({ userId: studentProfiles.userId, phone: studentProfiles.phone })
    .from(studentProfiles)
    .where(isNotNull(studentProfiles.phone));
  const byUser = new Map(profilePhones.map((p) => [p.userId, p.phone]));
  const out: SendRecipient[] = [];
  for (const p of active) {
    const n = normalizePhone(p.phone) ?? normalizePhone(byUser.get(p.id) ?? null);
    if (!n) continue;
    out.push({ name: p.name, role: p.role === "pilot" ? "Pilot" : "Student", phone: n, display: formatPhone(n) });
  }
  return out.sort(compareByName);
}
