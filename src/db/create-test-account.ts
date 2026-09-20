/**
 * Creates (or resets the password on) a single test account with a chosen
 * email/password, for quick manual testing on the live site without going
 * through the invite-link flow. Safe to run again -- upserts, so re-running
 * with the same email just resets that account's password rather than
 * erroring or duplicating it.
 *
 * Run with: npm run accounts:add-test -- <email> <password> [role]
 * role defaults to "student" -- also accepts "pilot", "instructor", "cfi",
 * "admin". A student/pilot account also gets a minimal profile row (status
 * "active", consent/indemnity already signed) so it's immediately usable,
 * not gated behind the sign-here screen or an invited/pending status.
 *
 * Example: npm run accounts:add-test -- test@apex.co.za Test1234
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { users, studentProfiles, pilotProfiles } from "./schema";

const VALID_ROLES = ["student", "pilot", "instructor", "cfi", "admin"] as const;
type Role = (typeof VALID_ROLES)[number];

async function main() {
  const [email, password, roleArg] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npm run accounts:add-test -- <email> <password> [role]");
    process.exit(1);
  }
  const role = (roleArg ?? "student") as Role;
  if (!VALID_ROLES.includes(role)) {
    console.error(`Role must be one of: ${VALID_ROLES.join(", ")}`);
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const name = "Test Account";

  const [user] = await db
    .insert(users)
    .values({
      email,
      name,
      role,
      passwordHash,
      accountStatus: "active",
      consentSigned: true,
      consentSignedAt: new Date(),
      consentSignedName: name,
      indemnitySigned: true,
      indemnitySignedAt: new Date(),
      indemnitySignedName: name,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, role, accountStatus: "active" },
    })
    .returning();

  if (role === "student") {
    const [existingProfile] = await db
      .select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, user.id))
      .limit(1);
    if (!existingProfile) {
      await db.insert(studentProfiles).values({
        userId: user.id,
        trainingType: "pg",
        status: "active",
      });
    }
  } else if (role === "pilot") {
    const [existingProfile] = await db
      .select({ id: pilotProfiles.id })
      .from(pilotProfiles)
      .where(eq(pilotProfiles.userId, user.id))
      .limit(1);
    if (!existingProfile) {
      await db.insert(pilotProfiles).values({ userId: user.id, status: "active" });
    }
  }

  console.log(`Ready: ${email} / ${password} (role: ${role})`);
}

main()
  .catch((err) => {
    console.error("Failed to create test account:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
