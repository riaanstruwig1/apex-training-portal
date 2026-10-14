import { readFile } from "node:fs/promises";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { studentSignoffs, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { resolveUploadPath } from "@/lib/uploads";

// Submission pack zip: the signed-off person themselves, or CFI/instructor.
export async function GET(_req: Request, ctx: RouteContext<"/api/signoff-pack/[studentId]">) {
  const { studentId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const staff = user.role === "cfi" || user.role === "instructor";
  if (!staff && user.id !== studentId) return new Response("Not found", { status: 404 });

  const [so] = await db.select().from(studentSignoffs).where(eq(studentSignoffs.studentUserId, studentId)).orderBy(desc(studentSignoffs.signedOffAt)).limit(1);
  if (!so?.packFile) return new Response("Not found", { status: 404 });
  const [stu] = await db.select({ name: users.name }).from(users).where(eq(users.id, studentId)).limit(1);
  const p = resolveUploadPath(studentId, so.packFile);
  if (!p) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(p);
    const fname = `Apex_Submission_${(stu?.name ?? "student").replace(/[^A-Za-z0-9]+/g, "_")}.zip`;
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${fname}"`, "Cache-Control": "private, no-store" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
