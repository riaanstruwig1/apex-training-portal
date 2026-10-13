"use server";

import { and, asc, eq } from "drizzle-orm";
import { unlink } from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { contentItems, ratingApplicationDocuments } from "@/db/schema";
import { getCurrentUser, requireCFI, requirePilot } from "@/lib/auth/dal";
import { ENDORSEMENT_OPTIONS } from "@/lib/pilot-endorsements";
import {
  ContentItemUploadError,
  deleteContentItemFile,
  saveContentItemFile,
} from "@/lib/content-item-uploads";
import { resolveUploadPath, saveUpload, UploadError } from "@/lib/uploads";
import type { ContentItemView } from "@/lib/actions/content-items";

/*
 * Line 62 (13 Oct 2026, Riaan: "almost the same as no 70 -- when you hover
 * over Apply for something else or click on it, it must open a list of
 * requirements as per regulations for that rating, licence or endorsement,
 * also a list of docs that are required to download. Must also be able
 * then to upload the doc for application").
 *
 *  - Requirements + forms to download: content_items with ownerType
 *    "rating" and ownerId = the endorsement key. The CFI adds them with
 *    Add+ (in the overlay, or on Instructor -> Rating requirements).
 *  - The pilot's own documents for that application:
 *    rating_application_documents. Uploading is optional -- Apply works
 *    with or without them (Riaan, 13 Oct 2026).
 */

const STAFF_ROLES = new Set(["cfi", "admin", "instructor"]);

function isRatingKey(key: string) {
  return ENDORSEMENT_OPTIONS.some((o) => o.key === key);
}

export type RatingDocumentView = {
  id: string;
  label: string;
  filename: string;
  originalName: string | null;
  userId: string;
  createdAt: Date;
};

export type RatingInfo = {
  items: ContentItemView[];
  /** The pilot's uploaded documents for this rating (own, or -- for staff
   * -- the pilot named by pilotUserId). */
  documents: RatingDocumentView[];
};

/** Everything the overlay shows for one rating. Requirements are readable
 * by any signed-in account. Documents: a pilot sees their own; staff
 * (CFI/Admin/Instructor) pass the pilot's user id to see theirs. */
export async function getRatingInfo(key: string, pilotUserId?: string): Promise<RatingInfo> {
  const user = await getCurrentUser();
  if (!user || !isRatingKey(key)) return { items: [], documents: [] };

  const items = await db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      body: contentItems.body,
      filename: contentItems.filename,
      originalName: contentItems.originalName,
      mimeType: contentItems.mimeType,
      fileSize: contentItems.fileSize,
      linkUrl: contentItems.linkUrl,
    })
    .from(contentItems)
    .where(and(eq(contentItems.ownerType, "rating"), eq(contentItems.ownerId, key)))
    .orderBy(asc(contentItems.order), asc(contentItems.createdAt));

  const ownerId = pilotUserId && pilotUserId !== user.id ? pilotUserId : user.id;
  if (ownerId !== user.id && !STAFF_ROLES.has(user.role)) return { items, documents: [] };

  const documents = await db
    .select({
      id: ratingApplicationDocuments.id,
      label: ratingApplicationDocuments.label,
      filename: ratingApplicationDocuments.filename,
      originalName: ratingApplicationDocuments.originalName,
      userId: ratingApplicationDocuments.userId,
      createdAt: ratingApplicationDocuments.createdAt,
    })
    .from(ratingApplicationDocuments)
    .where(
      and(
        eq(ratingApplicationDocuments.userId, ownerId),
        eq(ratingApplicationDocuments.endorsementKey, key)
      )
    )
    .orderBy(asc(ratingApplicationDocuments.createdAt));

  return { items, documents };
}

export type RatingFormState = { error: string } | { success: true } | undefined;

