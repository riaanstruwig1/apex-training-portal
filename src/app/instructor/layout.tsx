import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pilotProfiles } from "@/db/schema";
import { requireInstructor } from "@/lib/auth/dal";
import NavHeader from "@/components/nav-header";
import { countPendingApplicants } from "@/lib/verification";
import { countPendingPilotEndorsements } from "@/lib/pilots";

const staffLinks = [{ href: "/instructor", label: "Students" }];

export default async function InstructorLayout({
  children,
}: LayoutProps<"/instructor">) {
  const staff = await requireInstructor();
  const isCFI = staff.role === "cfi";
  const [pendingCount, pendingPilotCount, [ownPilotProfile]] = await Promise.all([
    isCFI ? countPendingApplicants() : Promise.resolve(0),
    isCFI ? countPendingPilotEndorsements() : Promise.resolve(0),
    // A CFI/instructor is very often also a pilot (Notes4 item 24) -- if
    // they carry a linked pilot_profiles row, surface it as its own nav
    // link rather than hiding their pilot side behind their staff account.
    db
      .select({ id: pilotProfiles.id })
      .from(pilotProfiles)
      .where(eq(pilotProfiles.userId, staff.id))
      .limit(1),
  ]);
  const cfiOnlyLinks = [
    { href: "/instructor/students/new", label: "Add student" },
    { href: "/instructor/team", label: "Instructors" },
    { href: "/instructor/syllabus", label: "Manage syllabus" },
    { href: "/instructor/exams", label: "Exam content" },
    { href: "/instructor/study-material", label: "Study material" },
    { href: "/admin", label: "Verification queue", badge: pendingCount },
    { href: "/admin/pilots", label: "Pilots", badge: pendingPilotCount },
    { href: "/instructor/settings", label: "Settings" },
  ];
  const pilotLinks = ownPilotProfile ? [{ href: "/pilot", label: "My Portfolio" }] : [];
  const links = [...staffLinks, ...pilotLinks, ...(isCFI ? cfiOnlyLinks : [])];

  return (
    <div className="flex min-h-screen flex-col">
      <NavHeader
        name={staff.name}
        roleLabel={isCFI ? "Chief Flight Instructor" : "Instructor"}
        links={links}
        profileHref={ownPilotProfile ? "/pilot/profile" : null}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
