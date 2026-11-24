import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { studentSignoffs } from "@/db/schema";
import { TRAINING_LABEL } from "@/lib/submission/types";
import { RegenerateForm } from "@/app/instructor/students/[id]/signoff-form";

/** Batch 103 (Riaan, 24 Nov 2026): "under pilot, as CFI or instructor, give
 * the option to reprint the last renewal pack". Shows the person's latest
 * sign-off pack (renewal or Solo wings) with Download and Regenerate. */
export default async function SignoffPackCard({ userId, canRegenerate }: { userId: string; canRegenerate: boolean }) {
  const [so] = await db
    .select()
    .from(studentSignoffs)
    .where(eq(studentSignoffs.studentUserId, userId))
    .orderBy(desc(studentSignoffs.signedOffAt))
    .limit(1);
  if (!so?.packFile) return null;
  const renewal = so.kind === "renewal";
  return (
    <section
      className={`rounded-xl border-2 p-4 text-sm ${renewal ? "border-amber-400 bg-amber-50" : "border-blue-200 bg-blue-50"}`}
    >
      <h2 className={`font-semibold ${renewal ? "text-amber-900" : "text-blue-900"}`}>
        {renewal ? "★ Last renewal pack (SACAA)" : "Last sign-off pack (Solo wings)"}
      </h2>
      <p className="mt-0.5 text-slate-700">
        {TRAINING_LABEL[so.trainingType]} · signed off {so.signedOffAt.toLocaleDateString("en-ZA")}
        {so.packGeneratedAt && so.packGeneratedAt.getTime() !== so.signedOffAt.getTime()
          ? ` · pack rebuilt ${so.packGeneratedAt.toLocaleDateString("en-ZA")}`
          : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        <a
          href={`/api/signoff-pack/${userId}`}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
            renewal ? "bg-amber-500 text-amber-950 hover:bg-amber-600" : "bg-blue-700 text-white hover:bg-blue-800"
          }`}
        >
          {renewal ? "Download / reprint renewal pack (.zip)" : "Download / reprint pack (.zip)"}
        </a>
        {canRegenerate && <RegenerateForm studentId={userId} trainingType={so.trainingType} />}
        <Link href={`/instructor/students/${userId}#signoff`} className="self-center text-xs font-medium text-slate-600 underline">
          Open training folio
        </Link>
      </div>
    </section>
  );
}
