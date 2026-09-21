import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pilotEndorsements } from "@/db/schema";
import { requirePilot } from "@/lib/auth/dal";
import { groupEndorsementItems, isLadderTierKey } from "@/lib/pilot-endorsements";
import { computeLadder, EQUIPMENT_LABELS, type Equipment } from "@/lib/pilot-progress";
import Avatar from "@/components/avatar";
import PrintButton from "@/components/print-button";

const ALL_EQUIPMENT: Equipment[] = ["pg", "ppg", "ppt"];

/**
 * Printable pilot portfolio (Notes4 item 22) -- a print-CSS view rather than
 * a generated file: the browser's own "Save as PDF" print destination
 * already covers the "give me a file" case, without a new pdf/docx
 * generation dependency (the docx skill's pattern was considered but is
 * meaningfully more code for the same result -- see the tracking doc).
 */
export default async function PilotPortfolioPrintPage() {
  const { user, profile } = await requirePilot();
  const endorsements = profile
    ? await db.select().from(pilotEndorsements).where(eq(pilotEndorsements.pilotProfileId, profile.id))
    : [];
  const verified = endorsements.filter((e) => e.verified && !isLadderTierKey(e.key));
  const grouped = groupEndorsementItems(verified);
  const declaredKeys = new Set(endorsements.map((e) => e.key));
  const relevantEquipment = ALL_EQUIPMENT.filter((equip) =>
    endorsements.some((e) => isLadderTierKey(e.key) && e.key.startsWith(equip))
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="print-hide flex justify-end">
        <PrintButton />
      </div>

      <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
        <Avatar userId={user.id} filename={user.profilePictureFile} name={user.name} size={64} />
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{user.name}</h1>
          <p className="text-sm text-slate-500">Pilot Portfolio -- Apex Flight Hub</p>
        </div>
      </div>

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

      {relevantEquipment.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Licence ladder
          </h2>
          <div className="space-y-2">
            {relevantEquipment.map((equip) => {
              const tiers = computeLadder(equip, endorsements);
              const heldLabels = tiers.filter((t) => t.held).map((t) => t.label);
              return (
                <p key={equip} className="text-sm text-slate-700">
                  <span className="font-medium">{EQUIPMENT_LABELS[equip]}:</span>{" "}
                  {heldLabels.length > 0 ? heldLabels.join(" → ") + " held" : "None held yet"}
                </p>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Verified licences &amp; endorsements
        </h2>
        {grouped.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing verified yet.</p>
        ) : (
          <div className="space-y-2">
            {grouped.map(({ group, items }) => (
              <div key={group}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{group}</p>
                <p className="text-sm text-slate-700">{items.map((i) => i.label).join(", ")}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="border-t border-slate-200 pt-3 text-xs text-slate-400">
        {declaredKeys.size} rating{declaredKeys.size === 1 ? "" : "s"} declared in total -- printed{" "}
        {new Date().toLocaleDateString()} from Apex Flight Hub.
      </p>
    </div>
  );
}
