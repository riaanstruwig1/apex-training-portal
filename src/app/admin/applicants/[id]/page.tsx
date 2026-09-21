import { notFound } from "next/navigation";
import { getApplicantDetail } from "@/lib/verification";
import { groupEndorsementItems, isLadderTierKey, isInstructorRatingKey, ENDORSEMENT_OPTIONS } from "@/lib/pilot-endorsements";
import { computeLadder, EQUIPMENT_LABELS, INSTRUCTOR_RATING_REFERENCE_TEXT, type Equipment } from "@/lib/pilot-progress";
import LadderTiers from "@/components/ladder-tiers";
import Avatar from "@/components/avatar";
import ApplicantReviewActions from "./applicant-review-actions";
import ApplicantTrainingTypeEditor from "./applicant-training-type-editor";
import PilotEndorsementToggle from "./pilot-endorsement-toggle";
import AdminProfileEditor from "./admin-profile-editor";
import AdminGrantEndorsement from "./admin-grant-endorsement";
import InstructorRatingsGrid from "./instructor-ratings-grid";

const STAFF_ROLES = new Set(["cfi", "instructor"]);

const ALL_EQUIPMENT: Equipment[] = ["pg", "ppg", "ppt"];

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
        {label} <span>not provided</span>
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

function ConsentBadge({ signed, at, name }: { signed: boolean; at: Date | null; name: string | null }) {
  return signed ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      Signed by {name} on {at?.toLocaleDateString()}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
      Not signed
    </span>
  );
}

