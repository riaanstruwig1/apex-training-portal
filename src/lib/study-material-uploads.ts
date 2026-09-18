import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

// Separate from lib/uploads.ts (which is per-user, for personal documents
// like an ID copy or CAA licence) -- study material is CFI-managed content
// shared by every student, so it lives in its own folder, not under any
// one user's id.
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads", "study-material");
// Course notes/decks run bigger than the 10MB personal-document limit
// elsewhere in the app.
const MAX_BYTES = 50 * 1024 * 1024;

const ALLOWED_EXT_BY_TYPE: Record<string, string> = {
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "application/pdf": "pdf",
};
const ALLOWED_EXT_BY_NAME = new Set(["zip", "ppt", "pptx", "doc", "docx", "pdf"]);

export class StudyMaterialUploadError extends Error {}

/** Saves one uploaded study-material file under data/uploads/study-material/
 * and returns the stored filename plus what to remember about it. Browsers
 * are inconsistent about the MIME type they report for older Office formats
 * and some zip variants, so an unrecognized type falls back to the
 * filename's own extension before rejecting it. */
export async function saveStudyMaterialFile(
  file: File
): Promise<{ filename: string; originalName: string; fileSize: number }> {
  if (!file || file.size === 0) {
    throw new StudyMaterialUploadError("Choose a file to upload.");
  }
  if (file.size > MAX_BYTES) {
    throw new StudyMaterialUploadError("File is too large (max 50MB).");
  }

  let ext = ALLOWED_EXT_BY_TYPE[file.type];
  if (!ext) {
    const nameExt = file.name.toLowerCase().split(".").pop() ?? "";
    if (ALLOWED_EXT_BY_NAME.has(nameExt)) ext = nameExt;
  }
  if (!ext) {
    throw new StudyMaterialUploadError(
      "Only ZIP, PowerPoint (.ppt/.pptx), Word (.doc/.docx) or PDF files are accepted."
    );
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `slot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), bytes);

  return { filename, originalName: file.name, fileSize: file.size };
}

/** Resolves a stored filename back to an absolute path, guarding against
 * path traversal since the filename ultimately rides in a URL segment. */
export function resolveStudyMaterialPath(filename: string): string | null {
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return null;
  }
  return path.join(UPLOAD_DIR, filename);
}

/** Best-effort delete of a slot's old file when it's replaced or cleared --
 * never blocks the database update on this succeeding. */
export async function deleteStudyMaterialFile(filename: string) {
  const filePath = resolveStudyMaterialPath(filename);
  if (!filePath) return;
  try {
    await unlink(filePath);
  } catch {
    // Already gone, or never existed -- fine either way.
  }
}
