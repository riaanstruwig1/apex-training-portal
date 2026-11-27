import Link from "next/link";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { pilotProfiles, studentSignoffs } from "@/db/schema";
import { requireInstructor } from "@/lib/auth/dal";
import { getAllStudentsWithSummary } from "@/lib/progress";
import { getPendingExamVerifications } from "@/lib/exams";
import { getPendingApplicants } from "@/lib/verification";
import { countPhase2Requests } from "@/lib/intro-course-server";
import { countPendingPilotEndorsements, countPendingLicenceRenewals } from "@/lib/pilots";
import { countPasswordResetRequests } from "@/lib/password-resets";
import { getSafetyOfficerId } from "@/lib/safety-notices";
import { compareByName } from "@/lib/sort-by-name";
import SafetyNoticeBanner from "@/components/safety-notice-banner";

/**
 * Batch 110 (Riaan, 27 Nov 2026): a dashboard for the CFI, the Safety Officer
 * and the instructors -- the staff home page. Review tiles with counts at the
 * top, a "waiting on you" list, large buttons for the everyday jobs, and short
 * how-to cards. Each person only sees what their role may use.
 */

type Tile = { label: string; count: number; href: string; hint: string; tone: "red" | "amber" | "blue" };

function ReviewTile({ t }: { t: Tile }) {
  const busy = t.count > 0;
  const tone = !busy
    ? "border-green-200 bg-green-50 text-green-900 hover:bg-green-100"
    : t.tone === "red"
      ? "border-red-300 bg-red-50 text-red-900 hover:bg-red-100"
      : t.tone === "amber"
        ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
        : "border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100";
  return (
    <Link href={t.href} className={`flex flex-col justify-between rounded-xl border-2 p-4 transition ${tone}`}>
      <span className="text-sm font-semibold">{t.label}</span>
      <span className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-bold leading-none">{t.count}</span>
        <span className="text-xs opacity-80">{busy ? t.hint : "All clear ✓"}</span>
      </span>
    </Link>
  );
}

