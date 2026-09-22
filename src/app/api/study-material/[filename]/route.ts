import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { studyMaterials } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { resolveStudyMaterialPath } from "@/lib/study-material-uploads";

const CONTENT_TYPES: Record<string, string> = {
  zip: "application/zip",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

/**
 * Serves a CFI-uploaded study-material file. Any signed-in account can
 * download -- this is shared course content, not a personal document, so
 * it doesn't need the owner-or-staff check the personal-uploads route uses.
 * Sent with the original filename the CFI uploaded it under, not the
 * random stored one.
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/study-material/[filename]">
) {
  const { filename } = await ctx.params;

  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });

  const filePath = resolveStudyMaterialPath(filename);
  if (!filePath) return new Response("Not found", { status: 404 });

  const [row] = await db
    .select({ originalName: studyMaterials.originalName })
    .from(studyMaterials)
    .where(eq(studyMaterials.filename, filename))
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
