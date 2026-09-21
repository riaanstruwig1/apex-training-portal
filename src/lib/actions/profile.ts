"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as z from "zod";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users, studentProfiles, pilotProfiles } from "@/db/schema";
import { getCurrentUser, requireAdminOrCFI } from "@/lib/auth/dal";
import { saveUpload, UploadError } from "@/lib/uploads";

// Fields every role can edit about themselves (Notes3 items 2 & 4 -- pilot
// and student self-editing). Deliberately excludes name/email/DOB/ID-
// passport number: those are identity-bearing and stay admin/CFI-only (see
// adminUpdateProfile below), same reasoning as why the sign-up review page
// never let an applicant re-declare their own ID number after submitting.
const SharedProfileSchema = z.object({
  phone: z.string().trim().optional(),
  altPhone: z.string().trim().optional(),
  nokName: z.string().trim().optional(),
  nokContactNo: z.string().trim().optional(),
  postalAddress: z.string().trim().optional(),
  homeAddress: z.string().trim().optional(),
  clubName: z.string().trim().optional(),
  // Medical details (Notes4 item 19) -- shared across every role, same as
  // next-of-kin above.
  medicalAid: z.string().trim().optional(),
  medicalAidNo: z.string().trim().optional(),
  bloodGroup: z.string().trim().optional(),
  allergies: z.string().trim().optional(),
});

// Pilot-only fields, self-declared at sign-up and now editable afterward
// too (previously read-only outside sign-up -- see Notes3 item 2).
const PilotOnlyProfileSchema = z.object({
  callSign: z.string().trim().toUpperCase().optional(),
  sacaaNumber: z.string().trim().optional(),
  sahpaNumber: z.string().trim().optional(),
  sahpaExpiryDate: z.string().trim().optional(),
});

export type ProfileFormState = { error: string; success?: never } | { error?: never; success: true } | undefined;

/** Pilot or student updating their own profile -- contact/personal details,
 * a replacement profile picture, and (pilot only) call sign / SACAA details
 * + a replacement CAA licence upload. */
export async function updateOwnProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired -- please sign in again." };
  if (user.role !== "student" && user.role !== "pilot" && user.role !== "cfi" && user.role !== "instructor") {
    return { error: "Not available for this account type." };
  }

  const shared = SharedProfileSchema.safeParse({
    phone: formData.get("phone") || undefined,
    altPhone: formData.get("altPhone") || undefined,
    nokName: formData.get("nokName") || undefined,
    nokContactNo: formData.get("nokContactNo") || undefined,
    postalAddress: formData.get("postalAddress") || undefined,
    homeAddress: formData.get("homeAddress") || undefined,
    clubName: formData.get("clubName") || undefined,
    medicalAid: formData.get("medicalAid") || undefined,
    medicalAidNo: formData.get("medicalAidNo") || undefined,
    bloodGroup: formData.get("bloodGroup") || undefined,
    allergies: formData.get("allergies") || undefined,
  });
  if (!shared.success) {
    return { error: shared.error.issues[0]?.message ?? "Invalid input." };
  }

  // Each upload succeeds or fails on its own -- previously one bad file
  // (e.g. an unconvertible HEIC on flightMedicalCertFile) threw and aborted
  // the whole db.update below, silently discarding a profilePictureFile
  // that had already saved to disk successfully in the same submit (Notes4
  // item 30: "profile picture not displaying" -- the most likely cause
  // found on investigation 20 Sep 2026, since a plain single-file upload
  // reproduces fine). uploadErrors collects failures to report without
  // losing whatever did succeed.
  const uploadErrors: string[] = [];
  const currentUserId = user.id;
  async function tryUpload(field: string, input: FormDataEntryValue | null): Promise<string | null> {
    if (!(input instanceof File) || input.size === 0) return null;
    try {
      return await saveUpload(currentUserId, field, input);
    } catch (err) {
      uploadErrors.push(err instanceof UploadError ? err.message : `${field}: upload failed.`);
      return null;
    }
  }

  const profilePictureFile = await tryUpload("profile-picture", formData.get("profilePictureFile"));
  const flightMedicalCertFile = await tryUpload(
    "flight-medical-cert",
    formData.get("flightMedicalCertFile")
  );
  // Signature: deliberately only ever written here, in the self-service
  // path, keyed off the CURRENT user's own id -- never in
  // adminUpdateProfile below. Nobody, including a CFI/Admin editing this
  // same person's profile, can set or replace someone else's signature.
  // See src/app/api/signature/[userId]/route.ts for the matching
  // owner-only read side.
  const signatureFile = await tryUpload("signature", formData.get("signatureFile"));

  await db
    .update(users)
    .set({
      phone: shared.data.phone || null,
      altPhone: shared.data.altPhone || null,
      nokName: shared.data.nokName || null,
      nokContactNo: shared.data.nokContactNo || null,
      postalAddress: shared.data.postalAddress || null,
      homeAddress: shared.data.homeAddress || null,
      clubName: shared.data.clubName || null,
      medicalAid: shared.data.medicalAid || null,
      medicalAidNo: shared.data.medicalAidNo || null,
      bloodGroup: shared.data.bloodGroup || null,
      allergies: shared.data.allergies || null,
      ...(profilePictureFile ? { profilePictureFile } : {}),
      ...(flightMedicalCertFile ? { flightMedicalCertFile } : {}),
      ...(signatureFile ? { signatureFile } : {}),
    })
    .where(eq(users.id, user.id));

  // A pilot (or a cfi/instructor who also carries a linked pilot profile)
  // can additionally update their pilot-specific fields and re-upload
  // their CAA licence.
  if (user.role === "pilot" || user.role === "cfi" || user.role === "instructor") {
    const [pilotProfile] = await db
      .select({ id: pilotProfiles.id })
      .from(pilotProfiles)
      .where(eq(pilotProfiles.userId, user.id))
      .limit(1);

    if (pilotProfile) {
      const pilotOnly = PilotOnlyProfileSchema.safeParse({
        callSign: formData.get("callSign") || undefined,
        sacaaNumber: formData.get("sacaaNumber") || undefined,
        sahpaNumber: formData.get("sahpaNumber") || undefined,
        sahpaExpiryDate: formData.get("sahpaExpiryDate") || undefined,
      });
      if (!pilotOnly.success) {
        return { error: pilotOnly.error.issues[0]?.message ?? "Invalid input." };
      }
      const caaLicenceFile = await tryUpload("caa-licence", formData.get("caaLicenceFile"));

      await db
        .update(pilotProfiles)
        .set({
          callSign: pilotOnly.data.callSign || null,
          sacaaNumber: pilotOnly.data.sacaaNumber || null,
          sahpaNumber: pilotOnly.data.sahpaNumber || null,
          sahpaExpiryDate: pilotOnly.data.sahpaExpiryDate
            ? new Date(pilotOnly.data.sahpaExpiryDate)
            : null,
          ...(caaLicenceFile ? { caaLicenceFile } : {}),
        })
        .where(eq(pilotProfiles.userId, user.id));
    }
  }

  if (uploadErrors.length > 0) {
    return { error: uploadErrors.join(" ") };
  }

  revalidatePath("/pilot");
  revalidatePath("/pilot/profile");
  revalidatePath("/student");
  revalidatePath("/student/profile");
  return { success: true };
}

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Enter your current password." }),
    newPassword: z.string().min(8, { error: "New password must be at least 8 characters." }),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "New passwords do not match.",
    path: ["confirmPassword"],
  });

