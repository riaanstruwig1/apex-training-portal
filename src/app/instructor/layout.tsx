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
  const [pendingCount, pendingPilotCount] = isCFI
    ? await Promise.all([countPendingApplicants(), countPendingPilotEndorsements()])
    : [0, 0];
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
  const links = isCFI ? [...staffLinks, ...cfiOnlyLinks] : staffLinks;

  return (
    <div className="flex min-h-screen flex-col">
      <NavHeader
        name={staff.name}
        roleLabel={isCFI ? "Chief Flight Instructor" : "Instructor"}
        links={links}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
