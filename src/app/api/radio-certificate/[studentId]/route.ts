import { getCurrentUser } from "@/lib/auth/dal";
import { gatherRadioCert } from "@/lib/submission/gather-exams";
import { buildRadioCertificate } from "@/lib/submission/certificates";

// Restricted radio endorsement certificate: issued once the radio exam is
// passed and verified. The person themselves ("me") or CFI/instructor.
export async function GET(_req: Request, ctx: RouteContext<"/api/radio-certificate/[studentId]">) {
  const { studentId: raw } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const studentId = raw === "me" ? user.id : raw;
  const staff = user.role === "cfi" || user.role === "instructor";
  if (!staff && user.id !== studentId) return new Response("Not found", { status: 404 });
  const cert = await gatherRadioCert(studentId);
  if (!cert) return new Response("The radio exam has not been passed and verified yet.", { status: 404 });
  const pdf = await buildRadioCertificate(cert, "Paramotor SA (Pty) Ltd");
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="Radio_Endorsement_Certificate.pdf"', "Cache-Control": "private, no-store" },
  });
}