function normalizeUrl(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function revalidateRatingViews() {
  revalidatePath("/pilot");
  revalidatePath("/instructor/ratings");
  revalidatePath("/admin/applicants", "layout");
  revalidatePath("/admin/pilots");
}

/** CFI only: Add+ a requirement / form to download for a rating -- a title
 * plus any of a note, a document or picture, or a link. */
export async function addRatingContent(
  _prev: RatingFormState,
  formData: FormData
): Promise<RatingFormState> {
  const cfi = await requireCFI();
  const key = String(formData.get("ratingKey") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const link = String(formData.get("linkUrl") ?? "").trim();
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;

  if (!isRatingKey(key)) return { error: "That rating no longer exists." };
  if (!title) return { error: "Give this item a title." };
  if (!body && !link && !hasFile) return { error: "Add a note, a document/picture, or a link." };

  let saved: Awaited<ReturnType<typeof saveContentItemFile>> | null = null;
  if (hasFile) {
    try {
      saved = await saveContentItemFile(file as File);
    } catch (err) {
      if (err instanceof ContentItemUploadError) return { error: err.message };
      throw err;
    }
  }

  const existing = await db
    .select({ order: contentItems.order })
    .from(contentItems)
    .where(and(eq(contentItems.ownerType, "rating"), eq(contentItems.ownerId, key)));
  const nextOrder = existing.reduce((m, r) => Math.max(m, r.order), 0) + 1;

  await db.insert(contentItems).values({
    ownerType: "rating",
    ownerId: key,
    title,
    body: body || null,
    linkUrl: link ? normalizeUrl(link) : null,
    filename: saved?.filename ?? null,
    originalName: saved?.originalName ?? null,
    mimeType: saved?.mimeType ?? null,
    fileSize: saved?.fileSize ?? null,
    order: nextOrder,
    createdByUserId: cfi.id,
  });

  revalidateRatingViews();
  return { success: true };
}

/** CFI only: remove a rating requirement item (and its file). */
export async function deleteRatingContent(itemId: string) {
  await requireCFI();
  const [item] = await db.select().from(contentItems).where(eq(contentItems.id, itemId)).limit(1);
  if (!item || item.ownerType !== "rating") return;
  if (item.filename) await deleteContentItemFile(item.filename);
  await db.delete(contentItems).where(eq(contentItems.id, itemId));
  revalidateRatingViews();
}

/** The pilot uploads one document for a rating application (PDF or photo,
 * max 10MB -- same rules as every other pilot upload). */
export async function uploadRatingDocument(
  _prev: RatingFormState,
  formData: FormData
): Promise<RatingFormState> {
  const { user, profile } = await requirePilot();
  if (!profile) return { error: "You don't have a pilot profile yet." };
  const key = String(formData.get("ratingKey") ?? "");
  const file = formData.get("file");
  if (!isRatingKey(key)) return { error: "That rating no longer exists." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };

  let filename: string | null;
  try {
    filename = await saveUpload(user.id, `application-${key.replace(/_/g, "-")}`, file);
  } catch (err) {
    if (err instanceof UploadError) return { error: err.message.replace(/^application-[^:]*: /, "") };
    throw err;
  }
  if (!filename) return { error: "Choose a file to upload." };

  const typed = String(formData.get("label") ?? "").trim();
  const fallback = file.name.replace(/\.[^.]+$/, "").trim() || "Document";
  await db.insert(ratingApplicationDocuments).values({
    pilotProfileId: profile.id,
    userId: user.id,
    endorsementKey: key,
    label: (typed || fallback).slice(0, 120),
    filename,
    originalName: file.name || null,
    uploadedByUserId: user.id,
  });

  revalidateRatingViews();
  return { success: true };
}

/** Remove an uploaded application document: the pilot who owns it, or a
 * CFI/Admin. */
export async function deleteRatingDocument(docId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const [doc] = await db
    .select()
    .from(ratingApplicationDocuments)
    .where(eq(ratingApplicationDocuments.id, docId))
    .limit(1);
  if (!doc) return {};
  if (doc.userId !== user.id && user.role !== "cfi" && user.role !== "admin") {
    return { error: "You can't remove this document." };
  }
  const filePath = resolveUploadPath(doc.userId, doc.filename);
  if (filePath) await unlink(filePath).catch(() => {});
  await db.delete(ratingApplicationDocuments).where(eq(ratingApplicationDocuments.id, docId));
  revalidateRatingViews();
  return {};
}

