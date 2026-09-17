import { eq } from "drizzle-orm";
import { Packer } from "docx";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireInstructor } from "@/lib/auth/dal";
import { getExamDetail } from "@/lib/exams";
import { buildExamDocx } from "@/lib/exam-print";

export async function GET(
  req: Request,
  ctx: RouteContext<"/instructor/students/[id]/exams/[examId]/download">
) {
  await requireInstructor();
  const { id, examId } = await ctx.params;
  const attemptId = new URL(req.url).searchParams.get("attempt") ?? undefined;

  const [student] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!student || student.role !== "student") {
    return new Response("Not found", { status: 404 });
  }

  const detail = await getExamDetail(examId, id, true, attemptId);
  if (!detail || !detail.attempt || detail.attempt.status === "in_progress") {
    return new Response("This exam hasn't been submitted yet.", { status: 400 });
  }

  const doc = await buildExamDocx(student.name, detail.exam, detail.attempt);
  const buffer = await Packer.toBuffer(doc);

  const filename = `${student.name.replace(/[^a-z0-9]+/gi, "-")}-${detail.exam.slug}-attempt${detail.attempt.attemptNumber}.docx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
