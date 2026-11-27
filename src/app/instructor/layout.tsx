import { requireInstructor } from "@/lib/auth/dal";
import NavHeader from "@/components/nav-header";
import { ensurePilotProfile } from "@/lib/pilots";
import { getStaffNavLinks, STAFF_PROFILE_LINKS } from "@/lib/staff-nav";

export default async function InstructorLayout({
  children,
}: LayoutProps<"/instructor">) {
  const staff = await requireInstructor();
  const isCFI = staff.role === "cfi";
  // A CFI/instructor is very often also a pilot (Notes4 item 24) -- every
  // staff account is guaranteed a pilot_profiles row (created here if
  // missing), so "My profile" (their pilot portfolio) always works.
  // Batch 107: the same menu on every staff screen (lib/staff-nav.ts).
  const [links] = await Promise.all([getStaffNavLinks(staff.role), ensurePilotProfile(staff.id)]);

  return (
    <div className="flex min-h-screen flex-col">
      <NavHeader
        name={staff.name}
        roleLabel={isCFI ? "Chief Flight Instructor" : "Instructor"}
        links={links}
        profileHref="/pilot/profile"
        profileLinks={STAFF_PROFILE_LINKS}
        homeHref="/instructor/dashboard"
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
