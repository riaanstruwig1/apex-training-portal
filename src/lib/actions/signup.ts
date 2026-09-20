"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as z from "zod";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, studentProfiles, pilotProfiles, pilotEndorsements } from "@/db/schema";
import { generateApexNumber } from "@/lib/apex-number";
import { saveUpload, UploadError } from "@/lib/uploads";
import { ENDORSEMENT_OPTIONS } from "@/lib/pilot-endorsements";

const SignupSchema = z
  .object({
    accountType: z.enum(["student", "pilot"]),
    title: z.string().trim().optional(),
    firstName: z.string().trim().min(1, { error: "Enter a first name." }),
    surname: z.string().trim().min(1, { error: "Enter a surname." }),
    initials: z.string().trim().optional(),
    nickname: z.string().trim().optional(),
    idPassportNumber: z.string().trim().min(1, { error: "Enter an ID or passport number." }),
    email: z.string().trim().toLowerCase().email({ error: "Enter a valid email address." }),
    password: z.string().min(8, { error: "Password must be at least 8 characters." }),
    confirmPassword: z.string().min(1),
    phone: z.string().trim().min(1, { error: "Enter a cell number." }),
    altPhone: z.string().trim().optional(),
    dob: z.string().trim().min(1, { error: "Enter a date of birth." }),
    sex: z.string().trim().optional(),
    nokName: z.string().trim().min(1, { error: "Enter a next-of-kin name." }),
    nokContactNo: z.string().trim().min(1, { error: "Enter a next-of-kin contact number." }),
    postalAddress: z.string().trim().optional(),
    homeAddress: z.string().trim().optional(),
    clubName: z.string().trim().optional(),
    consentName: z.string().trim().min(1, { error: "Type your full name to sign the consent form." }),
    indemnityName: z.string().trim().min(1, { error: "Type your full name to sign the indemnity/release." }),
    // Student-only
    trainingType: z.enum(["pg", "ppg", "ppt"]).optional(),
    // Pilot-only
    callSign: z.string().trim().optional(),
    sacaaNumber: z.string().trim().optional(),
    sahpaNumber: z.string().trim().optional(),
    sahpaExpiryDate: z.string().trim().optional(),
    endorsements: z.array(z.string()).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.accountType !== "student" || !!data.trainingType, {
    error: "Select what training you're signing up for.",
    path: ["trainingType"],
  });

export type SignupState = { error: string } | undefined;

export async function submitSignup(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const raw = {
    accountType: formData.get("accountType"),
    title: formData.get("title") || undefined,
    firstName: formData.get("firstName"),
    surname: formData.get("surname"),
    initials: formData.get("initials") || undefined,
    nickname: formData.get("nickname") || undefined,
    idPassportNumber: formData.get("idPassportNumber"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    phone: formData.get("phone"),
    altPhone: formData.get("altPhone") || undefined,
    dob: formData.get("dob"),
    sex: formData.get("sex") || undefined,
    nokName: formData.get("nokName"),
    nokContactNo: formData.get("nokContactNo"),
    postalAddress: formData.get("postalAddress") || undefined,
    homeAddress: formData.get("homeAddress") || undefined,
    clubName: formData.get("clubName") || undefined,
    trainingType: formData.get("trainingType") || undefined,
    consentName: formData.get("consentName"),
    indemnityName: formData.get("indemnityName"),
    callSign: formData.get("callSign") || undefined,
    sacaaNumber: formData.get("sacaaNumber") || undefined,
    sahpaNumber: formData.get("sahpaNumber") || undefined,
    sahpaExpiryDate: formData.get("sahpaExpiryDate") || undefined,
    endorsements: formData.getAll("endorsements").map(String),
  };

  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const idPassportFileInput = formData.get("idPassportFile");
  const profilePictureFileInput = formData.get("profilePictureFile");
  const caaLicenceFileInput = formData.get("caaLicenceFile");

  if (!(idPassportFileInput instanceof File) || idPassportFileInput.size === 0) {
    return { error: "Upload a copy of your ID or passport." };
  }
  if (
    data.accountType === "pilot" &&
    (!(caaLicenceFileInput instanceof File) || caaLicenceFileInput.size === 0)
  ) {
    return { error: "Upload a copy of your current CAA licence." };
  }
  const validEndorsementKeys = new Set(ENDORSEMENT_OPTIONS.map((o) => o.key));
  const endorsements = (data.endorsements ?? []).filter((k) => validEndorsementKeys.has(k));

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);
  if (existing) {
    return { error: "An account with that email already exists. Try logging in instead." };
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const apexNumber = await generateApexNumber();

  const [user] = await db
    .insert(users)
    .values({
      email: data.email,
      passwordHash,
      name: `${data.firstName} ${data.surname}`,
      role: data.accountType,
      accountStatus: "pending_verification",
      apexNumber,
      title: data.title || null,
      initials: data.initials || null,
      nickname: data.nickname || null,
      idPassportNumber: data.idPassportNumber,
      dob: new Date(data.dob),
      sex: data.sex || null,
      phone: data.phone,
      altPhone: data.altPhone || null,
      nokName: data.nokName,
      nokContactNo: data.nokContactNo,
      postalAddress: data.postalAddress || null,
      homeAddress: data.homeAddress || null,
      clubName: data.clubName || null,
      consentSigned: true,
      consentSignedAt: new Date(),
      consentSignedName: data.consentName,
      indemnitySigned: true,
      indemnitySignedAt: new Date(),
      indemnitySignedName: data.indemnityName,
    })
    .returning();

  try {
    const idPassportFile = await saveUpload(user.id, "id-passport", idPassportFileInput as File);
    const profilePictureFile = await saveUpload(
      user.id,
      "profile-picture",
      profilePictureFileInput instanceof File ? profilePictureFileInput : null
    );

    await db
      .update(users)
      .set({ idPassportFile, profilePictureFile })
      .where(eq(users.id, user.id));

    if (data.accountType === "student") {
      await db.insert(studentProfiles).values({
        userId: user.id,
        phone: data.phone,
        trainingType: data.trainingType ?? null,
        status: "active", // gating is via users.accountStatus, not this
      });
    } else {
      const caaLicenceFile = await saveUpload(user.id, "caa-licence", caaLicenceFileInput as File);

      const [pilotProfile] = await db
        .insert(pilotProfiles)
        .values({
          userId: user.id,
          callSign: data.callSign || null,
          sacaaNumber: data.sacaaNumber || null,
          sahpaNumber: data.sahpaNumber || null,
          sahpaExpiryDate: data.sahpaExpiryDate ? new Date(data.sahpaExpiryDate) : null,
          caaLicenceFile,
          status: "pending_verification",
        })
        .returning();

      if (endorsements.length > 0) {
        await db.insert(pilotEndorsements).values(
          endorsements.map((key) => ({ pilotProfileId: pilotProfile.id, key }))
        );
      }
    }
  } catch (err) {
    // Roll back the user row so a failed upload doesn't leave a half-created,
    // unrecoverable account sitting in the verification queue.
    await db.delete(users).where(eq(users.id, user.id));
    if (err instanceof UploadError) {
      return { error: err.message };
    }
    throw err;
  }

  redirect("/signup/pending");
}
