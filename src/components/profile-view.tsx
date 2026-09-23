import Link from "next/link";
import Avatar from "@/components/avatar";
import MedicalDeclarationStatus from "@/components/medical-declaration-status";
import ConsentBadge from "@/components/consent-badge";

/** Read-only mirror of ProfileEditForm's own fields (V22 rollout item 5,
 * 23 Sep 2026 -- Riaan: "a button to view profile [alongside] the edit
 * profile already there"). Shows exactly what's editable there, just not
 * editable here -- no new data beyond what that form already collects. */

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="col-span-2 text-slate-900">{value || <span className="text-slate-300">—</span>}</dd>
    </div>
  );
}

function DocLink({
  userId,
  filename,
  label,
}: {
  userId: string;
  filename: string | null;
  label: string;
}) {
  if (!filename) {
    return (
      <div className="flex items-center justify-between rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400">
        {label} <span>not on file</span>
      </div>
    );
  }
  return (
    <a
      href={`/api/uploads/${userId}/${filename}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
    >
      {label} <span className="text-red-600">View →</span>
    </a>
  );
}

export default function ProfileView({
  role,
  editHref,
  userId,
  name,
  profilePictureFile,
  phone,
  altPhone,
  nokName,
  nokContactNo,
  postalAddress,
  homeAddress,
  clubName,
  medicalAid,
  medicalAidNo,
  bloodGroup,
  allergies,
  flightMedicalCertFile,
  medicalDeclarationSignedAt,
  medicalDeclarationSignedName,
  medicalDeclarationExpiresAt,
  consentSigned,
  consentSignedAt,
  consentSignedName,
  indemnitySigned,
  indemnitySignedAt,
  indemnitySignedName,
  signatureFile,
  pilot,
}: {
  role: "student" | "pilot";
  editHref: string;
  userId: string;
  name: string;
  profilePictureFile: string | null;
  phone: string | null;
  altPhone: string | null;
  nokName: string | null;
  nokContactNo: string | null;
  postalAddress: string | null;
  homeAddress: string | null;
  clubName: string | null;
  medicalAid: string | null;
  medicalAidNo: string | null;
  bloodGroup: string | null;
  allergies: string | null;
  flightMedicalCertFile: string | null;
  medicalDeclarationSignedAt: Date | null;
  medicalDeclarationSignedName: string | null;
  medicalDeclarationExpiresAt: Date | null;
  consentSigned: boolean;
  consentSignedAt: Date | null;
  consentSignedName: string | null;
  indemnitySigned: boolean;
  indemnitySignedAt: Date | null;
  indemnitySignedName: string | null;
  signatureFile: string | null;
  pilot?: {
    callSign: string | null;
    sacaaNumber: string | null;
    sahpaNumber: string | null;
    sahpaExpiryDate: Date | null;
    caaLicenceFile: string | null;
  } | null;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <Avatar userId={userId} filename={profilePictureFile} name={name} size={56} />
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-900">{name}</h2>
          <p className="text-xs text-slate-500">
            {role === "pilot" ? "Pilot" : "Student"} profile -- read-only view
          </p>
        </div>
        <Link
          href={editHref}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Edit profile
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Contact details</h3>
        <dl className="divide-y divide-slate-100">
          <Row label="Cell number" value={phone} />
          <Row label="Alt. contact number" value={altPhone} />
          <Row label="Next of kin" value={nokName} />
          <Row label="Next of kin contact" value={nokContactNo} />
          <Row label="Postal address" value={postalAddress} />
          <Row label="Home address" value={homeAddress} />
          <Row label="Club / school" value={clubName} />
        </dl>
      </div>

      {pilot && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Pilot details</h3>
          <dl className="divide-y divide-slate-100">
            <Row label="Call sign (self-declared)" value={pilot.callSign} />
            <Row label="SACAA No." value={pilot.sacaaNumber} />
            <Row label="SAHPA Membership No." value={pilot.sahpaNumber} />
            <Row
              label="SAHPA membership expiry"
              value={pilot.sahpaExpiryDate?.toLocaleDateString()}
            />
          </dl>
          <div className="mt-3">
            <DocLink userId={userId} filename={pilot.caaLicenceFile} label="Current CAA licence" />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Medical</h3>
        <dl className="divide-y divide-slate-100">
          <Row label="Medical aid" value={medicalAid} />
          <Row label="Medical aid no." value={medicalAidNo} />
          <Row label="Blood group" value={bloodGroup} />
          <Row label="Allergies" value={allergies} />
        </dl>
        <div className="mt-3 space-y-2">
          <DocLink
            userId={userId}
            filename={flightMedicalCertFile}
            label="Flight medical certificate"
          />
          <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
            Pilot&rsquo;s Declaration of Medical Fitness
            <MedicalDeclarationStatus
              signedAt={medicalDeclarationSignedAt}
              signedName={medicalDeclarationSignedName}
              expiresAt={medicalDeclarationExpiresAt}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Consent &amp; indemnity</h3>
        <div className="flex flex-wrap gap-3">
          <ConsentBadge signed={consentSigned} at={consentSignedAt} name={consentSignedName} />
          <ConsentBadge signed={indemnitySigned} at={indemnitySignedAt} name={indemnitySignedName} />
        </div>
        <div className="mt-3 space-y-2">
          <a
            href="/documents/sacaa-client-consent-form.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Client Consent Form (SACAA CA 183-540) <span className="text-red-600">View →</span>
          </a>
          <a
            href="/documents/indemnity-assumption-of-risk.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Indemnity / Assumption of Risk &amp; Release <span className="text-red-600">View →</span>
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Saved signature</h3>
        {signatureFile ? (
          <img
            src={`/api/signature?v=${encodeURIComponent(signatureFile)}`}
            alt="Your saved signature"
            className="h-12 max-w-[12rem] rounded border border-slate-200 bg-white object-contain p-1"
          />
        ) : (
          <p className="text-sm text-slate-400">Nothing saved.</p>
        )}
      </div>
    </div>
  );
}
