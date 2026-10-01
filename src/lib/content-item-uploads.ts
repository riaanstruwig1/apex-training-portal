import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

// Line 70 (1 Oct 2026): pictures and documents the CFI attaches to an
// exercise's sub-sections. Shared course content, like study material, so
// it lives in its own folder rather than under any user's id.
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads", "content-items");
// Bigger things (videos, huge slide decks) should go in as a link instead.
const MAX_BYTES = 25 * 1024 * 1024;

export const CONTENT_ITEM_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

export class ContentItemUploadError extends Error {}

export function isImageFilename(filename: string): boolean {
  return IMAGE_EXTS.has(filename.toLowerCase().split(".").pop() ?? "");
}

export async function saveContentItemFile(
  file: File
): Promise<{ filename: string; originalName: string; mimeType: string; fileSize: number }> {
  if (file.size > MAX_BYTES) {
    throw new ContentItemUploadError("File is too large (max 25MB) -- for videos or big files, paste a link instead.");
  }
  const ext = (file.name.toLowerCase().split(".").pop() ?? "").trim();
  if (!CONTENT_ITEM_TYPES[ext]) {
    throw new ContentItemUploadError(
      "Only pictures (JPG, PNG, WEBP, GIF) or documents (PDF, Word, PowerPoint, ZIP) can be uploaded."
    );
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));
  return { filename, originalName: file.name, mimeType: CONTENT_ITEM_TYPES[ext], fileSize: file.size };
}

/** Guards against path traversal -- the filename rides in a URL segment. */
export function resolveContentItemPath(filename: string): string | null {
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) return null;
  return path.join(UPLOAD_DIR, filename);
}

export async function deleteContentItemFile(filename: string) {
  const filePath = resolveContentItemPath(filename);
  if (!filePath) return;
  try {
    await unlink(filePath);
  } catch {
    // already gone -- fine
  }
}
