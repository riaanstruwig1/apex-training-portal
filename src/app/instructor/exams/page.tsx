import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { exams } from "@/db/schema";
import { requireCFI } from "@/lib/auth/dal";

export default async function ExamsAdminPage() {
  await requireCFI();

  const allExams = await db.select().from(exams).orderBy(asc(exams.order));

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Exam content</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Fix wording on an exam&apos;s questions or answers here. You can only
        change the text itself &mdash; the order of questions, which answer
        is marked correct, and the marks each question is worth all stay
        exactly as set up, so editing wording can&apos;t accidentally change
        how the exam is scored.
      </p>
      <div className="space-y-3">
        {allExams.map((e) => (
          <Link
            key={e.id}
            href={`/instructor/exams/${e.id}/edit`}
            className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300"
          >
            <div className="text-sm font-medium text-slate-900">{e.title}</div>
            {e.subtitle && <div className="text-xs text-slate-500">{e.subtitle}</div>}
          </Link>
        ))}
        {allExams.length === 0 && (
          <p className="text-sm text-slate-500">No exams have been set up yet.</p>
        )}
      </div>
    </div>
  );
}
