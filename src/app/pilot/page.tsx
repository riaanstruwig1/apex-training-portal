import { requirePilot } from "@/lib/auth/dal";
import { groupEndorsementItems, ENDORSEMENT_OPTIONS, isLadderTierKey } from "@/lib/pilot-endorsements";
import { computeLadder, EQUIPMENT_LABELS, type Equipment } from "@/lib/pilot-progress";
import LadderTiers from "@/components/ladder-tiers";
import Avatar from "@/components/avatar";
import Link from "next/link";
import ApplyButton from "./apply-button";
import CaaLicenceForm from "./caa-licence-form";
import { db } from "@/db";
import { pilotEndorsements, studentSignoffs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import RatingInfoButton, { type RatingStatus } from "@/components/rating-info-button";
import { getRatingContentCounts, getRatingDocumentCounts } from "@/lib/content-counts";

const ALL_EQUIPMENT: Equipment[] = ["pg", "ppg", "ppt"];

export default async function PilotDashboard() {
  const { user, profile } = await requirePilot();

  const [signoff] = await db.select().from(studentSignoffs).where(eq(studentSignoffs.studentUserId, user.id)).orderBy(desc(studentSignoffs.signedOffAt)).limit(1);

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
  // Includes ladder-tier declines too (Basic/Intermediate/...), unlike
  // declinedEndorsements above -- this one just drives the top-of-page
  // "Action needed" banner (Notes item #8, 22 Sep 2026), so it should count
  // every declined item, not only the ones shown in the flat list below.
  const allDeclinedCount = endorsements.filter((e) => e.declined).length;
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
  //
  // "V23" item 61 (28 Sep 2026 renumbering -- Riaan: "under Apply for
  // something, Paraglider/PPG/Paratrike -- Intermediate, Sport and Tandem
  // ... if the pilot does not have the ratings"): also offer the
  // Intermediate/Sport/Tandem ladder tiers here for ANY equipment type the
  // pilot doesn't hold that tier in -- including equipment they're already
  // engaged with. First cut of this (28 Sep 2026) only showed a tier here
  // when the whole equipment type was unengaged, on the theory that the
  // ladder above already offers its own Apply for engaged equipment -- but
  // that ladder only shows Apply once the tier is time-in-rank eligible
  // (Notes: CAR Part 106), so a pilot who already holds Basic but isn't
  // yet eligible for Intermediate had NO Apply option anywhere for it.
  // Riaan confirmed (28 Sep 2026, after seeing PG/PPG both fully engaged
  // via Basic but Intermediate/Sport/Tandem showing nowhere) that this
  // list should simply be "not held", full stop, regardless of ladder
  // engagement or eligibility -- so it may occasionally show alongside an
  // eligible ladder tier's own Apply button too, which is fine (same
  // action, offered from two places, rather than the tier being
  // unreachable from either one before it's eligible). Basic is still
  // deliberately left out: Riaan's list names only Intermediate/Sport/
  // Tandem -- Basic is earned through initial training, not self-applied
  // here.
  const notHeldLadderTiers = ENDORSEMENT_OPTIONS.filter(
    (o) => o.tier != null && o.tier !== "basic" && o.equipment != null && !declaredKeys.has(o.key)
  );
  const notYetDeclared = ENDORSEMENT_OPTIONS.filter(
    (o) => o.tier === null && !declaredKeys.has(o.key)
  ).concat(notHeldLadderTiers);
  const groupedAvailable = groupEndorsementItems(notYetDeclared.map((o) => ({ key: o.key })));

  // Line 62 (13 Oct 2026): every rating name opens its requirements
  // overlay -- requirements + forms the CFI added, the pilot's own
  // uploaded documents, and Apply when it's open to apply for.
  const [contentCounts, docCounts] = await Promise.all([
    getRatingContentCounts(),
    getRatingDocumentCounts(user.id),
  ]);
  const ladders = Object.fromEntries(
    ALL_EQUIPMENT.map((equip) => [equip, computeLadder(equip, endorsements)])
  ) as Record<Equipment, ReturnType<typeof computeLadder>>;
  function ratingState(key: string): {
    status: RatingStatus;
    applyLabel: string | null;
    applyBlockedReason: string | null;
  } {
    const row = endorsements.find((e) => e.key === key);
    if (row?.verified) {
      return {
        status: {
          tone: "held",
          text: `You hold this${row.verifiedAt ? ` -- verified, held since ${row.verifiedAt.toLocaleDateString()}` : ""}.`,
        },
        applyLabel: null,
        applyBlockedReason: null,
      };
    }
    if (row && !row.declined) {
      return {
        status: {
          tone: "pending",
          text: `Applied ${row.declaredAt.toLocaleDateString()} -- waiting for your CFI or Admin to review it. You can still add documents.`,
        },
        applyLabel: null,
        applyBlockedReason: null,
      };
    }
    const option = ENDORSEMENT_OPTIONS.find((o) => o.key === key);
    const tier = option?.tier && option.equipment
      ? ladders[option.equipment as Equipment]?.find((t) => t.key === key)
      : undefined;
    const declinedText = row?.declined
      ? `Declined${row.declineReason ? ` -- ${row.declineReason}` : ""}. `
      : "";
    if (tier && !tier.eligible) {
      const why = tier.eligibleFrom
        ? `eligible from ${tier.eligibleFrom.toLocaleDateString()}${tier.reason ? ` (${tier.reason})` : ""}`
        : (tier.reason ?? "the previous tier isn't held yet");
      const whyText = why.replace(/\.+$/, "");
      return {
        status: { tone: row?.declined ? "declined" : "locked", text: `${declinedText}Not open yet -- ${whyText}.` },
        applyLabel: null,
        applyBlockedReason: whyText,
      };
    }
    return {
      status: {
        tone: row?.declined ? "declined" : "eligible",
        text: row?.declined ? `${declinedText}You can re-apply.` : "Open to apply for.",
      },
      applyLabel: row?.declined ? "Re-apply" : "Apply",
      applyBlockedReason: null,
    };
  }
  function Info({ k, label, variant }: { k: string; label: string; variant?: "pill" | "link" }) {
    const st = ratingState(k);
    return (
      <RatingInfoButton
        ratingKey={k}
        label={label}
        count={contentCounts[k] ?? 0}
        docCount={docCounts[k] ?? 0}
        mode="pilot"
        canEdit={user.role === "cfi"}
        status={st.status}
        applyLabel={st.applyLabel}
        applyBlockedReason={st.applyBlockedReason}
        variant={variant}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Avatar userId={user.id} filename={user.profilePictureFile} name={user.name} size={48} />
          <h1 className="text-xl font-semibold text-slate-900">Welcome, {user.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/pilot/portfolio/print"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Printable copy
          </Link>
          <Link
            href="/pilot/profile/view"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            View profile
          </Link>
          <Link
            href="/pilot/profile"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit profile
          </Link>
        </div>
      </div>

      {!user.signatureFormsConsentAt && !user.signatureFormsConsentDeclinedAt && (
        <a href="/pilot/profile" className="block rounded-lg border-2 border-red-400 bg-red-50 p-4 text-sm font-semibold text-red-800 hover:bg-red-100">
          Action needed: answer the Yes / No question about using your saved signature on your SAHPA / CAA forms (Edit profile → Saved signature).
        </a>
      )}
      {signoff && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-base font-semibold text-amber-900">
            🪽 Solo wings awarded {signoff.signedOffAt.toLocaleDateString()}
          </p>
          {profile?.awaitingCaaLicenceSince && (
            <p className="mt-1 text-sm text-amber-900">
              Status: <strong>Pending upload of licence from CAA</strong>. When your licence arrives, enter your SACAA No. and upload it below.
            </p>
          )}
          {profile?.awaitingCaaLicenceSince && <CaaLicenceForm defaultSacaa={profile.sacaaNumber ?? ""} />}
          <div className="mt-2 flex flex-wrap gap-2">
            <a href={`/api/signoff-certificate/${user.id}`} className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">
              Solo wings certificate (PDF)
            </a>
          </div>
        </div>
      )}

      {allDeclinedCount > 0 && (
        <a
          href="#declined"
          className="flex items-center justify-between rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm hover:bg-red-100"
        >
          <span className="font-semibold text-red-900">
            Action needed: {allDeclinedCount} application{allDeclinedCount > 1 ? "s" : ""} declined
            by your CFI/Admin -- see the reason and re-apply.
          </span>
          <span className="font-semibold text-red-700">Jump to details &rarr;</span>
        </a>
      )}

      {/* SACAA No, SAHPA No, Apex No, Call Sign -- in that order, spaced
          across the full width per Riaan's request (20 Sep 2026) so they're
          easier to read than the old single cramped line. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <div className="text-xs text-slate-500">SACAA No.</div>
          <div className="text-sm font-medium text-slate-900">{profile?.sacaaNumber ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">SAHPA No.</div>
          <div className="text-sm font-medium text-slate-900">{profile?.sahpaNumber ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Apex No.</div>
          <div className="text-sm font-medium text-slate-900">{user.apexNumber ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Call Sign</div>
          <div className="text-sm font-medium text-slate-900">{profile?.callSign ?? "—"}</div>
        </div>
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
                    actionFor={(t) => (
                      <div className="flex flex-wrap items-center gap-2">
                        {!t.held && !t.pending && t.eligible &&
                          (t.declined ? (
                            <ApplyButton endorsementKey={t.key} label="Re-apply" pendingLabel="Re-applying..." />
                          ) : (
                            <ApplyButton endorsementKey={t.key} />
                          ))}
                        <Info k={t.key} label={`${EQUIPMENT_LABELS[equip]} ${t.label}`} />
                      </div>
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          <div id="declined" className="rounded-xl border border-slate-200 bg-white p-5 scroll-mt-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Verified licences &amp; endorsements
            </h2>
            {relevantEquipment.length > 0 && (
              <p className="mb-3 text-xs text-slate-500">
                Your PG/PPG/PPT/PPC licence tiers (Basic, Intermediate, Sport, Tandem) show as a
                green ✓ in the &ldquo;Ratings &amp; progress&rdquo; ladder above once verified --
                this section covers everything else: add-ons, instructor and display ratings.
              </p>
            )}
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
                        className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                        title={`Applied ${e.declaredAt.toLocaleDateString()}`}
                      >
                        {e.label}
                        <Info k={e.key} label={e.label} />
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
                        <Info k={e.key} label={e.label} />
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
                Hold a rating that isn&apos;t listed above, or working towards one? Click its
                name to see the requirements and the forms to download, and to upload your
                documents -- then Apply and your CFI or Admin will review it.
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
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-700 transition hover:border-red-300 hover:bg-red-50"
                        >
                          <Info k={item.key} label={item.label} variant="link" />
                          {(contentCounts[item.key] ?? 0) > 0 && (
                            <span className="text-[10px] text-slate-400">{contentCounts[item.key]}</span>
                          )}
                          {(docCounts[item.key] ?? 0) > 0 && (
                            <span className="text-[10px] text-slate-500" title="Your uploaded documents">
                              📎{docCounts[item.key]}
                            </span>
                          )}
                          {ratingState(item.key).applyLabel ? (
                            <ApplyButton endorsementKey={item.key} />
                          ) : (
                            <span className="text-[10px] text-slate-400">not open yet</span>
                          )}
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
        A personal document library is still coming in a later build stage. This page covers
        your account, verified endorsements, and the ratings ladder.
      </div>
    </div>
  );
}
