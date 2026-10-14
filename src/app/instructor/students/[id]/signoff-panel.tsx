import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { studentSignoffs, flightLogEntries, users, pilotProfiles } from "@/db/schema";
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
  // The instructor's own CAA number (027...) lives on their linked pilot profile.
  const [staffPilot] = await db.select({ sacaa: pilotProfiles.sacaaNumber }).from(pilotProfiles).where(eq(pilotProfiles.userId, staffId)).limit(1);
  const [staffUser] = await db.select({ name: users.name }).from(users).where(eq(users.id, staffId)).limit(1);
  return (
    <details className="group rounded-lg border border-slate-300 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800">
        <span>Sign off student - award Solo wings</span>
        <span className="text-xs font-normal opacity-80 group-open:hidden">Click to open</span>
        <span className="hidden text-xs font-normal opacity-80 group-open:inline">Click to close</span>
      </summary>
      <div className="p-4">
      <SignoffForm
        instructorCaaNo={staffPilot?.sacaa ?? ""}
        examinerName={staffUser?.name ?? ""}
        studentId={student.id}
        trainingType={trainingType}
        surname={parts.length > 1 ? parts[parts.length - 1] : student.name}
        firstNames={parts.length > 1 ? parts.slice(0, -1).join(" ") : ""}
        callSign={profile?.callSign ?? ""}
        unverifiedCount={unverified}
        hasSignature={!!student.signatureFile}
        signatureConsent={student.signatureFormsConsentAt ? "yes" : student.signatureFormsConsentDeclinedAt ? "no" : null}
        hasPhoto={!!student.profilePictureFile}
        hasId={!!student.idPassportFile}
      />
      </div>
    </details>
  );
}
