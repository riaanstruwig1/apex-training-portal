import { NextRequest, NextResponse } from "next/server";
import { decryptSession } from "@/lib/auth/session";

// Optimistic route protection: reads the session cookie only (no DB hit).
// Real authorization for data access still happens in the DAL -- see
// src/lib/auth/dal.ts -- this just keeps people out of the wrong shell
// fast, and bounces a signed-in visitor away from /login.
//
// Keep the role->home mapping below in sync with src/app/page.tsx and the
// post-login redirect in src/lib/actions/auth.ts. This file predated the
// Admin and Pilot roles and only ever recognised "student" vs
// everyone-else-is-instructor -- that caused a real /instructor <-> /login
// redirect loop for Admin and Pilot accounts (found 15 Sep 2026, via the
// new admin@apex.co.za / pilot@apex.co.za dummy logins): an Admin/Pilot
// hitting /instructor was let through here, bounced to /login by the DAL,
// then bounced straight back to /instructor by this file's old "not a
// student? -> /instructor" logic on /login -- forever. Any new role added
// in future needs a line here too, or the same loop reappears.
function homeFor(role: string): string {
  if (role === "student") return "/student";
  if (role === "pilot") return "/pilot";
  if (role === "admin") return "/admin";
  return "/instructor"; // cfi, instructor
}

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isInstructorRoute = path.startsWith("/instructor");
  const isStudentRoute = path.startsWith("/student");
  const isPilotRoute = path.startsWith("/pilot");
  const isAdminRoute = path.startsWith("/admin");
  const isLoginRoute = path === "/login";

  const token = req.cookies.get("apex_session")?.value;
  const session = await decryptSession(token);
  const isValidSession = session && session.expiresAt > Date.now();

  if (
    (isInstructorRoute || isStudentRoute || isPilotRoute || isAdminRoute) &&
    !isValidSession
  ) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isValidSession) {
    const role = session.role;

    // "/instructor" is the staff shell -- both the CFI and regular
    // instructors land there. Finer-grained (CFI-only) permission checks
    // happen inside individual pages/actions, not here.
    if (isInstructorRoute && role !== "cfi" && role !== "instructor") {
      return NextResponse.redirect(new URL(homeFor(role), req.nextUrl));
    }

    if (isStudentRoute && role !== "student") {
      return NextResponse.redirect(new URL(homeFor(role), req.nextUrl));
    }

    // A CFI/instructor account can also carry its own linked pilot
    // profile (see requirePilot in the DAL), so they're allowed on
    // /pilot too -- only bounce a student or admin away.
    if (
      isPilotRoute &&
      role !== "pilot" &&
      role !== "cfi" &&
      role !== "instructor"
    ) {
      return NextResponse.redirect(new URL(homeFor(role), req.nextUrl));
    }

    // A CFI can also work the Admin verification queue (see
    // requireAdminOrCFI in the DAL), so only bounce a plain
    // instructor/student/pilot away.
    if (isAdminRoute && role !== "admin" && role !== "cfi") {
      return NextResponse.redirect(new URL(homeFor(role), req.nextUrl));
    }

    if (isLoginRoute) {
      return NextResponse.redirect(new URL(homeFor(role), req.nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|svg|ico)$).*)"],
};
