import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { exams } from "@/db/schema";
import { requireCFI } from "@/lib/auth/dal";
import NewExamForm from "./new-exam-form";

export default async function ExamsAdminPage() {
  await requireCFI();

  const allExams = await db.select().from(exams).orderBy(asc(exams.order));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-slate-900">Exam content</h1>
          <p className="max-w-2xl text-sm text-slate-500">
            Add a new exam, or open an existing one to edit its questions,
            answers, marks, and settings.
          </p>
        </div>
      </div>
      <NewExamForm />
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