export type ChangePasswordState = { error: string; success?: never } | { error?: never; success: true } | undefined;

/** Self-service password change for any signed-in user -- current password
 * required, no email involved (this app has no outbound email provider
 * yet, see the project status doc). For a locked-out user who can't sign
 * in to reach this form, see adminResetPassword below instead. */
export async function changeOwnPassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Your session has expired -- please sign in again." };

  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row?.passwordHash) {
    return { error: "No password set on this account yet -- contact your CFI or Admin." };
  }
  const matches = await bcrypt.compare(parsed.data.currentPassword, row.passwordHash);
  if (!matches) {
    return { error: "Current password is incorrect." };
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

  return { success: true };
}

// ---------------------------------------------------------------------------
// Admin/CFI editing someone else's profile (Notes3 items 2 & 5: "admin
// ability to edit or add" a pilot/student's own declared details and
// documents, not just verify what they submitted).
// ---------------------------------------------------------------------------

const AdminProfileSchema = SharedProfileSchema.extend({
  name: z.string().trim().min(1, { error: "Name can't be empty." }).optional(),
  idPassportNumber: z.string().trim().optional(),
}).merge(PilotOnlyProfileSchema.partial());

export type AdminProfileState = { error: string; success?: never } | { error?: never; success: true } | undefined;

