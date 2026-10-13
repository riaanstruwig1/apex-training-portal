import { requireCFI } from "@/lib/auth/dal";
import { ENDORSEMENT_OPTIONS, groupEndorsementItems } from "@/lib/pilot-endorsements";
import { getRatingContentCounts } from "@/lib/content-counts";
import RatingInfoButton from "@/components/rating-info-button";

/** Line 62 (13 Oct 2026): one place for the CFI to fill in the
 * requirements and forms-to-download for every licence, rating and
 * endorsement. Pilots see these when they click a rating on their
 * portfolio (and can upload their documents there); the same Add+ is also
 * available inside each overlay. */
export default async function RatingRequirementsPage() {
  await requireCFI();
  const counts = await getRatingContentCounts();
  const groups = groupEndorsementItems(ENDORSEMENT_OPTIONS.map((o) => ({ key: o.key })));
  const filled = ENDORSEMENT_OPTIONS.filter((o) => (counts[o.key] ?? 0) > 0).length;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Rating requirements</h1>
      <p className="mb-2 max-w-2xl text-sm text-slate-500">
        For each licence, rating and endorsement, add the requirements (as per the
        regulations) and the forms a pilot must download and complete. Pilots see this when
        they click the rating on their portfolio, where they can also upload their documents
        and apply. Click a rating&apos;s <span className="font-serif italic">i</span> button,
        then use Add+.
      </p>
      <p className="mb-6 text-xs text-slate-400">
        {filled} of {ENDORSEMENT_OPTIONS.length} have requirements added.
      </p>
      <div className="space-y-4">
        {groups.map(({ group, items }) => (
          <div key={group} className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">{group}</h2>
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-slate-700">{item.label}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {(counts[item.key] ?? 0) === 0
                        ? "nothing added"
                        : `${counts[item.key]} item${counts[item.key] === 1 ? "" : "s"}`}
                    </span>
                    <RatingInfoButton
                      ratingKey={item.key}
                      label={item.label}
                      count={counts[item.key] ?? 0}
                      mode="manage"
                      canEdit
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
