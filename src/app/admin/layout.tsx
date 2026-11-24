import { requireStudentReviewer } from "@/lib/auth/dal";
import NavHeader from "@/components/nav-header";
import { countPendingApplicants } from "@/lib/verification";
import { countPendingPilotEndorsements, countPendingLicenceRenewals } from "@/lib/pilots";
import { countPasswordResetRequests } from "@/lib/password-resets";
import { countPhase2Requests } from "@/lib/intro-course-server";

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

  // Batch 97 (Riaan, 24 Nov 2026): instructors review student sign-ups and
  // student profiles here too; pilots, forms and password resets stay CFI/Admin.
  const instructorLinks = [
    { href: "/instructor", label: "Instructor Portal" },
    { href: "/admin", label: "Verification queue", badge: pendingCount + phase2Count },
    { href: "/admin/students", label: "Student profiles" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <NavHeader
        name={user.name}
        roleLabel={user.role === "cfi" ? "Chief Flight Instructor" : user.role === "instructor" ? "Instructor" : "Office Manager"}
        links={
          user.role === "cfi"
            ? [{ href: "/instructor", label: "Instructor Portal" }, ...sharedLinks]
            : user.role === "instructor"
              ? instructorLinks
              : sharedLinks
        }
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