export async function adminUpdateProfile(
  targetUserId: string,
  _prevState: AdminProfileState,
  formData: FormData
): Promise<AdminProfileState> {
  await requireAdminOrCFI();

  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!target) return { error: "Applicant not found." };

  const parsed = AdminProfileSchema.safeParse({
    name: formData.get("name") || undefined,
    idPassportNumber: formData.get("idPassportNumber") || undefined,
    phone: formData.get("phone") || undefined,
    altPhone: formData.get("altPhone") || undefined,
    nokName: formData.get("nokName") || undefined,
    nokContactNo: formData.get("nokContactNo") || undefined,
    postalAddress: formData.get("postalAddress") || undefined,
    homeAddress: formData.get("homeAddress") || undefined,
    clubName: formData.get("clubName") || undefined,
    medicalAid: formData.get("medicalAid") || undefined,
    medicalAidNo: formData.get("medicalAidNo") || undefined,
    bloodGroup: formData.get("bloodGroup") || undefined,
    allergies: formData.get("allergies") || undefined,
    callSign: formData.get("callSign") || undefined,
    sacaaNumber: formData.get("sacaaNumber") || undefined,
    sahpaNumber: formData.get("sahpaNumber") || undefined,
    sahpaExpiryDate: formData.get("sahpaExpiryDate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // See the matching comment in updateOwnProfile above: each upload now
  // succeeds or fails independently so one bad file can't silently discard
  // another that already saved to disk (Notes4 item 30).
  const uploadErrors: string[] = [];
  async function tryUpload(field: string, input: FormDataEntryValue | null): Promise<string | null> {
    if (!(input instanceof File) || input.size === 0) return null;
    try {
      return await saveUpload(targetUserId, field, input);
    } catch (err) {
      uploadErrors.push(err instanceof UploadError ? err.message : `${field}: upload failed.`);
      return null;
    }
  }

  const profilePictureFile = await tryUpload("profile-picture", formData.get("profilePictureFile"));
  const idPassportFile = await tryUpload("id-passport", formData.get("idPassportFile"));
  const flightMedicalCertFile = await tryUpload(
    "flight-medical-cert",
    formData.get("flightMedicalCertFile")
  );

  await db
    .update(users)
    .set({
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      idPassportNumber: parsed.data.idPassportNumber || null,
      phone: parsed.data.phone || null,
      altPhone: parsed.data.altPhone || null,
      nokName: parsed.data.nokName || null,
      nokContactNo: parsed.data.nokContactNo || null,
      postalAddress: parsed.data.postalAddress || null,
      homeAddress: parsed.data.homeAddress || null,
      clubName: parsed.data.clubName || null,
      medicalAid: parsed.data.medicalAid || null,
      medicalAidNo: parsed.data.medicalAidNo || null,
      bloodGroup: parsed.data.bloodGroup || null,
      allergies: parsed.data.allergies || null,
      ...(profilePictureFile ? { profilePictureFile } : {}),
      ...(idPassportFile ? { idPassportFile } : {}),
      ...(flightMedicalCertFile ? { flightMedicalCertFile } : {}),
    })
    .where(eq(users.id, targetUserId));

  if (target.role === "pilot" || target.role === "cfi" || target.role === "instructor") {
    const caaLicenceFile = await tryUpload("caa-licence", formData.get("caaLicenceFile"));

    await db
      .update(pilotProfiles)
      .set({
        callSign: parsed.data.callSign || null,
        sacaaNumber: parsed.data.sacaaNumber || null,
        sahpaNumber: parsed.data.sahpaNumber || null,
        sahpaExpiryDate: parsed.data.sahpaExpiryDate
          ? new Date(parsed.data.sahpaExpiryDate)
          : null,
        ...(caaLicenceFile ? { caaLicenceFile } : {}),
      })
      .where(eq(pilotProfiles.userId, targetUserId));
  }

  if (uploadErrors.length > 0) {
    return { error: uploadErrors.join(" ") };
  }

  revalidatePath(`/admin/applicants/${targetUserId}`);
  revalidatePath(`/instructor/students/${targetUserId}`);
  return { success: true };
}

/**
 * Resets a locked-out user's password to a freshly generated one, shown
 * once so the CFI/Admin can hand it over (call, message, in person) -- this
 * app has no outbound email provider yet (see the status doc), so there's
 * no "reset link" to send; this is the pragmatic stand-in until one exists.
 */
export async function adminResetPassword(
  targetUserId: string
): Promise<{ error: string; tempPassword?: never } | { error?: never; tempPassword: string }> {
  await requireAdminOrCFI();

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!target) return { error: "Account not found." };

  // 10 random base32-ish characters -- easy to read/type over a phone call,
  // long enough not to be guessable.
  const tempPassword = randomBytes(8)
    .toString("base64")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 10);
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, targetUserId));

  return { tempPassword };
}

/** Student self-editing their own profile -- same shared fields as
 * updateOwnProfile, kept separate only so student-specific fields (SAHPA
 * No., call sign, training type) stay CFI-controlled, matching the
 * existing instructor-side editor; this action never touches
 * studentProfiles at all, just the shared users fields + picture. */
export async function updateOwnStudentProfile(
  prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return { error: "Not available for this account type." };
  }
  // studentProfiles.phone exists too (kept in sync for older call sites
  // that read it from there instead of the shared users.phone column).
  const result = await updateOwnProfile(prevState, formData);
  if (result?.success) {
    const phone = formData.get("phone");
    if (typeof phone === "string") {
      await db
        .update(studentProfiles)
        .set({ phone: phone.trim() || null })
        .where(eq(studentProfiles.userId, user.id));
    }
  }
  return result;
}
