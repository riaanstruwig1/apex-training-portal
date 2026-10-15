import { requireStudent } from "@/lib/auth/dal";
import { getRadioCallScript, getStudentNotice } from "@/lib/settings";
import NavHeader from "@/components/nav-header";
import ConsentGate from "@/components/consent-gate";
import SahpaGate from "@/components/sahpa-gate";
import StudentNoticeBanner from "@/components/student-notice-banner";

const links = [
  { href: "/student", label: "My Portfolio" },
  { href: "/student/exercises", label: "Training folio" },
  { href: "/student/logbook", label: "Logbook" },
  { href: "/student/forms-procedures", label: "Forms & procedures" },
  { href: "/student/study-notes", label: "Study Notes" },
];

export default async function StudentLayout({
  children,
}: LayoutProps<"/student">) {
  const [{ user, profile }, radioCallScript, studentNotice] = await Promise.all([
    requireStudent(),
    getRadioCallScript(),
    getStudentNotice(),
  ]);

  // Hard gate (Notes3 item 9): a student added directly by a CFI/Admin --
  // rather than through public /signup, which collects both signatures up
  // front -- has never signed Consent & Indemnity. Block the whole student
  // area until they do, not just a status badge on the admin review page.
  const needsConsent = !user.consentSigned || !user.indemnitySigned;

  // Second hard gate (15 Oct 2026, Riaan): no SAHPA number, no logbook / folio.
  const needsSahpa = !needsConsent && !profile?.sahpaNumber?.trim();
  const locked = needsConsent || needsSahpa;

  return (
    <div className="flex min-h-screen flex-col">
      <NavHeader
        name={user.name}
        roleLabel="Student"
        links={locked ? [] : links}
        apexNumber={user.apexNumber}
        sacaaNumber={profile?.sacaaNumber}
        profileHref={locked ? null : "/student/profile"}
      />
      {!locked && <StudentNoticeBanner notice={studentNotice} />}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {needsConsent ? (
          <ConsentGate name={user.name} hasSignature={!!user.signatureFile} />
        ) : needsSahpa ? (
          <SahpaGate name={user.name} />
        ) : (
          children
        )}
      </main>
      {!locked && radioCallScript && (
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
