import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contentItems } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  CONTENT_ITEM_TYPES,
  isImageFilename,
  resolveContentItemPath,
} from "@/lib/content-item-uploads";

/** Serves a picture/document attached to an exercise sub-section (line 70).
 * Any signed-in account can view -- shared course content. Pictures are
 * shown inline (they appear inside the info overlay); documents download
 * under the name the CFI uploaded them with. */
export async function GET(_req: Request, ctx: { params: Promise<{ filename: string }> }) {
  const { filename } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });

  const filePath = resolveContentItemPath(filename);
  if (!filePath) return new Response("Not found", { status: 404 });

  const [row] = await db
    .select({ originalName: contentItems.originalName })
    .from(contentItems)
    .where(eq(contentItems.filename, filename))
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });

  try {
    const bytes = await readFile(filePath);
    const ext = filename.split(".").pop() ?? "";
    const name = (row.originalName ?? filename).replace(/"/g, "");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": CONTENT_ITEM_TYPES[ext] ?? "application/octet-stream",
        "Content-Disposition": `${isImageFilename(filename) ? "inline" : "attachment"}; filename="${name}"`,
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
