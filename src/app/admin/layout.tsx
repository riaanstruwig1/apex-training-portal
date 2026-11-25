import { requireStudentReviewer } from "@/lib/auth/dal";
import NavHeader from "@/components/nav-header";
import { countPendingApplicants } from "@/lib/verification";
import { countPendingPilotEndorsements, countPendingLicenceRenewals } from "@/lib/pilots";
import { countPasswordResetRequests } from "@/lib/password-resets";
import { countPhase2Requests } from "@/lib/intro-course-server";
import { getStaffNavLinks, STAFF_PROFILE_LINKS } from "@/lib/staff-nav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStudentReviewer();
  const [pendingCount, pendingPilotCount, pendingRenewalCount, pendingResetCount, phase2Count] = await Promise.all([
    countPendingApplicants(user.role === "instructor"),
    countPendingPilotEndorsements(),
    countPendingLicenceRenewals(),
    countPasswordResetRequests(),
    countPhase2Requests(),
  ]);
  const sharedLinks = [
    { href: "/admin", label: "Verification queue", badge: pendingCount + phase2Count },
    { href: "/admin/students", label: "Students" },
    { href: "/admin/pilots", label: "Pilots", badge: pendingPilotCount + pendingRenewalCount },
    { href: "/admin/forms-procedures", label: "Forms & procedures" },
    { href: "/admin/password-resets", label: "Password resets", badge: pendingResetCount },
  ];

  // Batch 107 (Riaan, 25 Nov 2026): CFI and instructors get exactly the same
  // menu here as on the /instructor screens (lib/staff-nav.ts).
  const isStaff = user.role === "cfi" || user.role === "instructor";
  const staffLinks = isStaff ? await getStaffNavLinks(user.role) : [];

  return (
    <div className="flex min-h-screen flex-col">
      <NavHeader
        name={user.name}
        roleLabel={user.role === "cfi" ? "Chief Flight Instructor" : user.role === "instructor" ? "Instructor" : "Office Manager"}
        links={isStaff ? staffLinks : sharedLinks}
        profileHref={isStaff ? "/pilot/profile" : null}
        profileLinks={isStaff ? STAFF_PROFILE_LINKS : undefined}
        homeHref={isStaff ? "/instructor" : "/admin"}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