export default async function ApplicantReviewPage({
  params,
}: PageProps<"/admin/applicants/[id]">) {
  const { id } = await params;
  const detail = await getApplicantDetail(id);
  const isStaff = !!detail && STAFF_ROLES.has(detail.applicant.role);
  if (!detail || (detail.applicant.role !== "student" && detail.applicant.role !== "pilot" && !isStaff)) {
    notFound();
  }
  const { applicant, pilot, student } = detail;
  const isPending = applicant.accountStatus === "pending_verification";
  const roleNoun =
    applicant.role === "pilot"
      ? "Pilot"
      : applicant.role === "student"
        ? "Student"
        : applicant.role === "cfi"
          ? "Chief Flight Instructor"
          : "Instructor";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar
          userId={applicant.id}
          filename={applicant.profilePictureFile}
          name={applicant.name}
          size={48}
        />
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{applicant.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {roleNoun} {isPending ? "application" : "profile"} &middot; Apex No.{" "}
            {applicant.apexNumber}
            {(pilot?.profile?.sahpaNumber || student?.profile?.sahpaNumber) && (
              <>
                {" "}
                &middot; SACAA No. {pilot?.profile?.sahpaNumber ?? student?.profile?.sahpaNumber}
              </>
            )}
            {" "}&middot; submitted {applicant.createdAt.toLocaleDateString()}
          </p>
        </div>
      </div>

      {applicant.accountStatus !== "pending_verification" && (
        <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
          Already reviewed -- status: <span className="font-medium">{applicant.accountStatus}</span>
          {applicant.rejectionReason ? ` (${applicant.rejectionReason})` : ""}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Personal details</h2>
        <dl className="divide-y divide-slate-100">
          <Row
            label="Full name"
            value={`${applicant.title ?? ""} ${applicant.name} ${
              applicant.nickname ? `"${applicant.nickname}"` : ""
            }`.trim()}
          />
          <Row label="Initials" value={applicant.initials} />
          <Row label="ID / Passport No." value={applicant.idPassportNumber} />
          <Row label="Date of birth" value={applicant.dob?.toLocaleDateString()} />
          <Row label="Sex" value={applicant.sex} />
          <Row label="Email" value={applicant.email} />
          <Row label="Cell number" value={applicant.phone} />
          <Row label="Alt. contact number" value={applicant.altPhone} />
          <Row label="Next of kin" value={applicant.nokName} />
          <Row label="Next of kin contact" value={applicant.nokContactNo} />
          <Row label="Postal address" value={applicant.postalAddress} />
          <Row label="Home address" value={applicant.homeAddress} />
          <Row label="Club / school" value={applicant.clubName} />
          <Row label="Medical aid" value={applicant.medicalAid} />
          <Row label="Medical aid no." value={applicant.medicalAidNo} />
          <Row label="Blood group" value={applicant.bloodGroup} />
          <Row label="Allergies" value={applicant.allergies} />
        </dl>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Documents</h2>
        <div className="space-y-2">
          <DocLink userId={applicant.id} filename={applicant.idPassportFile} label="ID / Passport copy" />
          <DocLink userId={applicant.id} filename={applicant.profilePictureFile} label="Profile picture" />
          {applicant.role === "pilot" && (
            <DocLink
              userId={applicant.id}
              filename={pilot?.profile.caaLicenceFile ?? null}
              label="Current CAA licence"
            />
          )}
          {applicant.role === "student" && (
            <DocLink
              userId={applicant.id}
              filename={student?.profile.popFile ?? null}
              label="Proof of payment"
            />
          )}
          <DocLink
            userId={applicant.id}
            filename={applicant.flightMedicalCertFile}
            label="Flight medical certificate"
          />
        </div>
        {applicant.role === "student" && student?.profile.invoiceRequestedAt && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This student requested an invoice on{" "}
            {student.profile.invoiceRequestedAt.toLocaleDateString()}.
          </p>
        )}
        <div className="mt-4">
          <AdminProfileEditor
            userId={applicant.id}
            isPilot={applicant.role === "pilot"}
            name={applicant.name}
            idPassportNumber={applicant.idPassportNumber}
            phone={applicant.phone}
            altPhone={applicant.altPhone}
            nokName={applicant.nokName}
            nokContactNo={applicant.nokContactNo}
            postalAddress={applicant.postalAddress}
            homeAddress={applicant.homeAddress}
            clubName={applicant.clubName}
            medicalAid={applicant.medicalAid}
            medicalAidNo={applicant.medicalAidNo}
            bloodGroup={applicant.bloodGroup}
            allergies={applicant.allergies}
            pilot={
              pilot
                ? {
                    callSign: pilot.profile.callSign,
                    sacaaNumber: pilot.profile.sacaaNumber,
                    sahpaNumber: pilot.profile.sahpaNumber,
                    sahpaExpiryDate: pilot.profile.sahpaExpiryDate,
                  }
                : null
            }
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Consent &amp; indemnity</h2>
        <div className="flex flex-wrap gap-3">
          <ConsentBadge
            signed={applicant.consentSigned}
            at={applicant.consentSignedAt}
            name={applicant.consentSignedName}
          />
          <ConsentBadge
            signed={applicant.indemnitySigned}
            at={applicant.indemnitySignedAt}
            name={applicant.indemnitySignedName}
          />
        </div>
        {(applicant.role === "student" || applicant.role === "pilot") &&
          (!applicant.consentSigned || !applicant.indemnitySigned) && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This account is blocked from the rest of the app until both are signed -- they&apos;ll
              see a sign-here screen instead of their dashboard next time they log in (usual for an
              account added directly here rather than through the public sign-up form).
            </p>
          )}
      </div>

      {applicant.role === "student" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Student details</h2>
          <p className="mb-2 text-xs text-slate-500">
            What this student signed up to train toward -- gates which exams they see once
            approved. Adjust it here if it needs correcting before (or after) approval.
          </p>
          <ApplicantTrainingTypeEditor
            studentUserId={applicant.id}
            trainingType={student?.profile.trainingType ?? null}
          />
        </div>
      )}

      {(applicant.role === "pilot" || isStaff) && pilot && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            {isStaff ? "Pilot side (also a pilot)" : "Pilot details"}
          </h2>
          <dl className="divide-y divide-slate-100">
            <Row label="Call sign (self-declared)" value={pilot.profile.callSign} />
            <Row label="SACAA License No." value={pilot.profile.sahpaNumber} />
            <Row label="SACAA License expiry" value={pilot.profile.sahpaExpiryDate?.toLocaleDateString()} />
          </dl>

          {/* Ladder + flat-list Verify/Decline controls used to be gated to
             accountStatus === "active" (only shown after first approval) --
             changed 20 Sep 2026 (Notes4 item 11) so a CFI/Admin can verify,
             decline, or grant ratings during the initial review too, not
             just after approving the account. */}
          <div className="mt-4 space-y-3">
            <h3 className="text-sm font-medium text-slate-700">
              Ratings &amp; progress (CAR Part 106 ladder)
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ALL_EQUIPMENT.map((eq) => (
                <LadderTiers
                  key={eq}
                  equipmentLabel={EQUIPMENT_LABELS[eq]}
                  tiers={computeLadder(eq, pilot.endorsements)}
                  actionFor={(t) => {
                    const row = pilot.endorsements.find((e) => e.key === t.key);
                    if (!row) return null;
                    return (
                      <PilotEndorsementToggle
                        endorsementId={row.id}
                        verified={row.verified}
                        declined={row.declined}
                      />
                    );
                  }}
                />
              ))}
            </div>
          </div>

          {/* Three-column PG/PPG/PPT grid with built-in mutual exclusivity
             (Notes4 item 15) -- replaces the flat checkbox/Apply/Grant list
             for just this one group, which let a pilot end up with
             contradictory state like both Grade C and Grade A declared at
             once. Always shown (not gated on anything already declared) so
             a CFI can set it from scratch, e.g. right after promoting a
             pilot to instructor. */}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <h3 className="mb-1 text-sm font-medium text-slate-700">Instructor ratings</h3>
            <InstructorRatingsGrid
              pilotProfileId={pilot.profile.id}
              applicantUserId={applicant.id}
              endorsements={pilot.endorsements.filter((e) => isInstructorRatingKey(e.key))}
            />
            <p className="mt-2 text-[11px] text-slate-400">{INSTRUCTOR_RATING_REFERENCE_TEXT}</p>
          </div>

          <p className="mb-1 mt-4 text-sm font-medium text-slate-700">
            Declared licences &amp; add-ons
          </p>
          {/* Ladder-tier and instructor-rating items are excluded here --
             they each get their own dedicated control above (the ladder
             section and the instructor-ratings grid respectively), so
             listing them a second time here would give a reviewer two
             separate controls for the same underlying row. */}
          {(() => {
            const nonLadderEndorsements = pilot.endorsements.filter(
              (e) => !isLadderTierKey(e.key) && !isInstructorRatingKey(e.key)
            );
            return nonLadderEndorsements.length === 0 ? (
              <p className="text-sm text-slate-400">None declared.</p>
            ) : (
              <div className="space-y-2">
                {groupEndorsementItems(nonLadderEndorsements).map(({ group, items }) => (
                <div key={group}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {group}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {items.map((e) => (
                      <span
                        key={e.id}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                          e.verified
                            ? "bg-green-100 text-green-800"
                            : e.declined
                              ? "bg-red-100 text-red-800"
                              : "bg-slate-100 text-slate-600"
                        }`}
                        title={e.declined && e.declineReason ? `Declined: ${e.declineReason}` : undefined}
                      >
                        {e.label} {e.verified ? "✓" : e.declined ? "✕" : ""}
                        <PilotEndorsementToggle
                          endorsementId={e.id}
                          verified={e.verified}
                          declined={e.declined}
                        />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              </div>
            );
          })()}

          {/* Grant a rating the pilot never self-declared (Notes4 item 11,
             the Henna Fourie case) -- everything above only lets a reviewer
             verify/decline what the pilot already applied for. Instructor-
             rating keys are excluded -- the grid above is how those get
             granted now. */}
          {(() => {
            const declaredKeys = new Set(pilot.endorsements.map((e) => e.key));
            const notYetDeclared = ENDORSEMENT_OPTIONS.filter(
              (o) => !declaredKeys.has(o.key) && !isInstructorRatingKey(o.key)
            );
            if (notYetDeclared.length === 0) return null;
            return (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-1 text-sm font-medium text-slate-700">Grant a rating</p>
                <p className="mb-2 text-xs text-slate-500">
                  For a rating this pilot holds but didn&apos;t declare at sign-up -- adds it
                  and marks it verified in one step.
                </p>
                <div className="space-y-2">
                  {groupEndorsementItems(notYetDeclared.map((o) => ({ key: o.key }))).map(
                    ({ group, items }) => (
                      <div key={group}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {group}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {items.map((item) => (
                            <AdminGrantEndorsement
                              key={item.key}
                              pilotProfileId={pilot.profile.id}
                              applicantUserId={applicant.id}
                              endorsementKey={item.key}
                              label={item.label}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {applicant.accountStatus === "pending_verification" && (
        <ApplicantReviewActions
          userId={applicant.id}
          endorsementKeys={pilot?.endorsements.map((e) => e.key) ?? []}
        />
      )}
    </div>
  );
}
