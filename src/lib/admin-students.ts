import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, studentProfiles } from "@/db/schema";

export type AdminStudentRow = {
  id: string; // user id
  name: string;
  email: string;
  phone: string | null;
  apexNumber: string | null;
  trainingType: string | null;
  /** The confirmed "initial sign-up" date if a CFI/Admin has set one,
   * otherwise the account's creation date (signUpDateConfirmed = false). */
  signUpDate: Date;
  signUpDateConfirmed: boolean;
  sahpaNumber: string | null;
  sahpaExpiryDate: Date | null;
  status: "invited" | "active" | "suspended" | "archived";
  consentComplete: boolean;
  profilePictureFile: string | null;
};

/** Every approved student for the Admin -> Students list (30 Sep 2026).
 * Pending sign-ups stay in the verification queue and rejected ones never
 * show here -- same rule as the CFI's own roster (lib/progress.ts).
 *
 * Deliberately two plain queries merged in code rather than one join:
 * users and student_profiles share column names (phone, created_at,
 * invite_token...), and under this project's drizzle sqlite-proxy setup a
 * join that selects same-named columns from both tables silently shifts
 * values into the wrong fields (see the note in lib/pilots.ts) -- it did
 * exactly that on the first cut of this page. */
export async function getAdminStudentList(): Promise<AdminStudentRow[]> {
  const [userRows, profileRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        apexNumber: users.apexNumber,
        createdAt: users.createdAt,
        consentSigned: users.consentSigned,
        indemnitySigned: users.indemnitySigned,
        profilePictureFile: users.profilePictureFile,
      })
      .from(users)
      .where(and(eq(users.role, "student"), eq(users.accountStatus, "active")))
      .orderBy(users.name),
    db
      .select({
        userId: studentProfiles.userId,
        phone: studentProfiles.phone,
        trainingType: studentProfiles.trainingType,
        signUpDate: studentProfiles.signUpDate,
        sahpaNumber: studentProfiles.sahpaNumber,
        sahpaExpiryDate: studentProfiles.sahpaExpiryDate,
        status: studentProfiles.status,
      })
      .from(studentProfiles),
  ]);
  const profileByUser = new Map(profileRows.map((p) => [p.userId, p]));

  return userRows.flatMap((u) => {
    const p = profileByUser.get(u.id);
    if (!p) return []; // no student profile row -- not a real student account
    return [
      {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone ?? p.phone,
        apexNumber: u.apexNumber,
        trainingType: p.trainingType,
        signUpDate: p.signUpDate ?? u.createdAt,
        signUpDateConfirmed: !!p.signUpDate,
        sahpaNumber: p.sahpaNumber,
        sahpaExpiryDate: p.sahpaExpiryDate,
        status: p.status as AdminStudentRow["status"],
        consentComplete: !!u.consentSigned && !!u.indemnitySigned,
        profilePictureFile: u.profilePictureFile,
      },
    ];
  });
}
