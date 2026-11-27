import { readFile } from "node:fs/promises";
import { getCurrentUser } from "@/lib/auth/dal";
import { resolveUploadPath } from "@/lib/uploads";
import { getSafetyNotice, snRef } from "@/lib/safety-notices";

const TYPES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

// Batch 108: a safety notice's document -- any logged-in account.
export async function GET(_req: Request, ctx: RouteContext<"/api/safety-notice/[no]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const { no } = await ctx.params;
  const n = await getSafetyNotice(Number(no));
  if (!n?.file) return new Response("Not found", { status: 404 });
  const p = resolveUploadPath("safety-notices", n.file);
  if (!p) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(p);
    const ext = n.file.split(".").pop() ?? "";
    const name = (n.fileOriginalName ?? `${snRef(n.number)}.${ext}`).replace(/"/g, "");
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Content-Disposition": `inline; filename="${name}"`, "Cache-Control": "private, no-store" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
