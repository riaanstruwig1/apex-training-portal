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
 * Serves the signed-in user's OWN saved signature image, and nothing else.
 *
 * Deliberately not the shared /api/uploads/[userId]/[filename] route (which
 * lets admin/CFI/instructor view a document for a *different* user under
 * review) and deliberately takes no userId or filename in the URL at all --
 * there is nothing here for a path/id to point at another person's file.
 * "Owner only" is not a role check on top of an id, it's the only
 * possible outcome: this always resolves to getCurrentUser()'s own record,
 * full stop. No admin/CFI bypass, unlike every other uploaded-document
 * route in this app. This is the signature vault the applicant is told
 * about at upload time (src/components/profile-edit-form.tsx) -- nobody
 * else can view it or use it, ever, ourselves included.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.signatureFile) return new Response("Not found", { status: 404 });

  const filePath = resolveUploadPath(user.id, user.signatureFile);
  if (!filePath) return new Response("Not found", { status: 404 });

  try {
    const bytes = await readFile(filePath);
    const ext = user.signatureFile.split(".").pop() ?? "";
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
