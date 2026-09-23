import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireStudent } from "@/lib/auth/dal";
import ProfileView from "@/components/profile-view";

export default async function StudentProfileViewPage() {
  const { user } = await requireStudent();

  const [fullUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">View profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          A read-only look at what&rsquo;s on file. Use Edit profile to make changes.
        </p>
      </div>
      <ProfileView
        role="student"
        editHref="/student/profile"
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
        signatureFile={fullUser?.signatureFile ?? null}
      />
    </div>
  );
}
