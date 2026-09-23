"use client";

import { useActionState, useState } from "react";
import { adminUpdateProfile, adminResetPassword, type AdminProfileState } from "@/lib/actions/profile";

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
const labelClass = "block text-sm font-medium text-slate-700";
const fileClass =
  "mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ResetPasswordButton({ userId }: { userId: string }) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleReset() {
    if (
      !confirm(
        "Reset this account's password? They'll need the new temporary password to sign in -- give it to them directly (there's no email to send it to)."
      )
    ) {
      return;
    }
    setIsPending(true);
    setError(null);
    const result = await adminResetPassword(userId);
    setIsPending(false);
    if (result.tempPassword) setTempPassword(result.tempPassword);
    else setError(result.error ?? "Could not reset password.");
  }

  return (
    <div className="rounded-md border border-dashed border-slate-300 p-3">
      <button
        type="button"
        onClick={handleReset}
        disabled={isPending}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {isPending ? "Resetting..." : "Reset password"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {tempPassword && (
        <p className="mt-2 text-xs text-slate-600">
          New temporary password (shown once -- copy it now):{" "}
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-900">
            {tempPassword}
          </span>
        </p>
      )}
    </div>
  );
}

export default function AdminProfileEditor({
  userId,
  isPilot,
  name,
  idPassportNumber,
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
  pilot,
}: {
  userId: string;
  isPilot: boolean;
  name: string;
  idPassportNumber: string | null;
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
  pilot?: {
    callSign: string | null;
    sacaaNumber: string | null;
    sahpaNumber: string | null;
    sahpaExpiryDate: Date | null;
    caaLicenceExpiryDate: Date | null;
    startingFlightCount: number | null;
    startingFlightHours: number | null;
  } | null;
}) {
  const [open, setOpen] = useState(false);
  const boundAction = adminUpdateProfile.bind(null, userId);
  const [state, formAction, isPending] = useActionState<AdminProfileState, FormData>(
    boundAction,
    undefined
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Edit details &amp; documents
      </button>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Edit details &amp; documents</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          Close
        </button>
      </div>
      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="name" label="Full name">
            <input id="name" name="name" defaultValue={name} className={inputClass} />
          </Field>
          <Field id="idPassportNumber" label="ID / Passport No.">
            <input
              id="idPassportNumber"
              name="idPassportNumber"
              defaultValue={idPassportNumber ?? ""}
              className={inputClass}
            />
          </Field>
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

        <div className="border-t border-slate-200 pt-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">Medical</h4>
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
            <Field id="flightMedicalCertFile" label="Flight medical certificate -- uploaded copy (replace)">
              <input
                id="flightMedicalCertFile"
                name="flightMedicalCertFile"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className={fileClass}
              />
              <p className="mt-1 text-xs text-slate-400">
                For the pilot&rsquo;s own online self-declaration (under-60 pilots only), see the
                badge above -- that can only be signed by the account holder, not set here.
              </p>
            </Field>
          </div>
        </div>

        {isPilot && (
          <div className="border-t border-slate-200 pt-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Pilot details</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="callSign" label="Call sign">
                <input
                  id="callSign"
                  name="callSign"
                  defaultValue={pilot?.callSign ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field id="sacaaNumber" label="SACAA No.">
                <input
                  id="sacaaNumber"
                  name="sacaaNumber"
                  defaultValue={pilot?.sacaaNumber ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field id="sahpaNumber" label="SAHPA Membership No.">
                <input
                  id="sahpaNumber"
                  name="sahpaNumber"
                  defaultValue={pilot?.sahpaNumber ?? ""}
                  className={inputClass}
                />
              </Field>
              <Field id="sahpaExpiryDate" label="SAHPA membership expiry">
                <input
                  id="sahpaExpiryDate"
                  name="sahpaExpiryDate"
                  type="date"
                  defaultValue={
                    pilot?.sahpaExpiryDate ? pilot.sahpaExpiryDate.toISOString().slice(0, 10) : ""
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
                  className={fileClass}
                />
              </Field>
              <Field id="caaLicenceExpiryDate" label="Licence expiry date">
                <input
                  id="caaLicenceExpiryDate"
                  name="caaLicenceExpiryDate"
                  type="date"
                  defaultValue={
                    pilot?.caaLicenceExpiryDate
                      ? pilot.caaLicenceExpiryDate.toISOString().slice(0, 10)
                      : ""
                  }
                  className={inputClass}
                />
              </Field>
              <Field id="startingFlightCount" label="Flights logged before joining">
                <input
                  id="startingFlightCount"
                  name="startingFlightCount"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={pilot?.startingFlightCount ?? 0}
                  className={inputClass}
                />
              </Field>
              <Field id="startingFlightHours" label="Hours logged before joining">
                <input
                  id="startingFlightHours"
                  name="startingFlightHours"
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue={pilot?.startingFlightHours ?? 0}
                  className={inputClass}
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Pushing the licence expiry date forward is how you clear a pilot&rsquo;s hard-lock
              screen once you&rsquo;ve reviewed their renewed licence.
            </p>
          </div>
        )}

        <div className="border-t border-slate-200 pt-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">Documents</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="idPassportFile" label="ID / Passport copy (replace)">
              <input
                id="idPassportFile"
                name="idPassportFile"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className={fileClass}
              />
            </Field>
            <Field id="profilePictureFile" label="Profile picture (replace)">
              <input
                id="profilePictureFile"
                name="profilePictureFile"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className={fileClass}
              />
            </Field>
          </div>
        </div>

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

      <div className="border-t border-slate-200 pt-4">
        <h4 className="mb-2 text-sm font-semibold text-slate-900">Account</h4>
        <ResetPasswordButton userId={userId} />
      </div>
    </div>
  );
}
