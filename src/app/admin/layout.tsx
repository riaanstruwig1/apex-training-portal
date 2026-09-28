import { requireAdminOrCFI } from "@/lib/auth/dal";
import NavHeader from "@/components/nav-header";
import { countPendingApplicants } from "@/lib/verification";
import { countPendingPilotEndorsements, countPendingLicenceRenewals } from "@/lib/pilots";
import { countPasswordResetRequests } from "@/lib/password-resets";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdminOrCFI();
  const [pendingCount, pendingPilotCount, pendingRenewalCount, pendingResetCount] = await Promise.all([
    countPendingApplicants(),
    countPendingPilotEndorsements(),
    countPendingLicenceRenewals(),
    countPasswordResetRequests(),
  ]);
  const sharedLinks = [
    { href: "/admin", label: "Verification queue", badge: pendingCount },
    { href: "/admin/pilots", label: "Pilots", badge: pendingPilotCount + pendingRenewalCount },
    { href: "/admin/forms-procedures", label: "Forms & procedures" },
    { href: "/admin/password-resets", label: "Password resets", badge: pendingResetCount },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <NavHeader
        name={user.name}
        roleLabel={user.role === "cfi" ? "Chief Flight Instructor" : "Office Manager"}
        links={
          user.role === "cfi"
            ? [{ href: "/instructor", label: "Instructor Portal" }, ...sharedLinks]
            : sharedLinks
        }
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
