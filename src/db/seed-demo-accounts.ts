/**
 * Batch 91 (Riaan, 3 Nov 2026): three demo logins -- a student, a pilot and
 * an instructor -- so Riaan can see the Hub exactly as each of them does.
 * Runs from the Railway start command (like seed-ppt-exam.ts). Safe to run
 * on every start: an account that already exists (matched by email) is left
 * exactly as it is -- password, profile and anything changed by hand.
 *
 * Passwords are only stored here as bcrypt hashes; Riaan has them in chat.
 * No phone numbers or dates of birth, so no WhatsApps or birthday messages
 * ever go to these accounts. Archive or delete them in the Hub when done.
 *
 * Run with: npm run db:seed-demo-accounts
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { users, studentProfiles, pilotProfiles } from "./schema";

const YEAR = 365 * 24 * 60 * 60 * 1000;

const ACCOUNTS = [
  { email: "demo.student@apexhub.demo", name: "Demo Student (test)", role: "student" as const, hash: "$2b$12$GnIPrcG28YK9U1.Sai88SOnsiq2whJ0hmmcs9kQONM9MJwgo20lAG" },
  { email: "demo.pilot@apexhub.demo", name: "Demo Pilot (test)", role: "pilot" as const, hash: "$2b$12$AS/7lNqcGewRH4tK967tkekocJnhlsBAtRnP.dgGnJBfuR.97ZGE6" },
  { email: "demo.instructor@apexhub.demo", name: "Demo Instructor (test)", role: "instructor" as const, hash: "$2b$12$sHTwb.v1Gj5guPE8EpHla..Q3CVFMEOcH2ucoXxcQX4rq6drbXOuC" },
];

async function main() {
  const now = new Date();
  for (const a of ACCOUNTS) {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, a.email)).limit(1);
    if (existing) {
      console.log(`demo account ${a.email}: already exists, left unchanged`);
      continue;
    }
    const [u] = await db
      .insert(users)
      .values({
        email: a.email,
        name: a.name,
        role: a.role,
        passwordHash: a.hash,
        accountStatus: "active",
        consentSigned: true,
        consentSignedAt: now,
        consentSignedName: a.name,
        indemnitySigned: true,
        indemnitySignedAt: now,
        indemnitySignedName: a.name,
      })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (!u) continue;

    if (a.role === "student") {
      await db.insert(studentProfiles).values({
        userId: u.id,
        status: "active",
        trainingType: "pg,ppg",
        courseLevel: "full",
        sahpaNumber: "DEMO-0001",
        sahpaExpiryDate: new Date(now.getTime() + YEAR),
        signUpDate: now,
        startDate: now,
        dtoNumber: "SACAA-0012DTO",
      });
    } else if (a.role === "pilot") {
      await db.insert(pilotProfiles).values({
        userId: u.id,
        status: "active",
        callSign: "PPG-DMO",
        sacaaNumber: "0270000001",
        sahpaNumber: "DEMO-0002",
        sahpaExpiryDate: new Date(now.getTime() + YEAR),
        caaLicenceExpiryDate: new Date(now.getTime() + YEAR),
        licenceFirstIssuedAt: new Date(now.getTime() - YEAR),
      });
    }
    console.log(`demo account ${a.email}: created (${a.role})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("demo accounts seed failed:", err);
    process.exit(1);
  });
