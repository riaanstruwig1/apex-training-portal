import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { pilotEndorsements } from "@/db/schema";
import { requirePilot } from "@/lib/auth/dal";
import NavHeader from "@/components/nav-header";
import ConsentGate from "@/components/consent-gate";
import LicenceExpiredGate from "@/components/licence-expired-gate";

// A CFI/instructor viewing their own pilot side (Notes4 item 24) needs a
// way back to their staff dashboard -- they didn't stop being staff just
// because they're looking at their pilot profile.
const staffBackLink = [{ href: "/instructor", label: "Back to Instructor" }];

export default async function PilotLayout({ children }: LayoutProps<"/pilot">) {
  const { user, profile } = await requirePilot();
  const isStaff = user.role === "cfi" || user.role === "instructor";

  // Hard gate (Notes3 item 9), same as StudentLayout -- but only for an
  // actual "pilot" account. A CFI/instructor who also has a linked pilot
  // profile is staff, not a trainee going through this consent flow, so
  // they're never blocked here even if their own consent fields are unset.
  const needsConsent = user.role === "pilot" && (!user.consentSigned || !user.indemnitySigned);

  // Licence-expiry hard lock (V22 rollout items 6/7, 23 Sep 2026 -- Riaan:
  // "Hard lock until reviewed (Recommended)"). Same pilot-only scoping as
  // needsConsent above -- a CFI/instructor viewing their own linked pilot
  // profile is staff, not a trainee/pilot subject to this gate, even if
  // their own caaLicenceExpiryDate happens to be unset or in the past.
  // Checked after needsConsent so an unsigned account resolves that first.
  const needsLicenceReview =
    !needsConsent &&
    user.role === "pilot" &&
    !!profile?.caaLicenceExpiryDate &&
    profile.caaLicenceExpiryDate < new Date();

  // In-portal decline notice (Notes4 item 8): a declined endorsement already
  // shows in red with the reviewer's reason on the dashboard itself, but a
  // pilot who isn't actively looking has no way to know it happened -- a
  // nav badge, same mechanism CFIs already see for pending applicants,
  // flags it without needing an outbound-email provider this app doesn't
  // have yet (see the tracking doc's note on email vs WhatsApp for that).
  const declinedCount = profile
    ? (
        await db
          .select({ id: pilotEndorsements.id })
          .from(pilotEndorsements)
          .where(
            and(eq(pilotEndorsements.pilotProfileId, profile.id), eq(pilotEndorsements.declined, true))
          )
      ).length
    : 0;
  const pilotOnlyLinks = [
    { href: "/pilot", label: "My Portfolio", badge: declinedCount },
    { href: "/pilot/logbook", label: "Logbook" },
    { href: "/pilot/forms-procedures", label: "Forms & procedures" },
  ];
  const links = isStaff ? [...staffBackLink, ...pilotOnlyLinks] : pilotOnlyLinks;

  return (
    <div className="flex min-h-screen flex-col">
      <NavHeader
        name={user.name}
        roleLabel={isStaff ? (user.role === "cfi" ? "Chief Flight Instructor" : "Instructor") + " · Pilot" : "Pilot"}
        links={needsConsent || needsLicenceReview ? [] : links}
        apexNumber={user.apexNumber}
        sacaaNumber={profile?.sacaaNumber}
        profileHref={needsConsent || needsLicenceReview ? null : "/pilot/profile"}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {needsConsent ? (
          <ConsentGate name={user.name} hasSignature={!!user.signatureFile} />
        ) : needsLicenceReview ? (
          <LicenceExpiredGate expiredOn={profile!.caaLicenceExpiryDate!} />
        ) : (
          children
        )}
      </main>
    </div>
  );
}
