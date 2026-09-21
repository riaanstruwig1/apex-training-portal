import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, studentProfiles, pilotProfiles } from "@/db/schema";
import { decryptSession, readSessionCookie } from "./session";

/**
 * Optimistic-ish check: verifies the session JWT and its expiry. Cached per
 * request so calling it from multiple Server Components doesn't re-decrypt.
 * Does NOT redirect on its own -- callers decide what "no session" means.
 */
export const getSession = cache(async () => {
  const token = await readSessionCookie();
  const session = await decryptSession(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) return null;
  return session;
});

/** Redirects to /login if there's no valid session. */
export async function requireSession() {
  const session = await getSession();
  // Routed through /api/session-expired, not straight to /login -- see
  // that route's own comment. A Server Component can't delete a cookie
  // itself, and a cookie signed before a since-changed database (a fresh
  // reseed, most often) still passes this JWT-only check even though the
  // user it names may be gone; only the route handler can clear it.
  if (!session) redirect("/api/session-expired");
  return session;
}

/**
 * Secure check: re-reads the user from the database (not just the cookie),
 * and confirms the requested role. Use this in Server Actions and Route
 * Handlers before touching data, not just the optimistic session above.
 */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      apexNumber: users.apexNumber,
      accountStatus: users.accountStatus,
      profilePictureFile: users.profilePictureFile,
      consentSigned: users.consentSigned,
      indemnitySigned: users.indemnitySigned,
      signatureFile: users.signatureFile,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return user ?? null;
});

/** Any staff member (CFI or regular instructor) -- use for anything both
 * roles can do, like signing off exercises or countersigning a logbook
 * entry. For CFI-only actions (managing students/instructors, the
 * syllabus, or settings) use requireCFI instead. */
export async function requireInstructor() {
  const user = await getCurrentUser();
  // See /api/session-expired -- a stale-but-validly-signed cookie (e.g.
  // after a database reseed) makes it here as "no user found", and needs
  // that route to actually clear the cookie, not a plain /login redirect.
  if (!user || (user.role !== "cfi" && user.role !== "instructor")) {
    redirect("/api/session-expired");
  }
  return user;
}

/** Chief Flight Instructor only. A signed-in regular instructor who hits
 * this is redirected back to their own dashboard rather than /login --
 * they do have a valid session, they just lack this specific permission. */
export async function requireCFI() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/session-expired");
  if (user.role !== "cfi") redirect("/instructor");
  return user;
}

export async function requireStudent() {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") redirect("/api/session-expired");

  const [profile] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, user.id))
    .limit(1);

  return { user, profile: profile ?? null };
}

/** Office Manager (Admin) only -- reviews/approves new sign-ups. No
 * instructional authority (that stays CFI/instructor). */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/api/session-expired");
  return user;
}

/** Either an Admin or a CFI can work the sign-up verification queue --
 * matches the SOW ("verified by CFI or Admin" throughout). Anyone else with
 * a valid session gets bounced to their own dashboard, not /login. */
export async function requireAdminOrCFI() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/session-expired");
  if (user.role !== "admin" && user.role !== "cfi") {
    redirect(user.role === "student" ? "/student" : user.role === "pilot" ? "/pilot" : "/instructor");
  }
  return user;
}

export async function requirePilot() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "pilot" && user.role !== "cfi" && user.role !== "instructor")) {
    redirect("/api/session-expired");
  }

  const [profile] = await db
    .select()
    .from(pilotProfiles)
    .where(eq(pilotProfiles.userId, user.id))
    .limit(1);

  // A cfi/instructor without a linked pilot profile simply has no Pilot
  // Portal to see -- the caller decides what to render in that case.
  return { user, profile: profile ?? null };
}
