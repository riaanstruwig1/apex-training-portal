import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { formsProcedures } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { resolveFormsProcedurePath } from "@/lib/forms-procedures-uploads";

const CONTENT_TYPES: Record<string, string> = {
  zip: "application/zip",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
};

/**
 * Serves a CFI/Admin-uploaded forms-&-procedures file. Any signed-in
 * account can download -- this is shared content for students and pilots
 * alike, not a personal document, so it doesn't need the owner-or-staff
 * check the personal-uploads route uses. Sent with the original filename
 * it was uploaded under, not the random stored one. Mirrors
 * /api/study-material/[filename] exactly.
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/forms-procedures/[filename]">
) {
  const { filename } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });

  const filePath = resolveFormsProcedurePath(filename);
  if (!filePath) return new Response("Not found", { status: 404 });

  const [row] = await db
    .select({ originalName: formsProcedures.originalName })
    .from(formsProcedures)
    .where(eq(formsProcedures.filename, filename))
    .limit(1);

  try {
    const bytes = await readFile(filePath);
    const ext = filename.split(".").pop() ?? "";
    const downloadName = (row?.originalName ?? filename).replace(/"/g, "");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${downloadName}"`,
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
