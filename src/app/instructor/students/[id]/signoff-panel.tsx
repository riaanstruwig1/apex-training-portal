import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { studentSignoffs, flightLogEntries, users } from "@/db/schema";
import { and } from "drizzle-orm";
import { SignoffForm, RegenerateForm } from "./signoff-form";
import { TRAINING_LABEL } from "@/lib/submission/types";

export default async function SignoffPanel({
  student,
  profile,
  staffId,
  isCFI,
}: {
  student: typeof users.$inferSelect;
  profile: { trainingType: string | null; callSign: string | null } | undefined;
  staffId: string;
  isCFI: boolean;
}) {
  const [so] = await db.select().from(studentSignoffs).where(eq(studentSignoffs.studentUserId, student.id)).orderBy(desc(studentSignoffs.signedOffAt)).limit(1);

  if (so) {
    const canRegen = isCFI || so.signedOffByUserId === staffId;
    return (
      <section className="rounded-lg border border-green-300 bg-green-50 p-4">
        <h2 className="text-base font-semibold text-green-900">Signed off - Solo wings awarded</h2>
        <p className="text-sm text-green-900">
          {TRAINING_LABEL[so.trainingType]} · {so.signedOffAt.toLocaleDateString()} · now a Pilot, pending licence from CAA
        </p>
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <a href={`/api/signoff-pack/${student.id}`} className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800">
            Download submission pack (.zip)
          </a>
          {canRegen && <RegenerateForm studentId={student.id} trainingType={so.trainingType} />}
        </div>
      </section>
    );
  }

  const unverified = (await db.select({ id: flightLogEntries.id }).from(flightLogEntries).where(and(eq(flightLogEntries.studentId, student.id), eq(flightLogEntries.verified, false)))).length;
  const tt = (profile?.trainingType ?? "pg").split(",")[0].trim();
  const trainingType = tt === "ppg" || tt === "ppt" ? tt : "pg";
  const parts = student.name.trim().split(/\s+/);
  return (
    <section className="rounded-lg border border-slate-300 bg-white p-4">
      <h2 className="mb-3 text-base font-semibold text-slate-900">Sign off student</h2>
      <SignoffForm
        studentId={student.id}
        trainingType={trainingType}
        surname={parts.length > 1 ? parts[parts.length - 1] : student.name}
        firstNames={parts.length > 1 ? parts.slice(0, -1).join(" ") : ""}
        callSign={profile?.callSign ?? ""}
        unverifiedCount={unverified}
        hasSignature={!!student.signatureFile}
        signatureConsent={!!student.signatureFormsConsentAt}
        hasPhoto={!!student.profilePictureFile}
        hasId={!!student.idPassportFile}
      />
    </section>
  );
}
