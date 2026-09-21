import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireStudent } from "@/lib/auth/dal";
import ProfileEditForm from "@/components/profile-edit-form";
import PopPaymentPanel from "@/components/pop-payment-panel";

export default async function StudentProfilePage() {
  const { user, profile } = await requireStudent();

  const [fullUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Edit profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Update your contact details and profile picture. Your name, ID/passport number, email,
          call sign, training type and SAHPA No. are set by your CFI -- contact them to correct any
          of those.
        </p>
      </div>
      <ProfileEditForm
        role="student"
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
        signatureFile={fullUser?.signatureFile ?? null}
      />
      <PopPaymentPanel
        popFile={profile?.popFile ?? null}
        popUploadedAt={profile?.popUploadedAt ?? null}
        invoiceRequestedAt={profile?.invoiceRequestedAt ?? null}
      />
    </div>
  );
}
