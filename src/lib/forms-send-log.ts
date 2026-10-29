import "server-only";
import { count, desc } from "drizzle-orm";
import { db } from "@/db";
import { formsSendLog } from "@/db/schema";
import { getSendRecipients } from "@/lib/forms-send";

/** Batch 88 (Riaan, 29 Oct 2026): every Forms & procedures WhatsApp send is
 * written here -- single documents and send packs, sent or failed. */

export type FormsSendLogEntry = {
  id: string;
  sentAt: Date;
  dateText: string; // formatted on the server in SA time
  sentByName: string | null;
  recipientName: string | null;
  phone: string;
  kind: "document" | "pack";
  title: string;
  documents: string[];
  status: "sent" | "partial" | "failed";
  detail: string | null;
};

export async function logFormsSend(entry: {
  sentBy: { id: string; name: string | null };
  recipientName: string | null;
  phone: string;
  kind: "document" | "pack";
  title: string;
  documents?: string[];
  status: "sent" | "partial" | "failed";
  detail?: string | null;
}) {
  try {
    let recipientName = entry.recipientName?.trim() || null;
    if (!recipientName) {
      // A typed number that belongs to a student/pilot still gets their name.
      const match = (await getSendRecipients()).find((r) => r.phone === entry.phone);
      recipientName = match?.name ?? null;
    }
    await db.insert(formsSendLog).values({
      sentAt: new Date(),
      sentByUserId: entry.sentBy.id,
      sentByName: entry.sentBy.name,
      recipientName,
      phone: entry.phone,
      kind: entry.kind,
      title: entry.title,
      documents: entry.documents?.length ? entry.documents.join("\n") : null,
      status: entry.status,
      detail: entry.detail ?? null,
    });
  } catch (err) {
    // Never let the log break a send.
    console.error("forms send log failed", err);
  }
}

export async function getFormsSendLog(limit = 500): Promise<{ entries: FormsSendLogEntry[]; total: number }> {
  const [{ n }] = await db.select({ n: count() }).from(formsSendLog);
  const rows = await db.select().from(formsSendLog).orderBy(desc(formsSendLog.sentAt)).limit(limit);
  const entries: FormsSendLogEntry[] = rows.map((r) => ({
    id: r.id,
    sentAt: r.sentAt,
    dateText: formatLogDate(r.sentAt),
    sentByName: r.sentByName,
    recipientName: r.recipientName,
    phone: r.phone,
    kind: r.kind === "pack" ? "pack" : "document",
    title: r.title,
    documents: r.documents ? r.documents.split("\n") : [],
    status: r.status === "failed" ? "failed" : r.status === "partial" ? "partial" : "sent",
    detail: r.detail,
  }));
  return { entries, total: Number(n) };
}

/** "29 Oct 2026, 14:05" in South African time. */
export function formatLogDate(d: Date): string {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
