import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdminOrCFI } from "@/lib/auth/dal";
import { getApplicantDetail } from "@/lib/verification";
import { getStudentProgress } from "@/lib/progress";
import { getLogbookEntries, summarizeLogbook } from "@/lib/logbook";
import { parseTrainingTypes, type TrainingType } from "@/lib/exams";
import Avatar from "@/components/avatar";
import PrintButton from "@/components/print-button";

const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  pg: "Paraglider (PG)",
  ppg: "Powered Paragliding (PPG)",
  ppt: "Powered Paratrike (PPT)",
};

function fmt(d: Date | null | undefined) {
  return d ? d.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" }) : null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 text-slate-900">{value || <span className="text-slate-300">—</span>}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-1 border-b border-slate-200 pb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <dl className="divide-y divide-slate-100">{children}</dl>
    </section>
  );
}

function onFile(filename: string | null | undefined) {
  return filename ? "On file" : "Not on file";
}

/** Printable profile sheet for CFI/Admin (30 Sep 2026, Riaan: "As CFI or
 * Admin we can not view a student's profile, make changes or print it").
 * Same print-CSS approach as the student/pilot portfolio print pages -- the
 * nav header is hidden by globals.css's @media print rule. Works for any
 * account the profile page itself shows (student, pilot, staff). */
export default async function PrintProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminOrCFI();
  const { id } = await params;
  const detail = await getApplicantDetail(id);
  if (!detail) notFound();
  const { applicant: a, pilot, student } = detail;
  const isStudent = a.role === "student";

  const [sections, logEntries] = await Promise.all([
    isStudent ? getStudentProgress(a.id) : Promise.resolve([]),
    getLogbookEntries(a.id),
  ]);
  const summary = summarizeLogbook(logEntries);
  const totalExercises = sections.reduce((n, s) => n + s.totalCount, 0);
  const signedOff = sections.reduce((n, s) => n + s.signedOffCount, 0);
  const sp = student?.profile;
  const pp = pilot?.profile;
  const roleLabel =
    a.role === "student" ? "Student" : a.role === "pilot" ? "Pilot" : a.role === "cfi" ? "CFI" : "Instructor";
  const training = parseTrainingTypes(sp?.trainingType)
    .map((t) => TRAINING_TYPE_LABELS[t])
    .join(" + ");

  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-white p-6">
      <div className="print-hide flex items-center justify-between">
        <Link href={`/admin/applicants/${a.id}`} className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to profile
        </Link>
        <PrintButton />
      </div>

      <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
        <Avatar userId={a.id} filename={a.profilePictureFile} name={a.name} size={72} />
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{a.name}</h1>
          <p className="text-sm text-slate-500">
            {roleLabel} profile · Apex No. {a.apexNumber ?? "—"} · Apex Flight Hub
          </p>
          {training && <p className="text-sm text-slate-700">Training: {training}</p>}
        </div>
      </div>

      <Section title="Personal details">
        <Row
          label="Full name"
          value={`${a.title ?? ""} ${a.name} ${a.nickname ? `"${a.nickname}"` : ""}`.trim()}
        />
        <Row label="Initials" value={a.initials} />
        <Row label="ID / Passport No." value={a.idPassportNumber} />
        <Row label="Date of birth" value={fmt(a.dob)} />
        <Row label="Sex" value={a.sex} />
        <Row label="Email" value={a.email} />
        <Row label="Cell number" value={a.phone ?? sp?.phone} />
        <Row label="Alt. contact number" value={a.altPhone} />
        <Row label="Postal address" value={a.postalAddress} />
        <Row label="Home address" value={a.homeAddress} />
        <Row label="Club / school" value={a.clubName} />
      </Section>

      <Section title="Next of kin & medical">
        <Row label="Next of kin" value={a.nokName} />
        <Row label="Next of kin contact" value={a.nokContactNo} />
        <Row label="Medical aid" value={a.medicalAid} />
        <Row label="Medical aid no." value={a.medicalAidNo} />
        <Row label="Blood group" value={a.bloodGroup} />
        <Row label="Allergies" value={a.allergies} />
        <Row
          label="Medical declaration"
          value={
            a.medicalDeclarationSignedAt
              ? `Signed ${fmt(a.medicalDeclarationSignedAt)}${
                  a.medicalDeclarationExpiresAt ? `, expires ${fmt(a.medicalDeclarationExpiresAt)}` : ""
                }`
              : null
          }
        />
      </Section>

      {isStudent && (
        <Section title="Student details">
          <Row label="Call sign" value={sp?.callSign} />
          <Row label="SACAA No." value={sp?.sacaaNumber} />
          <Row label="SAHPA No." value={sp?.sahpaNumber} />
          <Row label="SAHPA expiry" value={fmt(sp?.sahpaExpiryDate)} />
          <Row
            label="Initial sign-up date"
            value={sp?.signUpDate ? fmt(sp.signUpDate) : `${fmt(a.createdAt)} (account created)`}
          />
          <Row label="Training start date" value={fmt(sp?.startDate)} />
        </Section>
      )}

      {pp && (
        <Section title="Pilot details">
          <Row label="Call sign" value={pp.callSign} />
          <Row label="SACAA No." value={pp.sacaaNumber} />
          <Row label="SAHPA No." value={pp.sahpaNumber} />
          <Row label="SAHPA expiry" value={fmt(pp.sahpaExpiryDate)} />
          <Row label="Licence first issued" value={fmt(pp.licenceFirstIssuedAt)} />
          <Row label="Licence expiry" value={fmt(pp.caaLicenceExpiryDate)} />
        </Section>
      )}

      <Section title="Consent, indemnity & documents">
        <Row
          label="Client consent (SACAA)"
          value={a.consentSigned ? `Signed ${fmt(a.consentSignedAt) ?? ""} ${a.consentSignedName ? `by ${a.consentSignedName}` : ""}`.trim() : "Not signed"}
        />
        <Row
          label="Indemnity"
          value={a.indemnitySigned ? `Signed ${fmt(a.indemnitySignedAt) ?? ""} ${a.indemnitySignedName ? `by ${a.indemnitySignedName}` : ""}`.trim() : "Not signed"}
        />
        <Row label="ID / Passport copy" value={onFile(a.idPassportFile)} />
        <Row label="Flight medical certificate" value={onFile(a.flightMedicalCertFile)} />
        {isStudent && <Row label="Proof of payment" value={onFile(sp?.popFile)} />}
        {pp && <Row label="CAA licence" value={onFile(pp.caaLicenceFile)} />}
      </Section>

      <section className="break-inside-avoid">
        <h2 className="mb-2 border-b border-slate-200 pb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Flying summary
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Logged flights</div>
            <div className="text-lg font-semibold text-slate-900">{summary.totalFlights}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Flight time</div>
            <div className="text-lg font-semibold text-slate-900">
              {Math.round(summary.totalMinutes / 6) / 10} h
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Launches</div>
            <div className="text-lg font-semibold text-slate-900">{summary.totalLaunches}</div>
          </div>
          {isStudent && (
            <div className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs text-slate-500">Exercises signed off</div>
              <div className="text-lg font-semibold text-slate-900">
                {signedOff} / {totalExercises}
              </div>
            </div>
          )}
        </div>
        {isStudent && sections.length > 0 && (
          <div className="mt-3 space-y-1">
            {sections.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-900">{s.name}</span>
                <span className="text-slate-500">
                  {s.signedOffCount} / {s.totalCount}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="border-t border-slate-200 pt-3 text-xs text-slate-400">
        Printed {fmt(new Date())} from Apex Flight Hub.
      </p>
    </div>
  );
}
