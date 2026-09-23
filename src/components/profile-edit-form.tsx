"use client";

import { useActionState } from "react";
import Avatar from "@/components/avatar";
import PasswordInput from "@/components/password-input";
import MedicalDeclarationForm from "@/components/medical-declaration-form";
import {
  updateOwnProfile,
  updateOwnStudentProfile,
  changeOwnPassword,
  type ProfileFormState,
  type ChangePasswordState,
} from "@/lib/actions/profile";
import { medicalDeclarationEligibility } from "@/lib/medical";

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
const labelClass = "block text-sm font-medium text-slate-700";

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function ProfileEditForm({
  role,
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
  dob,
  medicalDeclarationSignedAt,
  medicalDeclarationSignedName,
  medicalDeclarationExpiresAt,
  signatureFile,
  pilot,
}: {
  role: "student" | "pilot" | "cfi" | "instructor";
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
  medicalAid?: string | null;
  medicalAidNo?: string | null;
  bloodGroup?: string | null;
  allergies?: string | null;
  flightMedicalCertFile?: string | null;
  dob?: Date | null;
  medicalDeclarationSignedAt?: Date | null;
  medicalDeclarationSignedName?: string | null;
  medicalDeclarationExpiresAt?: Date | null;
  signatureFile?: string | null;
  pilot?: {
    callSign: string | null;
    sacaaNumber: string | null;
    sahpaNumber: string | null;
    sahpaExpiryDate: Date | null;
  } | null;
}) {
  const action = role === "student" ? updateOwnStudentProfile : updateOwnProfile;
  const medicalEligibility = medicalDeclarationEligibility(dob ?? null);
  const [state, formAction, isPending] = useActionState<ProfileFormState, FormData>(
    action,
    undefined
  );
  const [pwState, pwAction, pwPending] = useActionState<ChangePasswordState, FormData>(
    changeOwnPassword,
    undefined
  );

  return (
    <div className="space-y-6">
      <form id="profileEditForm" action={formAction} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-4">
          <Avatar userId={userId} filename={profilePictureFile} name={name} size={56} />
          <div className="flex-1">
            <label htmlFor="profilePictureFile" className={labelClass}>
              Profile picture
            </label>
            <input
              id="profilePictureFile"
              name="profilePictureFile"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="phone" label="Cell number">
            <input id="phone" name="phone" defaultValue={phone ?? ""} className={inputClass} />
          </Field>
          <Field id="altPhone" label="Alt. contact number">
            <input id="altPhone" name="altPhone" defaultValue={altPhone ?? ""} className={inputClass} />
          </Field>
          <Field id="nokName" label="Next of kin">
            <input id="nokName" name="nokName" defaultValue={nokName ?? ""} className={inputClass} />
          </Field>
          <Field id="nokContactNo" label="Next of kin contact">
            <input
              id="nokContactNo"
              name="nokContactNo"
              defaultValue={nokContactNo ?? ""}
              className={inputClass}
            />
          </Field>
          <Field id="postalAddress" label="Postal address">
            <input
              id="postalAddress"
              name="postalAddress"
              defaultValue={postalAddress ?? ""}
              className={inputClass}
            />
          </Field>
          <Field id="homeAddress" label="Home address">
            <input
              id="homeAddress"
              name="homeAddress"
              defaultValue={homeAddress ?? ""}
              className={inputClass}
            />
          </Field>
          <Field id="clubName" label="Club / school">
            <input id="clubName" name="clubName" defaultValue={clubName ?? ""} className={inputClass} />
          </Field>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Medical</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="medicalAid" label="Medical aid">
              <input
                id="medicalAid"
                name="medicalAid"
                defaultValue={medicalAid ?? ""}
                className={inputClass}
              />
            </Field>
            <Field id="medicalAidNo" label="Medical aid no.">
              <input
                id="medicalAidNo"
                name="medicalAidNo"
                defaultValue={medicalAidNo ?? ""}
                className={inputClass}
              />
            </Field>
            <Field id="bloodGroup" label="Blood group">
              <input
                id="bloodGroup"
                name="bloodGroup"
                defaultValue={bloodGroup ?? ""}
                className={inputClass}
              />
            </Field>
            <Field id="allergies" label="Allergies">
              <input
                id="allergies"
                name="allergies"
                defaultValue={allergies ?? ""}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-700">Flight medical certificate</p>
            <p className="mt-1 text-xs">
              <a
                href="/documents/sahpa-medical-fitness-r62-22.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-red-600 underline hover:text-red-700"
              >
                View / download the blank form
              </a>{" "}
              <span className="text-slate-500">-- the official SAHPA Appendix R62.22.</span>
            </p>

            {medicalEligibility.eligible ? (
              <>
                <MedicalDeclarationForm
                  name={name}
                  signatureFile={signatureFile}
                  signedAt={medicalDeclarationSignedAt ?? null}
                  signedName={medicalDeclarationSignedName ?? null}
                  expiresAt={medicalDeclarationExpiresAt ?? null}
                />
                <p className="mt-3 text-xs text-slate-500">
                  Or, if you&rsquo;d rather not sign online:
                </p>
              </>
            ) : (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {medicalEligibility.reason === "over_60"
                  ? "Because you're 60 or over, SAHPA requires this form to be signed by a medical practitioner (the Medical Practitioner's Declaration section overleaf) -- online self-declaration isn't available. Download the form above, get it signed, then upload the signed copy below."
                  : "We don't have your date of birth on file, so we can't confirm whether online self-declaration is available to you -- download the form above, get it signed, then upload the signed copy below."}
              </p>
            )}

            <div className="mt-2">
              <label htmlFor="flightMedicalCertFile" className="block text-xs font-medium text-slate-700">
                {flightMedicalCertFile ? "Replace uploaded copy" : "Upload a signed copy"}
              </label>
              <input
                id="flightMedicalCertFile"
                name="flightMedicalCertFile"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              {flightMedicalCertFile && (
                <p className="mt-1 text-xs text-slate-400">A copy is already on file.</p>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-900">Saved signature</h3>
          <p className="mt-1 text-xs text-slate-500">
            Upload an image of your signature once, and it&rsquo;s offered back to you automatically
            next time you need to sign a form under your own login -- no need to re-upload it every
            time. This is yours only: no one else, including CFIs and Admin, can view it, download
            it, or use it -- not even to sign on your behalf. It&rsquo;s kept in a protected vault
            for your account alone.
          </p>
          <div className="mt-2 flex items-center gap-4">
            {signatureFile && (
              <img
                src={`/api/signature?v=${encodeURIComponent(signatureFile)}`}
                alt="Your saved signature"
                className="h-12 max-w-[12rem] rounded border border-slate-200 bg-white object-contain p-1"
              />
            )}
            <div className="flex-1">
              <label htmlFor="signatureFile" className={labelClass}>
                {signatureFile ? "Replace signature" : "Upload signature"}
              </label>
              <input
                id="signatureFile"
                name="signatureFile"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>
          </div>
        </div>

        {pilot && (
          <div className="border-t border-slate-100 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Pilot details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="callSign" label="Call sign (self-declared)">
                <input
                  id="callSign"
                  name="callSign"
                  defaultValue={pilot.callSign ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field id="sacaaNumber" label="SACAA No.">
                <input
                  id="sacaaNumber"
                  name="sacaaNumber"
                  defaultValue={pilot.sacaaNumber ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field id="sahpaNumber" label="SAHPA Membership No.">
                <input
                  id="sahpaNumber"
                  name="sahpaNumber"
                  defaultValue={pilot.sahpaNumber ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field id="sahpaExpiryDate" label="SAHPA membership expiry">
                <input
                  id="sahpaExpiryDate"
                  name="sahpaExpiryDate"
                  type="date"
                  defaultValue={
                    pilot.sahpaExpiryDate
                      ? pilot.sahpaExpiryDate.toISOString().slice(0, 10)
                      : ""
                  }
                  className={inputClass}
                />
              </Field>
              <Field id="caaLicenceFile" label="Current CAA licence (replace)">
                <input
                  id="caaLicenceFile"
                  name="caaLicenceFile"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                />
              </Field>
            </div>
          </div>
        )}

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state?.success && <p className="text-sm font-medium text-green-700">Saved.</p>}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save changes"}
        </button>
      </form>

      <form action={pwAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-900">Change password</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field id="currentPassword" label="Current password">
            <PasswordInput
              id="currentPassword"
              name="currentPassword"
              required
              className={inputClass}
            />
          </Field>
          <Field id="newPassword" label="New password">
            <PasswordInput
              id="newPassword"
              name="newPassword"
              required
              minLength={8}
              className={inputClass}
            />
          </Field>
          <Field id="confirmPassword" label="Confirm new password">
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              required
              minLength={8}
              className={inputClass}
            />
          </Field>
        </div>
        {pwState?.error && <p className="text-sm text-red-600">{pwState.error}</p>}
        {pwState?.success && (
          <p className="text-sm font-medium text-green-700">Password changed.</p>
        )}
        <button
          type="submit"
          disabled={pwPending}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {pwPending ? "Saving..." : "Change password"}
        </button>
      </form>
    </div>
  );
}
