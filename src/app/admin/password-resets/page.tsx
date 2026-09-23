import { requireAdminOrCFI } from "@/lib/auth/dal";
import { getPasswordResetRequests } from "@/lib/password-resets";
import PasswordResetRowActions from "./password-reset-row-actions";

const roleLabel: Record<string, string> = {
  student: "Student",
  pilot: "Pilot",
  cfi: "Chief Flight Instructor",
  instructor: "Instructor",
  admin: "Office Manager",
};

/** CFI/Admin queue of "Forgot your password?" requests (V22 rollout item
 * 11, 23 Sep 2026) -- same list-and-act shape as the verification queue at
 * /admin, just for password resets instead of new sign-ups. Reachable by
 * both roles via requireAdminOrCFI, same guard used for Forms & procedures. */
export default async function PasswordResetsPage() {
  await requireAdminOrCFI();
  const requests = await getPasswordResetRequests();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Password reset requests</h1>
        {requests.length > 0 ? (
          <p className="mt-1 text-sm font-semibold text-red-600">
            Action needed: {requests.length} account{requests.length > 1 ? "s" : ""} waiting for a
            password reset below.
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            When someone uses &ldquo;Forgot your password?&rdquo; on the login page, their account
            shows up here so you can reset it and pass the new password along directly -- there&rsquo;s
            no email to send it to yet.
          </p>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nothing pending.
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-900">{r.name}</div>
                  <div className="text-xs text-slate-500">{r.email}</div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                    {roleLabel[r.role] ?? r.role}
                  </span>
                  <span>Requested {r.requestedAt.toLocaleString()}</span>
                </div>
              </div>
              <PasswordResetRowActions userId={r.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