function BigButton({ href, icon, label, sub, primary }: { href: string; icon: string; label: string; sub: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex min-h-24 items-center gap-4 rounded-xl border-2 p-4 transition ${
        primary ? "border-red-600 bg-red-600 text-white hover:bg-red-700" : "border-slate-200 bg-white text-slate-900 hover:border-red-400 hover:bg-red-50"
      }`}
    >
      <span className="text-4xl" aria-hidden>{icon}</span>
      <span>
        <span className="block text-lg font-bold leading-tight">{label}</span>
        <span className={`block text-xs ${primary ? "text-red-100" : "text-slate-500"}`}>{sub}</span>
      </span>
    </Link>
  );
}

function HowTo({ title, steps, href, link }: { title: string; steps: string[]; href: string; link: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <Link href={href} className="mt-2 inline-block text-sm font-semibold text-red-600 hover:underline">
        {link} &rarr;
      </Link>
    </div>
  );
}

async function getAwaitingLicence(): Promise<Set<string>> {
  const rows = await db
    .select({ id: studentSignoffs.studentUserId })
    .from(studentSignoffs)
    .innerJoin(pilotProfiles, eq(pilotProfiles.userId, studentSignoffs.studentUserId))
    .where(and(isNotNull(pilotProfiles.awaitingCaaLicenceSince)));
  return new Set(rows.map((r) => r.id));
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-ZA", { hour: "numeric", hour12: false, timeZone: "Africa/Johannesburg" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function StaffDashboard() {
  const staff = await requireInstructor();
  const isCFI = staff.role === "cfi";
  const [students, examsByStudent, applicants, phase2, pilotEndorsements, renewals, resets, soId, awaiting] = await Promise.all([
    getAllStudentsWithSummary(),
    getPendingExamVerifications(),
    getPendingApplicants(),
    countPhase2Requests(),
    isCFI ? countPendingPilotEndorsements() : Promise.resolve(0),
    isCFI ? countPendingLicenceRenewals() : Promise.resolve(0),
    isCFI ? countPasswordResetRequests() : Promise.resolve(0),
    getSafetyOfficerId(),
    getAwaitingLicence(),
  ]);
  const isSO = soId === staff.id;
  const canSendSafety = isCFI || isSO;
  const signups = isCFI ? applicants : applicants.filter((a) => a.role === "student");
  const active = students.filter((s) => s.status !== "archived");

  const flights = active.reduce((n, s) => n + s.pendingLogbookCount, 0);
  const exams = active.reduce((n, s) => n + (examsByStudent.get(s.id) ?? 0), 0);
  const noPop = active.filter((s) => s.popMissing).length;
  const awaitingCount = active.filter((s) => awaiting.has(s.id)).length;

  const tiles: Tile[] = [
    { label: "New sign-ups to verify", count: signups.length, href: "/admin", hint: "waiting in the queue", tone: "red" },
    { label: "Phase 2 requests", count: phase2, href: "/admin", hint: "intro students moving up", tone: "red" },
    { label: "Flights to countersign", count: flights, href: "#waiting", hint: "student logbook entries", tone: "red" },
    { label: "Exams to review", count: exams, href: "#waiting", hint: "submitted, not verified", tone: "amber" },
    { label: "No POP received", count: noPop, href: "#waiting", hint: "contact re payment", tone: "red" },
    { label: "Awaiting SACAA licence", count: awaitingCount, href: "#waiting", hint: "signed off, licence not added", tone: "blue" },
  ];
  if (isCFI) {
    tiles.push(
      { label: "Pilot renewals & ratings", count: pilotEndorsements + renewals, href: "/admin/pilots", hint: "licences / applications", tone: "amber" },
      { label: "Password resets", count: resets, href: "/admin/password-resets", hint: "open requests", tone: "amber" },
    );
  }

  // Students with something waiting, most items first.
  const waiting = active
    .map((s) => ({
      s,
      flights: s.pendingLogbookCount,
      exams: examsByStudent.get(s.id) ?? 0,
      pop: s.popMissing,
      lic: awaiting.has(s.id),
    }))
    .filter((w) => w.flights || w.exams || w.pop || w.lic)
    .sort((a, b) => b.flights + b.exams - (a.flights + a.exams) || compareByName(a.s, b.s));
  const shown = waiting.slice(0, 15);

  const roles = [isCFI ? "Chief Flight Instructor" : "Instructor", isSO ? "Safety Officer" : null].filter(Boolean).join(" · ");
  const today = new Intl.DateTimeFormat("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" }).format(new Date());

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting()}, {staff.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-slate-500">
            {roles} · {today}
          </p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Needs your review</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <ReviewTile key={t.label} t={t} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Quick actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <BigButton href="/instructor" icon="🎓" label="Students" sub="Roster, folios, logbooks, exams, sign-off" primary />
          {isCFI && <BigButton href="/instructor/students/new" icon="➕" label="Add student" sub="Create a student account" />}
          <BigButton href="/admin/pilots" icon="🪂" label="Pilots" sub={isCFI ? "Pilot list, renewals, ratings" : "Pilot list (view only)"} />
          {isCFI && <BigButton href="/instructor#invites" icon="💬" label="Invite a student" sub="Sign-up link by WhatsApp" />}
          {isCFI && <BigButton href="/admin/pilots#invites" icon="💬" label="Invite a pilot" sub="Sign-up link by WhatsApp" />}
          {canSendSafety ? (
            <BigButton href="/instructor/safety" icon="⚠️" label="New safety notice" sub="Send to all, or save only" />
          ) : (
            <BigButton href="/instructor/safety" icon="⚠️" label="Safety notices" sub="All notices sent so far" />
          )}
          <BigButton href="/pilot/logbook" icon="📒" label="Log my own flight" sub="My logbook" />
          <BigButton href="/pilot" icon="👤" label="My profile" sub="My licence, ratings and documents" />
        </div>
        <div className="mt-3">
          <SafetyNoticeBanner />
        </div>
      </section>

      <section id="waiting" className="scroll-mt-24">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Students waiting on you {waiting.length > 0 && `(${waiting.length})`}
        </h2>
        {waiting.length === 0 ? (
          <p className="rounded-xl border border-dashed border-green-300 bg-green-50 p-4 text-sm text-green-800">
            Nothing waiting - no flights, exams, payments or licences to follow up.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {shown.map(({ s, flights, exams, pop, lic }) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <Link href={`/instructor/students/${s.id}`} className="font-medium text-slate-900 hover:text-red-600">
                  {s.name}
                </Link>
                <div className="flex flex-wrap gap-1.5 text-xs font-medium">
                  {flights > 0 && (
                    <Link href={`/instructor/students/${s.id}#logbook`} className="rounded-full bg-red-100 px-2.5 py-1 text-red-700 hover:bg-red-200">
                      {flights} flight{flights > 1 ? "s" : ""} to countersign
                    </Link>
                  )}
                  {exams > 0 && (
                    <Link href={`/instructor/students/${s.id}#exams`} className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800 hover:bg-amber-200">
                      {exams} exam{exams > 1 ? "s" : ""} to review
                    </Link>
                  )}
                  {pop && (
                    <Link href={`/admin/applicants/${s.id}`} className="rounded-full bg-red-100 px-2.5 py-1 text-red-700 hover:bg-red-200">
                      No POP{s.paymentDiscussFirst ? " - discuss payment" : ""}
                    </Link>
                  )}
                  {lic && (
                    <Link href={`/instructor/students/${s.id}#signoff`} className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800 hover:bg-blue-200">
                      Awaiting SACAA Lic.
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {waiting.length > shown.length && (
              <Link href="/instructor" className="block px-4 py-3 text-sm font-semibold text-red-600 hover:underline">
                {waiting.length - shown.length} more on the Students roster &rarr;
              </Link>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Quick reference - how to</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <HowTo
            title="Approve a new sign-up"
            steps={[
              "Verification queue → open the person.",
              "Check ID, photo, SAHPA No., consent and POP.",
              "Yes, approve - he gets a WhatsApp and can log in.",
            ]}
            href="/admin"
            link="Verification queue"
          />
          <HowTo
            title="Countersign a student's flight"
            steps={[
              "Students → open the student → Logbook.",
              "Check the entry (edit it if needed).",
              "Verify, with a comment if you want.",
            ]}
            href="/instructor"
            link="Students"
          />
          <HowTo
            title="Review an exam"
            steps={[
              "Student page → Exams → Review & verify.",
              "Correct a mark or answer with a note if needed.",
              "Mark passed / failed (paper) or verify (online).",
            ]}
            href="/instructor"
            link="Students"
          />
          <HowTo
            title="Sign off Solo wings or a renewal"
            steps={[
              "Student page → blue Solo wings bar (or gold Renewal button).",
              "Fill in the form and sign.",
              "Download the pack (.zip) for SAHPA / SACAA.",
            ]}
            href="/instructor"
            link="Students"
          />
          <HowTo
            title="Student got his SACAA licence"
            steps={[
              "Student page → sign-off panel → Add the SACAA licence.",
              "SACAA No., expiry and upload.",
              "He moves to the Pilots list.",
            ]}
            href="/instructor"
            link="Students"
          />
          {canSendSafety ? (
            <HowTo
              title="Send a safety notice"
              steps={[
                "Safety notices → title, subject, description (+ file).",
                "Submit and send = WhatsApp to everyone.",
                "Save only = on everyone's screen, no WhatsApp.",
              ]}
              href="/instructor/safety"
              link="Safety notices"
            />
          ) : (
            <HowTo
              title="Safety notices"
              steps={[
                "The CFI and the Safety Officer send them.",
                "The latest shows on every student's and pilot's dashboard.",
                "Safety notices lists them all.",
              ]}
              href="/instructor/safety"
              link="Safety notices"
            />
          )}
          {isCFI && (
            <HowTo
              title="Reset someone's password"
              steps={[
                "Password resets (or the Pilots list / profile).",
                "Reset password + WhatsApp.",
                "The new password goes to his cell number.",
              ]}
              href="/admin/password-resets"
              link="Password resets"
            />
          )}
        </div>
      </section>
    </div>
  );
}
