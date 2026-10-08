import { readFile } from "node:fs/promises";
import { getCurrentUser } from "@/lib/auth/dal";
import { resolveUploadPath } from "@/lib/uploads";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** "?download=<name>" (8 Oct 2026, Riaan: CFI wants to download what a
 * student submitted, not just view it) sends the file as a download, saved
 * as "<name>.<ext>" -- the name is cleaned to safe characters. */
function downloadName(raw: string | null, ext: string, fallback: string): string | null {
  if (raw === null) return null;
  const clean = raw.replace(/[^A-Za-z0-9 ._()-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return clean ? `${clean}.${ext}` : fallback;
}

/**
 * Serves an uploaded document (ID copy, CAA licence, profile picture).
 * Never public -- these are personal documents, so only the owner or staff
 * reviewing the application can fetch them (requireAdminOrCFI/instructor
 * would be too narrow here, since an instructor viewing a student's exam
 * record has never needed this before -- keep it to owner + admin/cfi).
 */
export async function GET(
  req: Request,
  ctx: RouteContext<"/api/uploads/[userId]/[filename]">
) {
  const { userId, filename } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });

  const isOwner = user.id === userId;
  const isStaff = user.role === "cfi" || user.role === "admin" || user.role === "instructor";
  if (!isOwner && !isStaff) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = resolveUploadPath(userId, filename);
  if (!filePath) return new Response("Not found", { status: 404 });

  try {
    const bytes = await readFile(filePath);
    const ext = filename.split(".").pop() ?? "";
    const asDownload = downloadName(new URL(req.url).searchParams.get("download"), ext, filename);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=0, no-store",
        ...(asDownload ? { "Content-Disposition": `attachment; filename="${asDownload}"` } : {}),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
