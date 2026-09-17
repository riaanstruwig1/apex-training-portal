import type { LadderTierState } from "@/lib/pilot-progress";

/**
 * Pure display for one equipment type's Basic -> Intermediate -> Sport ->
 * Tandem ladder. Used on both the pilot's own dashboard (with an "Apply"
 * action per tier) and the CFI/Admin pilot review page (with a verify
 * checkbox per pending tier instead) -- `actionFor` lets each caller supply
 * whatever's appropriate for a given tier without this component knowing
 * about either one.
 */
export default function LadderTiers({
  equipmentLabel,
  tiers,
  actionFor,
}: {
  equipmentLabel: string;
  tiers: LadderTierState[];
  actionFor?: (tier: LadderTierState) => React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{equipmentLabel}</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        {tiers.map((t, i) => (
          <div
            key={t.tier}
            className={`rounded-lg border p-3 text-xs ${
              t.held
                ? "border-green-200 bg-green-50"
                : t.declined
                  ? "border-red-200 bg-red-50"
                  : t.pending
                    ? "border-amber-200 bg-amber-50"
                    : t.eligible
                      ? "border-slate-300 bg-white"
                      : "border-slate-100 bg-slate-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">
                {i + 1}. {t.label}
              </span>
              {t.held && <span className="text-green-700">✓</span>}
              {!t.held && t.declined && <span className="text-red-700">✕</span>}
            </div>
            {t.held && t.heldSince && (
              <p className="mt-1 text-slate-500">Held since {t.heldSince.toLocaleDateString()}</p>
            )}
            {!t.held && t.pending && (
              <p className="mt-1 text-amber-700">
                Applied {t.pendingSince ? t.pendingSince.toLocaleDateString() : ""} -- pending
                review
              </p>
            )}
            {!t.held && t.declined && (
              <p className="mt-1 text-red-700">
                Declined{t.declineReason ? ` -- ${t.declineReason}` : ""}
              </p>
            )}
            {!t.held && !t.pending && !t.declined && t.eligible && (
              <p className="mt-1 text-slate-500">Eligible now</p>
            )}
            {!t.held && !t.pending && !t.eligible && t.eligibleFrom && (
              <p className="mt-1 text-slate-400">
                Eligible from {t.eligibleFrom.toLocaleDateString()}
              </p>
            )}
            {!t.held && !t.pending && !t.eligible && t.reason && !t.eligibleFrom && (
              <p className="mt-1 text-slate-400">{t.reason}</p>
            )}
            {t.reason && t.eligibleFrom && (
              <p className="mt-1 text-slate-400">{t.reason}</p>
            )}
            {actionFor && <div className="mt-2">{actionFor(t)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
