import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requirePilot } from "@/lib/auth/dal";
import { getLogbookEntries } from "@/lib/logbook";
import ProfileView from "@/components/profile-view";

export default async function PilotProfileViewPage() {
  const { user, profile } = await requirePilot();

  const [fullUser, entries] = await Promise.all([
    db.select().from(users).where(eq(users.id, user.id)).limit(1).then((rows) => rows[0]),
    getLogbookEntries(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">View profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          A read-only look at what&rsquo;s on file. Use Edit profile to make changes.
        </p>
      </div>
      <ProfileView
        role="pilot"
        editHref="/pilot/profile"
        userId={user.id}
        name={user.name}
        profilePictureFile={fullUser?.profilePictureFile ?? null}
        phone={fullUser?.phone ?? null}
        altPhone={fullUser?.altPhone ?? null}
        nokName={fullUser?.nokName ?? null}
        nokContactNo={fullUser?.nokContactNo ?? null}
        postalAddress={fullUser?.postalAddress ?? null}
        homeAddress={fullUser?.homeAddress ?? null}
        clubName={fullUser?.clubName ?? null}
        medicalAid={fullUser?.medicalAid ?? null}
        medicalAidNo={fullUser?.medicalAidNo ?? null}
        bloodGroup={fullUser?.bloodGroup ?? null}
        allergies={fullUser?.allergies ?? null}
        flightMedicalCertFile={fullUser?.flightMedicalCertFile ?? null}
        medicalDeclarationSignedAt={fullUser?.medicalDeclarationSignedAt ?? null}
        medicalDeclarationSignedName={fullUser?.medicalDeclarationSignedName ?? null}
        medicalDeclarationExpiresAt={fullUser?.medicalDeclarationExpiresAt ?? null}
        consentSigned={fullUser?.consentSigned ?? false}
        consentSignedAt={fullUser?.consentSignedAt ?? null}
        consentSignedName={fullUser?.consentSignedName ?? null}
        indemnitySigned={fullUser?.indemnitySigned ?? false}
        indemnitySignedAt={fullUser?.indemnitySignedAt ?? null}
        indemnitySignedName={fullUser?.indemnitySignedName ?? null}
        signatureFile={fullUser?.signatureFile ?? null}
        pilot={
          profile
            ? {
                callSign: profile.callSign,
                sacaaNumber: profile.sacaaNumber,
                sahpaNumber: profile.sahpaNumber,
                sahpaExpiryDate: profile.sahpaExpiryDate,
                caaLicenceFile: profile.caaLicenceFile,
                caaLicenceExpiryDate: profile.caaLicenceExpiryDate,
                startingFlightCount: profile.startingFlightCount,
                startingFlightHours: profile.startingFlightHours,
                flightLogEntries: entries.map((e) => ({
                  date: e.date,
                  durationMinutes: e.durationMinutes,
                })),
              }
            : null
        }
      />
    </div>
  );
}
