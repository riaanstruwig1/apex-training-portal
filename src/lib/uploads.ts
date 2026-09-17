import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import convertHeic from "heic-convert";

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// iPhones default to HEIC/HEIF for photos, which browsers report
// inconsistently (a proper MIME type in some, "application/octet-stream" or
// even "" in others) -- so we sniff by extension too, not just file.type.
// These get converted to JPEG server-side rather than rejected, since
// asking every student/pilot to change their camera settings before they
// can upload a profile picture isn't realistic.
const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
function looksLikeHeic(file: File): boolean {
  if (HEIC_TYPES.has(file.type)) return true;
  const name = file.name?.toLowerCase() ?? "";
  return name.endsWith(".heic") || name.endsWith(".heif");
}

export class UploadError extends Error {}

/**
 * Saves one uploaded file under data/uploads/<userId>/, same "local folder
 * next to the sqlite file, never in the zip" treatment as the database --
 * see data/.gitkeep and the packaging script. Returns the stored filename
 * (not a path) to save on the relevant `*File` column.
 */
export async function saveUpload(
  userId: string,
  field: string,
  file: File | null
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  if (file.size > MAX_BYTES) {
    throw new UploadError(`${field}: file is too large (max 10MB).`);
  }

  let ext = ALLOWED_EXT[file.type];
  let bytes = Buffer.from(await file.arrayBuffer());

  if (!ext && looksLikeHeic(file)) {
    try {
      const converted = await convertHeic({ buffer: bytes, format: "JPEG", quality: 0.9 });
      bytes = Buffer.from(converted);
      ext = "jpg";
    } catch {
      throw new UploadError(
        `${field}: this looks like an HEIC/HEIF photo we couldn't convert. Try again, or on iPhone go to Settings > Camera > Formats > "Most Compatible" and re-take/re-save the photo as JPEG.`
      );
    }
  }

  if (!ext) {
    throw new UploadError(`${field}: only PDF, JPG, PNG or WEBP files are accepted.`);
  }

  const dir = path.join(UPLOAD_ROOT, userId);
  await mkdir(dir, { recursive: true });

  const filename = `${field}-${Date.now()}.${ext}`;
  await writeFile(path.join(dir, filename), bytes);

  return filename;
}

/** Resolves a stored filename back to an absolute path, guarding against
 * path traversal since the filename ultimately rides in a URL segment. */
export function resolveUploadPath(userId: string, filename: string): string | null {
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return null;
  }
  return path.join(UPLOAD_ROOT, userId, filename);
}
