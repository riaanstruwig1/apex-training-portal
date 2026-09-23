import { requireInstructor } from "@/lib/auth/dal";
import NavHeader from "@/components/nav-header";
import { countPendingApplicants } from "@/lib/verification";
import { countPendingPilotEndorsements, ensurePilotProfile } from "@/lib/pilots";
import { countPasswordResetRequests } from "@/lib/password-resets";

const staffLinks = [{ href: "/instructor", label: "Students" }];

export default async function InstructorLayout({
  children,
}: LayoutProps<"/instructor">) {
  const staff = await requireInstructor();
  const isCFI = staff.role === "cfi";
  // A CFI/instructor is very often also a pilot (Notes4 item 24, flagged
  // MAJOR) -- every staff account is now guaranteed a pilot_profiles row
  // (created on first visit here if it didn't already exist), so the
  // "My Portfolio" link and clickable profile name always work, not just
  // for staff who happened to already have one.
  const [pendingCount, pendingPilotCount, pendingResetCount] = await Promise.all([
    isCFI ? countPendingApplicants() : Promise.resolve(0),
    isCFI ? countPendingPilotEndorsements() : Promise.resolve(0),
    isCFI ? countPasswordResetRequests() : Promise.resolve(0),
    ensurePilotProfile(staff.id),
  ]);
  const cfiOnlyLinks = [
    { href: "/instructor/students/new", label: "Add student" },
    { href: "/instructor/team", label: "Instructors" },
    { href: "/instructor/syllabus", label: "Manage syllabus" },
    { href: "/instructor/exams", label: "Exam content" },
    { href: "/instructor/study-material", label: "Study material" },
    { href: "/admin/forms-procedures", label: "Forms & procedures" },
    { href: "/admin", label: "Verification queue", badge: pendingCount },
    { href: "/admin/pilots", label: "Pilots", badge: pendingPilotCount },
    { href: "/admin/password-resets", label: "Password resets", badge: pendingResetCount },
    { href: "/instructor/settings", label: "Settings" },
  ];
  const pilotLinks = [{ href: "/pilot", label: "My Portfolio" }];
  const links = [...staffLinks, ...pilotLinks, ...(isCFI ? cfiOnlyLinks : [])];

  return (
    <div className="flex min-h-screen flex-col">
      <NavHeader
        name={staff.name}
        roleLabel={isCFI ? "Chief Flight Instructor" : "Instructor"}
        links={links}
        profileHref="/pilot/profile"
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
