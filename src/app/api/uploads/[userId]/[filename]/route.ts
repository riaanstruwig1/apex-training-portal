import { readFile } from "node:fs/promises";
import { getCurrentUser } from "@/lib/auth/dal";
import { resolveUploadPath } from "@/lib/uploads";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Serves an uploaded document (ID copy, CAA licence, profile picture).
 * Never public -- these are personal documents, so only the owner or staff
 * reviewing the application can fetch them (requireAdminOrCFI/instructor
 * would be too narrow here, since an instructor viewing a student's exam
 * record has never needed this before -- keep it to owner + admin/cfi).
 */
export async function GET(
  _req: Request,
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
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
