"use client";

import { useActionState, useState } from "react";
import { submitSignup, type SignupState } from "@/lib/actions/signup";
import { ENDORSEMENT_OPTIONS } from "@/lib/pilot-endorsements";
import PasswordInput from "@/components/password-input";

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";
const labelClass = "block text-sm font-medium text-slate-700";

const TEXT_FIELDS = [
  "title",
  "firstName",
  "surname",
  "initials",
  "nickname",
  "idPassportNumber",
  "dob",
  "sex",
  "email",
  "phone",
  "altPhone",
  "clubName",
  "postalAddress",
  "homeAddress",
  "nokName",
  "nokContactNo",
  "password",
  "confirmPassword",
  "callSign",
  "sacaaNumber",
  "sahpaNumber",
  "sahpaExpiryDate",
  "caaLicenceExpiryDate",
  "startingFlightCount",
  "startingFlightHours",
  "consentName",
  "indemnityName",
] as const;
type TextFieldName = (typeof TEXT_FIELDS)[number];

const emptyValues: Record<TextFieldName, string> = Object.fromEntries(
  TEXT_FIELDS.map((f) => [f, ""])
) as Record<TextFieldName, string>;

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(
    submitSignup,
    undefined
  );
  const [accountType, setAccountType] = useState<"student" | "pilot">("student");
  const [trainingType, setTrainingType] = useState<"pg" | "ppg" | "ppt" | "">("");
  // Everything except the file inputs is controlled from here, so a failed
  // submission (e.g. "email already exists") never wipes what the applicant
  // already typed -- only the email/password need fixing, not the whole form.
  // Browsers never let JS refill a <input type="file"> after a submit for
  // security reasons, so those two are the one thing that still needs
  // re-selecting -- true of every site, not something we can work around.
  const [values, setValues] = useState<Record<TextFieldName, string>>(emptyValues);
  const [endorsements, setEndorsements] = useState<Set<string>>(new Set());

  const set = (field: TextFieldName) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setValues((prev) => ({ ...prev, [field]: e.target.value }));

  const toggleEndorsement = (key: string) => {
    setEndorsements((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const groupedEndorsements = ENDORSEMENT_OPTIONS.reduce<Record<string, typeof ENDORSEMENT_OPTIONS>>(
    (acc, opt) => {
      (acc[opt.group] ??= []).push(opt);
      return acc;
    },
    {}
  );

  return (
    <form action={action} className="space-y-6">
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className={`${labelClass} mb-2`}>I&apos;m signing up as a...</legend>
        {(["student", "pilot"] as const).map((type) => (
          <label
            key={type}
            className={`cursor-pointer rounded-md border px-3 py-3 text-center text-sm font-medium capitalize ${
              accountType === type
                ? "border-red-500 bg-red-50 text-red-700"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="accountType"
              value={type}
              checked={accountType === type}
              onChange={() => setAccountType(type)}
              className="sr-only"
            />
            {type === "student" ? "New Student" : "Licensed Pilot / Club Member"}
          </label>
        ))}
      </fieldset>

      {accountType === "student" && (
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <h2 className="text-sm font-semibold text-slate-900">Training</h2>
          <Field id="trainingType" label="What training are you signing up for?" required>
            <select
              id="trainingType"
              name="trainingType"
              value={trainingType}
              onChange={(e) => setTrainingType(e.target.value as typeof trainingType)}
              required={accountType === "student"}
              className={inputClass}
            >
              <option value="" disabled>
                Select...
              </option>
              <option value="pg">Paraglider (PG)</option>
              <option value="ppg">Powered Paragliding (PPG)</option>
              <option value="ppt">Powered Paratrike (PPT)</option>
            </select>
          </Field>
        </div>
      )}

      <div className="space-y-4 border-t border-slate-200 pt-4">
        <h2 className="text-sm font-semibold text-slate-900">Personal details</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field id="title" label="Title">
            <input id="title" name="title" value={values.title} onChange={set("title")} className={inputClass} placeholder="Mr / Ms / Dr" />
          </Field>
          <Field id="firstName" label="First name" required>
            <input id="firstName" name="firstName" value={values.firstName} onChange={set("firstName")} required className={inputClass} />
          </Field>
          <Field id="surname" label="Surname" required>
            <input id="surname" name="surname" value={values.surname} onChange={set("surname")} required className={inputClass} />
          </Field>
          <Field id="initials" label="Initials">
            <input id="initials" name="initials" value={values.initials} onChange={set("initials")} className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field id="nickname" label="Nickname">
            <input id="nickname" name="nickname" value={values.nickname} onChange={set("nickname")} className={inputClass} />
          </Field>
          <Field id="idPassportNumber" label="ID / Passport number" required>
            <input id="idPassportNumber" name="idPassportNumber" value={values.idPassportNumber} onChange={set("idPassportNumber")} required className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field id="dob" label="Date of birth" required>
            <input id="dob" name="dob" type="date" value={values.dob} onChange={set("dob")} required className={inputClass} />
          </Field>
          <Field id="sex" label="Sex">
            <select id="sex" name="sex" value={values.sex} onChange={set("sex")} className={inputClass}>
              <option value="" disabled>
                Select...
              </option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-200 pt-4">
        <h2 className="text-sm font-semibold text-slate-900">Contact details</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field id="email" label="Email" required>
            <input id="email" name="email" type="email" value={values.email} onChange={set("email")} required className={inputClass} />
          </Field>
          <Field id="phone" label="Cell number" required>
            <input id="phone" name="phone" value={values.phone} onChange={set("phone")} required className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field id="altPhone" label="Alternative contact number">
            <input id="altPhone" name="altPhone" value={values.altPhone} onChange={set("altPhone")} className={inputClass} />
          </Field>
          <Field id="clubName" label="Club / school name (if any)">
            <input id="clubName" name="clubName" value={values.clubName} onChange={set("clubName")} className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field id="postalAddress" label="Postal address">
            <textarea id="postalAddress" name="postalAddress" rows={2} value={values.postalAddress} onChange={set("postalAddress")} className={inputClass} />
          </Field>
          <Field id="homeAddress" label="Home address">
            <textarea id="homeAddress" name="homeAddress" rows={2} value={values.homeAddress} onChange={set("homeAddress")} className={inputClass} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field id="nokName" label="Next of kin -- name" required>
            <input id="nokName" name="nokName" value={values.nokName} onChange={set("nokName")} required className={inputClass} />
          </Field>
          <Field id="nokContactNo" label="Next of kin -- contact number" required>
            <input id="nokContactNo" name="nokContactNo" value={values.nokContactNo} onChange={set("nokContactNo")} required className={inputClass} />
          </Field>
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-200 pt-4">
        <h2 className="text-sm font-semibold text-slate-900">Account</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field id="password" label="Password" required>
            <PasswordInput
              id="password"
              name="password"
              value={values.password}
              onChange={set("password")}
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>
          <Field id="confirmPassword" label="Confirm password" required>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              value={values.confirmPassword}
              onChange={set("confirmPassword")}
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-4 border-t border-slate-200 pt-4">
        <h2 className="text-sm font-semibold text-slate-900">Documents</h2>
        <Field id="idPassportFile" label="Copy of ID or passport (PDF/JPG/PNG)" required>
          <input
            id="idPassportFile"
            name="idPassportFile"
            type="file"
            required
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm`}
          />
        </Field>
        <Field id="profilePictureFile" label="Profile picture (optional)">
          <input
            id="profilePictureFile"
            name="profilePictureFile"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm`}
          />
        </Field>
        <Field id="signatureFile" label="Signature (optional)">
          <p className="mb-1 text-xs text-slate-500">
            Upload an image of your signature and it&rsquo;s saved for next time -- offered back
            automatically when you need to sign something under your own login, so you don&rsquo;t
            have to type your name every time. Yours only: no one else, including CFIs and Admin,
            can view it, download it, or use it -- kept in a protected vault for your account
            alone. You can still type your name below to sign these two forms now either way.
          </p>
          <input
            id="signatureFile"
            name="signatureFile"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm`}
          />
        </Field>
        {state?.error && (
          <p className="text-xs text-amber-700">
            If you&apos;re re-submitting after an error: your file selections above don&apos;t
            carry over (browsers never let a page refill those for you) -- everything else on
            this form has been kept as you typed it.
          </p>
        )}
      </div>

      {accountType === "pilot" && (
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <h2 className="text-sm font-semibold text-slate-900">Pilot details</h2>
          <p className="text-xs text-slate-500">
            Nothing below is active on your profile until a CFI or Admin verifies it.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field id="callSign" label="Call sign (if already allocated)">
              <input id="callSign" name="callSign" value={values.callSign} onChange={set("callSign")} className={inputClass} />
            </Field>
            <Field id="sacaaNumber" label="SACAA No.">
              <input id="sacaaNumber" name="sacaaNumber" value={values.sacaaNumber} onChange={set("sacaaNumber")} className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field id="sahpaNumber" label="SAHPA Membership No.">
              <input id="sahpaNumber" name="sahpaNumber" value={values.sahpaNumber} onChange={set("sahpaNumber")} className={inputClass} />
            </Field>
            <Field id="sahpaExpiryDate" label="SAHPA membership expiry">
              <input id="sahpaExpiryDate" name="sahpaExpiryDate" type="date" value={values.sahpaExpiryDate} onChange={set("sahpaExpiryDate")} className={inputClass} />
            </Field>
          </div>
          <Field id="caaLicenceFile" label="Current CAA licence (PDF)" required>
            <input
              id="caaLicenceFile"
              name="caaLicenceFile"
              type="file"
              required={accountType === "pilot"}
              accept="application/pdf,image/jpeg,image/png"
              className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm`}
            />
          </Field>
          <Field id="caaLicenceExpiryDate" label="Licence expiry date (from your current licence)">
            <input
              id="caaLicenceExpiryDate"
              name="caaLicenceExpiryDate"
              type="date"
              value={values.caaLicenceExpiryDate}
              onChange={set("caaLicenceExpiryDate")}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field id="startingFlightCount" label="Flights logged before joining (paper logbook)">
              <input
                id="startingFlightCount"
                name="startingFlightCount"
                type="number"
                min="0"
                step="1"
                value={values.startingFlightCount}
                onChange={set("startingFlightCount")}
                className={inputClass}
              />
            </Field>
            <Field id="startingFlightHours" label="Hours logged before joining (paper logbook)">
              <input
                id="startingFlightHours"
                name="startingFlightHours"
                type="number"
                min="0"
                step="0.1"
                value={values.startingFlightHours}
                onChange={set("startingFlightHours")}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="text-xs text-slate-500">
            Leave the two above at 0 if this is your first logbook -- they&rsquo;re only for
            carrying over a total from flights logged before you joined here.
          </p>

          <div>
            <p className={labelClass}>Licence type &amp; endorsements you hold</p>
            <div className="mt-2 space-y-3">
              {Object.entries(groupedEndorsements).map(([group, opts]) => (
                <div key={group}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{group}</p>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                    {opts.map((opt) => (
                      <label key={opt.key} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          name="endorsements"
                          value={opt.key}
                          checked={endorsements.has(opt.key)}
                          onChange={() => toggleEndorsement(opt.key)}
                          className="rounded border-slate-300"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 border-t border-slate-200 pt-4">
        <h2 className="text-sm font-semibold text-slate-900">Consent &amp; indemnity</h2>
        <p className="text-xs text-slate-500">
          Type your full name in each box below to sign electronically -- same legal effect as a
          handwritten signature on these forms.
        </p>
        <Field id="consentName" label="Client Consent Form -- sign by typing your full name" required>
          <p className="mb-1 text-xs">
            <a
              href="/documents/sacaa-client-consent-form.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-red-600 underline hover:text-red-700"
            >
              View / download the document
            </a>{" "}
            <span className="text-slate-500">
              -- the official SACAA CA 183-540 form -- read it before you sign, if you&rsquo;d like to.
            </span>
          </p>
          <input id="consentName" name="consentName" value={values.consentName} onChange={set("consentName")} required className={inputClass} />
        </Field>
        <Field
          id="indemnityName"
          label="Indemnity / Assumption of Risk & Release -- sign by typing your full name"
          required
        >
          <p className="mb-1 text-xs">
            <a
              href="/documents/indemnity-assumption-of-risk.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-red-600 underline hover:text-red-700"
            >
              View / download the document
            </a>{" "}
            <span className="text-slate-500">-- read it before you sign, if you&rsquo;d like to.</span>
          </p>
          <input id="indemnityName" name="indemnityName" value={values.indemnityName} onChange={set("indemnityName")} required className={inputClass} />
        </Field>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        By submitting this application, you confirm the details above are accurate. Apex
        Adventures complies with the Consumer Protection Act (CPA) and the Protection of Personal
        Information Act (POPIA): the personal information you provide here is used only for
        training administration and SACAA/SAHPA compliance, is kept secure, and is never sold or
        shared with third parties without your consent.
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Submitting..." : "Submit application"}
      </button>
    </form>
  );
}
