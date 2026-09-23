import { requireAdminOrCFI } from "@/lib/auth/dal";
import NavHeader from "@/components/nav-header";
import { countPendingApplicants } from "@/lib/verification";
import { countPendingPilotEndorsements } from "@/lib/pilots";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdminOrCFI();
  const [pendingCount, pendingPilotCount] = await Promise.all([
    countPendingApplicants(),
    countPendingPilotEndorsements(),
  ]);
  const sharedLinks = [
    { href: "/admin", label: "Verification queue", badge: pendingCount },
    { href: "/admin/pilots", label: "Pilots", badge: pendingPilotCount },
    { href: "/admin/forms-procedures", label: "Forms & procedures" },
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
