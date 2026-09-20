import { requirePilot } from "@/lib/auth/dal";
import NavHeader from "@/components/nav-header";
import ConsentGate from "@/components/consent-gate";

const links = [{ href: "/pilot", label: "My Portfolio" }];

export default async function PilotLayout({ children }: LayoutProps<"/pilot">) {
  const { user, profile } = await requirePilot();

  // Hard gate (Notes3 item 9), same as StudentLayout -- but only for an
  // actual "pilot" account. A CFI/instructor who also has a linked pilot
  // profile is staff, not a trainee going through this consent flow, so
  // they're never blocked here even if their own consent fields are unset.
  const needsConsent = user.role === "pilot" && (!user.consentSigned || !user.indemnitySigned);

  return (
    <div className="flex min-h-screen flex-col">
      <NavHeader
        name={user.name}
        roleLabel="Pilot"
        links={needsConsent ? [] : links}
        apexNumber={user.apexNumber}
        sacaaNumber={profile?.sacaaNumber}
        profileHref={needsConsent ? null : "/pilot/profile"}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {needsConsent ? <ConsentGate name={user.name} /> : children}
      </main>
    </div>
  );
}
