import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

// Its own upload folder, separate from study-material -- this is a distinct
// feature (V22 rollout item 2, confirmed "new, separate feature" 23 Sep
// 2026), not an extension of Study Material, even though the CRUD pattern
// is deliberately the same.
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads", "forms-procedures");
const MAX_BYTES = 50 * 1024 * 1024;

// Per Riaan's spec: "pic, PDF, Power point presentations or zip file" --
// deliberately no Word doc types here (unlike study-material), since this
// feature has its own literal list.
const ALLOWED_EXT_BY_TYPE: Record<string, string> = {
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
};
const ALLOWED_EXT_BY_NAME = new Set([
  "zip",
  "ppt",
  "pptx",
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
]);

export class FormsProcedureUploadError extends Error {}

/** Saves one uploaded forms-&-procedures file under
 * data/uploads/forms-procedures/ and returns the stored filename plus what
 * to remember about it. Same MIME-type-with-filename-fallback approach as
 * study-material-uploads.ts, since browsers are just as inconsistent about
 * reporting image/older-Office MIME types as they are about zip/Office. */
export async function saveFormsProcedureFile(
  file: File
): Promise<{ filename: string; originalName: string; fileSize: number }> {
  if (!file || file.size === 0) {
    throw new FormsProcedureUploadError("Choose a file to upload.");
  }
  if (file.size > MAX_BYTES) {
    throw new FormsProcedureUploadError("File is too large (max 50MB).");
  }

  let ext = ALLOWED_EXT_BY_TYPE[file.type];
  if (!ext) {
    const nameExt = file.name.toLowerCase().split(".").pop() ?? "";
    if (ALLOWED_EXT_BY_NAME.has(nameExt)) ext = nameExt;
  }
  if (!ext) {
    throw new FormsProcedureUploadError(
      "Only images, PDF, PowerPoint (.ppt/.pptx) or ZIP files are accepted."
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
export function resolveFormsProcedurePath(filename: string): string | null {
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return null;
  }
  return path.join(UPLOAD_DIR, filename);
}

/** Best-effort delete of a slot's old file when it's replaced or cleared --
 * never blocks the database update on this succeeding. */
export async function deleteFormsProcedureFile(filename: string) {
  const filePath = resolveFormsProcedurePath(filename);
  if (!filePath) return;
  try {
    await unlink(filePath);
  } catch {
    // Already gone, or never existed -- fine either way.
  }
}
