import { NextRequest, NextResponse } from "next/server";

// Every "kick this visitor out" redirect in the DAL (src/lib/auth/dal.ts)
// now points here instead of straight to /login. The reason: proxy.ts's
// route guard only checks that the session cookie is validly *signed* --
// it never hits the database -- so a cookie left over from before a
// database wipe/reseed (exactly what happens during a fresh install, or
// after running db:seed again) still looks "valid" to it even though the
// user it names no longer exists. The DAL's own DB-backed check correctly
// rejects that stale cookie and tries to send the visitor to /login, but
// proxy.ts's optimistic check sees a still-signed cookie sitting on the
// /login request and bounces it straight back to that same page -- an
// infinite /login <-> <page> loop, entirely different from (though the
// same general shape as) the wrong-role loop fixed earlier in proxy.ts.
//
// A Server Component (which is what every DAL function runs inside) is
// not allowed to delete a cookie mid-render -- only a Server Action or a
// Route Handler can -- so the DAL redirects here, a Route Handler, which
// deletes the stale cookie and then redirects to /login for real. With no
// cookie left, proxy.ts has nothing to (wrongly) treat as valid, and the
// loop can't restart.
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.nextUrl));
  res.cookies.delete("apex_session");
  return res;
}
