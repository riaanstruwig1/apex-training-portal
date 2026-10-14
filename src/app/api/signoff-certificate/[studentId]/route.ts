import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { studentSignoffs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/dal";
import { gatherPackData } from "@/lib/submission/gather-pack-data";
import { buildWingsCertificate } from "@/lib/submission/certificate";

// Solo Wings certificate PDF: the person themselves, or CFI/instructor.
export async function GET(_req: Request, ctx: RouteContext<"/api/signoff-certificate/[studentId]">) {
  const { studentId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const staff = user.role === "cfi" || user.role === "instructor";
  if (!staff && user.id !== studentId) return new Response("Not found", { status: 404 });
  const [so] = await db.select().from(studentSignoffs).where(eq(studentSignoffs.studentUserId, studentId)).orderBy(desc(studentSignoffs.signedOffAt)).limit(1);
  if (!so || !so.wingsAwarded) return new Response("Not found", { status: 404 });
  const data = await gatherPackData(studentId, {
    trainingType: so.trainingType,
    signedOffAt: so.signedOffAt,
    instructorUserId: so.signedOffByUserId,
    instructorLicenceNumber: so.instructorLicenceNumber ?? "",
    skillGrades: {},
    remedialAction: "",
    radioExaminerName: "",
    radioExaminerLicence: "",
    callSignChoices: ["", "", ""],
  });
  const pdf = await buildWingsCertificate(data);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="Solo_Wings_Certificate.pdf"', "Cache-Control": "private, no-store" },
  });
}
