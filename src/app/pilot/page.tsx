import { requirePilot } from "@/lib/auth/dal";
import { groupEndorsementItems, ENDORSEMENT_OPTIONS, isLadderTierKey } from "@/lib/pilot-endorsements";
import { computeLadder, EQUIPMENT_LABELS, type Equipment } from "@/lib/pilot-progress";
import LadderTiers from "@/components/ladder-tiers";
import Avatar from "@/components/avatar";
import Link from "next/link";
import ApplyButton from "./apply-button";
import { db } from "@/db";
import { pilotEndorsements } from "@/db/schema";
import { eq } from "drizzle-orm";

const ALL_EQUIPMENT: Equipment[] = ["pg", "ppg", "ppt"];

export default async function PilotDashboard() {
  const { user, profile } = await requirePilot();

  const endorsements = profile
    ? await db.select().from(pilotEndorsements).where(eq(pilotEndorsements.pilotProfileId, profile.id))
    : [];
  // Ladder-tier items (Basic/Intermediate/Sport/Tandem) are excluded here --
  // they already have their own card + status in the ladder section above,
  // so showing them again here would be a second, confusing Verify/Apply
  // surface for the exact same underlying row.
  const verifiedEndorsements = endorsements.filter((e) => e.verified && !isLadderTierKey(e.key));
  const pendingEndorsements = endorsements.filter(
    (e) => !e.verified && !e.declined && !isLadderTierKey(e.key)
  );
  const declinedEndorsements = endorsements.filter((e) => e.declined && !isLadderTierKey(e.key));
  const groupedVerified = groupEndorsementItems(verifiedEndorsements);
  const groupedPending = groupEndorsementItems(pendingEndorsements);
  const groupedDeclined = groupEndorsementItems(declinedEndorsements);
  const declaredKeys = new Set(endorsements.map((e) => e.key));

  // Only show a ladder for an equipment type the pilot has actually engaged
  // with (declared or verified something in that group) -- otherwise every
  // pilot sees three near-empty ladders regardless of relevance.
  const relevantEquipment = ALL_EQUIPMENT.filter((equip) =>
    ENDORSEMENT_OPTIONS.some((o) => o.equipment === equip && declaredKeys.has(o.key))
  );

  // Non-tiered items (add-ons, instructor ratings, display ratings) the
  // pilot hasn't declared yet -- offered with an "Apply" button, same as
  // the ladder's own Apply action.
  const notYetDeclared = ENDORSEMENT_OPTIONS.filter(
    (o) => o.tier === null && !declaredKeys.has(o.key)
  );
  const groupedAvailable = groupEndorsementItems(notYetDeclared.map((o) => ({ key: o.key })));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar userId={user.id} filename={user.profilePictureFile} name={user.name} size={48} />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Welcome, {user.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Apex No. {user.apexNumber ?? "—"}
              {profile?.callSign ? ` · Call sign ${profile.callSign}` : ""}
              {profile?.sahpaNumber ? ` · SACAA License No. ${profile.sahpaNumber}` : ""}
            </p>
          </div>
        </div>
        <Link
          href="/pilot/profile"
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Edit profile
        </Link>
      </div>

      {!profile ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          You don&apos;t have a pilot profile yet.
        </div>
      ) : (
        <>
          {relevantEquipment.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-slate-900">
                Ratings &amp; progress
              </h2>
              <p className="mb-3 text-xs text-slate-500">
                The CAR Part 106 licence ladder. Each tier unlocks once it&apos;s been held for
                the regulation&apos;s minimum time -- your CFI or Admin still has to verify it
                before it counts. A flight-count-based goal bar (Bronze/Silver/Platinum) is
                planned too, once the Pilot flight log is built.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {relevantEquipment.map((equip) => (
                  <LadderTiers
                    key={equip}
                    equipmentLabel={EQUIPMENT_LABELS[equip]}
                    tiers={computeLadder(equip, endorsements)}
                    actionFor={(t) => {
                      if (t.held || t.pending) return null;
                      if (!t.eligible) return null;
                      return t.declined ? (
                        <ApplyButton endorsementKey={t.key} label="Re-apply" pendingLabel="Re-applying..." />
                      ) : (
                        <ApplyButton endorsementKey={t.key} />
                      );
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Verified licences &amp; endorsements
            </h2>
            {groupedVerified.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nothing verified yet -- your CFI or Admin will confirm your declared
                endorsements as they review your application and logbook.
              </p>
            ) : (
              <div className="space-y-3">
                {groupedVerified.map(({ group, items }) => (
                  <div key={group}>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {group}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((e) => (
                        <span
                          key={e.id}
                          className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                          title={e.verifiedAt ? `Endorsed ${e.verifiedAt.toLocaleDateString()}` : undefined}
                        >
                          {e.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {groupedPending.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Pending review
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {groupedPending.flatMap(({ items }) =>
                    items.map((e) => (
                      <span
                        key={e.id}
                        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                        title={`Applied ${e.declaredAt.toLocaleDateString()}`}
                      >
                        {e.label}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}

            {groupedDeclined.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Declined
                </h3>
                <div className="space-y-1.5">
                  {groupedDeclined.flatMap(({ items }) =>
                    items.map((e) => (
                      <div
                        key={e.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-800"
                      >
                        <span className="font-medium">{e.label}</span>
                        {e.declineReason && <span className="text-red-700">— {e.declineReason}</span>}
                        <ApplyButton endorsementKey={e.key} label="Re-apply" pendingLabel="Re-applying..." />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {groupedAvailable.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">
                Apply for something else
              </h2>
              <p className="mb-3 text-xs text-slate-500">
                Hold a rating that isn&apos;t listed above? Apply here and your CFI or Admin
                will review it.
              </p>
              <div className="space-y-3">
                {groupedAvailable.map(({ group, items }) => (
                  <div key={group}>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {group}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((item) => (
                        <span
                          key={item.key}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-700"
                        >
                          {item.label}
                          <ApplyButton endorsementKey={item.key} />
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        Logbook, printable records and the personal document library are still coming in a
        later build stage. This page covers your account, verified endorsements, and the
        ratings ladder.
      </div>
    </div>
  );
}
