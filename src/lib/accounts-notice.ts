import "server-only";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings, studentProfiles, users } from "@/db/schema";
import { HUB_URL, normalizePhone } from "@/lib/invite-message";
import { sendWhatsAppFile, sendWhatsAppText } from "@/lib/whatsapp";
import { resolveUploadPath } from "@/lib/uploads";
import { paymentOption, paymentTotal, rand } from "@/lib/payment-options";
import { parseTrainingTypes } from "@/lib/training-types";
import { isIntroCourse } from "@/lib/intro-course";

/** Batch 92 (Riaan, 9 Nov 2026): when a CFI/Admin verifies a new student,
 * WhatsApp the accounts person (Henna, 072 561 4474 by default; Instructor ->
 * Settings) to load him on both accounting systems, with everything needed
 * for the invoice, and send the proof of payment file after it. */

export type AccountsNoticeResult = "sent" | "failed" | "no_number" | "not_configured";

const TT: Record<string, string> = { pg: "Paraglider (PG)", ppg: "Powered Paraglider (PPG)", ppt: "Powered Trike/Chute (PPT/PPC)" };

function d(v: Date | null | undefined): string {
  return v instanceof Date && !Number.isNaN(v.getTime())
    ? new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric" }).format(v)
    : "-";
}

export async function buildAccountsMessage(studentId: string, verifiedBy: string): Promise<{ text: string; pop: { file: string; userId: string } | null } | null> {
  const [u] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
  if (!u) return null;
  const [sp] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, studentId)).limit(1);
  const opt = paymentOption(sp?.paymentOption);
  const total = opt ? paymentTotal(opt) : null;
  const training = isIntroCourse(sp?.courseLevel)
    ? "PG/PPG Intro training (Phase 1)"
    : parseTrainingTypes(sp?.trainingType).map((t) => TT[t]).join(" + ") || "-";

  const L: string[] = [];
  L.push("*New student signed up - please load him/her on both accounting systems.*");
  L.push(`Verified by ${verifiedBy} on ${d(new Date())}.`);
  L.push("");
  L.push(`*Name:* ${[u.title, u.name].filter(Boolean).join(" ")}${u.nickname ? ` ("${u.nickname}")` : ""}`);
  if (u.initials) L.push(`*Initials:* ${u.initials}`);
  L.push(`*ID / passport:* ${u.idPassportNumber ?? "-"}`);
  L.push(`*Date of birth:* ${d(u.dob)}`);
  L.push(`*Cell:* ${u.phone ?? sp?.phone ?? "-"}${u.altPhone ? `  *Alt:* ${u.altPhone}` : ""}`);
  L.push(`*Email:* ${u.email}`);
  L.push(`*Home address:* ${u.homeAddress || "-"}`);
  L.push(`*Postal address:* ${u.postalAddress || "-"}`);
  L.push(`*Apex No.:* ${u.apexNumber ?? "-"}   *SAHPA No.:* ${sp?.sahpaNumber || "-"}`);
  L.push(`*Training:* ${training}`);
  L.push("");
  L.push(`*Payment option:* ${opt ? opt.label : "not chosen"}`);
  if (opt?.lines.length) {
    for (const l of opt.lines) L.push(`  ${l.label}: ${rand(l.amount)}`);
    L.push(`  *Total: ${rand(total!)}*`);
  } else if (opt) {
    L.push("  Quote still to be sent.");
  }
  if (sp?.invoiceTo === "company") {
    L.push(`*Invoice to company:* ${sp.invoiceCompanyName ?? "-"}`);
    L.push(`  VAT no.: ${sp.invoiceCompanyVat || "-"}`);
    L.push(`  Billing address: ${sp.invoiceCompanyAddress || "-"}`);
  } else {
    L.push("*Invoice to:* the student personally");
  }
  L.push(`*Proof of payment:* ${sp?.popFile ? `uploaded ${d(sp.popUploadedAt)} (file follows)` : "*NOT received*"}`);
  if (!sp?.popFile && sp?.paymentDiscussFirst) {
    L.push("*The student wants to discuss payment first - please contact him/her.*");
  }
  L.push("");
  L.push(`Profile: ${HUB_URL}/admin/applicants/${u.id}`);
  L.push("- Apex Flight Hub");
  return { text: L.join("\n"), pop: sp?.popFile ? { file: sp.popFile, userId: u.id } : null };
}

export async function sendAccountsNotice(studentId: string, verifiedBy: string): Promise<AccountsNoticeResult> {
  const [s] = await db.select({ to: siteSettings.accountsWhatsappTo }).from(siteSettings).limit(1);
  const raw = s ? s.to : "0725614474";
  const numbers = String(raw ?? "")
    .split(/[,;]/)
    .map((n) => normalizePhone(n))
    .filter((n): n is string => !!n);
  if (numbers.length === 0) return "no_number";
  const msg = await buildAccountsMessage(studentId, verifiedBy);
  if (!msg) return "failed";

  let popFile: { bytes: Buffer; fileName: string; mime?: string } | null = null;
  if (msg.pop) {
    const p = resolveUploadPath(msg.pop.userId, msg.pop.file);
    const bytes = p ? await readFile(p).catch(() => null) : null;
    if (bytes) {
      const ext = (msg.pop.file.split(".").pop() ?? "").toLowerCase();
      const mime = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      popFile = { bytes, fileName: `Proof-of-payment.${ext}`, mime };
    }
  }

  let ok = 0;
  for (const n of numbers) {
    const r = await sendWhatsAppText(n, msg.text);
    if (!r.ok) {
      if (r.error.startsWith("WhatsApp isn't set up")) return "not_configured";
      console.error("[accounts WhatsApp]", r.error);
      continue;
    }
    ok++;
    if (popFile) {
      const name = msg.text.match(/\*Name:\* ([^\n]+)/)?.[1] ?? "student";
      const f = await sendWhatsAppFile(n, popFile, `Proof of payment - ${name}`);
      if (!f.ok) console.error("[accounts WhatsApp POP]", f.error);
    }
  }
  return ok > 0 ? "sent" : "failed";
}
