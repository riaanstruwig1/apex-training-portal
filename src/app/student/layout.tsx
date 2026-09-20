import { requireStudent } from "@/lib/auth/dal";
import { getRadioCallScript } from "@/lib/settings";
import NavHeader from "@/components/nav-header";
import ConsentGate from "@/components/consent-gate";

const links = [
  { href: "/student", label: "My Portfolio" },
  { href: "/student/exercises", label: "Training folio" },
  { href: "/student/logbook", label: "Logbook" },
];

export default async function StudentLayout({
  children,
}: LayoutProps<"/student">) {
  const [{ user, profile }, radioCallScript] = await Promise.all([
    requireStudent(),
    getRadioCallScript(),
  ]);

  // Hard gate (Notes3 item 9): a student added directly by a CFI/Admin --
  // rather than through public /signup, which collects both signatures up
  // front -- has never signed Consent & Indemnity. Block the whole student
  // area until they do, not just a status badge on the admin review page.
  const needsConsent = !user.consentSigned || !user.indemnitySigned;

  return (
    <div className="flex min-h-screen flex-col">
      <NavHeader
        name={user.name}
        roleLabel="Student"
        links={needsConsent ? [] : links}
        apexNumber={user.apexNumber}
        sacaaNumber={profile?.sacaaNumber}
        profileHref={needsConsent ? null : "/student/profile"}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {needsConsent ? <ConsentGate name={user.name} /> : children}
      </main>
      {!needsConsent && radioCallScript && (
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Your radio call
            </div>
            <p className="mt-1 whitespace-pre-wrap font-mono text-sm text-slate-700">
              {radioCallScript}
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
