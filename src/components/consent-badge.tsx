/** Signed/Not signed pill for the Consent (SACAA CA 183-540) and Indemnity /
 * Assumption of Risk forms. Was previously a local helper duplicated inside
 * admin/applicants/[id]/page.tsx; pulled out here (V22 rollout item 10, 23
 * Sep 2026) so the self-service read-only View pages (ProfileView) can show
 * the exact same badge as the CFI/Admin review page. */
export default function ConsentBadge({
  signed,
  at,
  name,
}: {
  signed: boolean;
  at: Date | null;
  name: string | null;
}) {
  return signed ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
      Signed by {name} on {at?.toLocaleDateString()}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
      Not signed
    </span>
  );
}
