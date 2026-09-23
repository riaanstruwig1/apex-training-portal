import { medicalDeclarationExpiryStatus } from "@/lib/medical";

/** Colour-coded "Signed by X on Y" badge for the Pilot's Declaration of
 * Medical Fitness, now including its expiry (V22 rollout item 9, 23 Sep
 * 2026) -- green while valid, amber inside the 30-day warning window, red
 * once expired. Shared between the self-service read-only View pages
 * (ProfileView) and the CFI/Admin review page (admin/applicants/[id]) so
 * both show the exact same status for the exact same account. */
export default function MedicalDeclarationStatus({
  signedAt,
  signedName,
  expiresAt,
}: {
  signedAt: Date | null;
  signedName: string | null;
  expiresAt: Date | null;
}) {
  if (!signedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
        Not signed
      </span>
    );
  }

  const status = medicalDeclarationExpiryStatus(expiresAt);
  const styles =
    status === "expired"
      ? "bg-red-100 text-red-800"
      : status === "expiring_soon"
        ? "bg-amber-100 text-amber-800"
        : "bg-green-100 text-green-800";
  const statusLabel =
    status === "expired" ? "Expired" : status === "expiring_soon" ? "Expiring soon" : "Valid";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      Signed by {signedName} on {signedAt.toLocaleDateString()}
      {expiresAt && (
        <>
          {" "}
          &middot; {statusLabel} (expires {expiresAt.toLocaleDateString()})
        </>
      )}
    </span>
  );
}
