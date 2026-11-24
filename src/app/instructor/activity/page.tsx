import Link from "next/link";
import { requireCFI } from "@/lib/auth/dal";
import {
  ACTIVITY_LABELS,
  ROLE_LABELS,
  activityTime,
  getActivityActors,
  getActivityLog,
} from "@/lib/activity-log";

/** Batch 97 (Riaan, 24 Nov 2026): "keep a LOG of changes and who log in and
 * who did what and who sign off". CFI only. Newest first, last 500 shown
 * (filter by person or action); the Excel download has everything. */
export default async function ActivityLogPage(props: PageProps<"/instructor/activity">) {
  await requireCFI();
  const sp = await props.searchParams;
  const who = typeof sp.who === "string" ? sp.who : "";
  const what = typeof sp.what === "string" ? sp.what : "";
  const hideLogins = sp.logins === "hide";
  const [rows, actors] = await Promise.all([
    getActivityLog({ actorId: who || undefined, action: what || undefined, limit: 500 }),
    getActivityActors(),
  ]);
  const shown = hideLogins && !what ? rows.filter((r) => r.action !== "login") : rows;
  const qs = new URLSearchParams();
  if (who) qs.set("who", who);
  if (what) qs.set("what", what);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Activity log</h1>
          <p className="mt-1 text-sm text-slate-500">
            Who logged in and who did what: sign-up approvals, profile and student edits, exercise
            sign-offs, logbook countersigns, exam marking, Solo wings sign-offs, POP uploads and more.
            Newest first.
          </p>
        </div>
        <a
          href={`/api/activity-log${qs.toString() ? `?${qs}` : ""}`}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Download Excel
        </a>
      </div>

      <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Who</span>
          <select name="who" defaultValue={who} className="mt-1 rounded-md border border-slate-300 px-2 py-1.5">
            <option value="">Everyone</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">What</span>
          <select name="what" defaultValue={what} className="mt-1 rounded-md border border-slate-300 px-2 py-1.5">
            <option value="">All actions</option>
            {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-1.5">
          <input type="checkbox" name="logins" value="hide" defaultChecked={hideLogins} /> Hide logins
        </label>
        <button type="submit" className="rounded-md bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700">
          Show
        </button>
        {(who || what || hideLogins) && (
          <Link href="/instructor/activity" className="pb-1.5 text-xs text-slate-500 underline">
            Clear
          </Link>
        )}
      </form>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Nothing logged yet{who || what ? " for this filter" : ""}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Who</th>
                <th className="px-3 py-2">What</th>
                <th className="px-3 py-2">Student / person</th>
                <th className="px-3 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{activityTime(r.at)}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-900">{r.actorName ?? "--"}</span>
                    {r.actorRole && <span className="ml-1 text-xs text-slate-500">({ROLE_LABELS[r.actorRole] ?? r.actorRole})</span>}
                  </td>
                  <td className={`px-3 py-2 ${r.action === "login" ? "text-slate-500" : "font-medium text-slate-800"}`}>{r.label}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.targetUserId && r.targetName && r.targetUserId !== r.actorId ? (
                      <Link href={`/admin/applicants/${r.targetUserId}`} className="text-red-700 hover:underline">
                        {r.targetName}
                      </Link>
                    ) : r.targetUserId && r.targetUserId === r.actorId ? (
                      <span className="text-slate-400">--</span>
                    ) : (
                      r.targetName ?? <span className="text-slate-400">--</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.details ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length >= 500 && (
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              Showing the latest 500 -- use the filters or the Excel download for older entries.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
