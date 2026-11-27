import "server-only";
import { countPendingApplicants } from "@/lib/verification";
import { countWaiting } from "@/lib/sq";
import { countPendingPilotEndorsements, countPendingLicenceRenewals } from "@/lib/pilots";
import { countPasswordResetRequests } from "@/lib/password-resets";
import { countPhase2Requests } from "@/lib/intro-course-server";

export type NavLink = { href: string; label: string; badge?: number };

/**
 * Batch 107 (Riaan, 25 Nov 2026): "the top menu format must stay the same for
 * any selection". One menu for CFI / instructors, used by the /instructor,
 * /admin and /pilot screens alike. "Student profiles" is merged into
 * "Students"; "My Portfolio" moved to the right, under the name.
 */
export async function getStaffNavLinks(role: string, userId?: string): Promise<NavLink[]> {
  const isCFI = role === "cfi";
  const [pendingCount, phase2Count, pendingPilotCount, pendingRenewalCount, pendingResetCount, sqWaiting] = await Promise.all([
    countPendingApplicants(!isCFI),
    countPhase2Requests(),
    isCFI ? countPendingPilotEndorsements() : Promise.resolve(0),
    isCFI ? countPendingLicenceRenewals() : Promise.resolve(0),
    isCFI ? countPasswordResetRequests() : Promise.resolve(0),
    userId ? countWaiting({ id: userId, role }) : Promise.resolve(0),
  ]);
  const students: NavLink = { href: "/instructor", label: "Students" };
  // Batch 110: staff dashboard is the home page and the first menu item.
  const dashboard: NavLink = { href: "/instructor/dashboard", label: "Dashboard" };
  const queue: NavLink = { href: "/admin", label: "Verification queue", badge: pendingCount + phase2Count };
  if (!isCFI) {
    return [
      dashboard,
      students,
      { href: "/admin/pilots", label: "Pilots" },
      queue,
      { href: "/instructor/study-material", label: "Study material" },
      { href: "/instructor/sq", label: "Safety & Quality", badge: sqWaiting },
      { href: "/instructor/safety", label: "Safety notices" },
    ];
  }
  return [
    dashboard,
    students,
    { href: "/instructor/students/new", label: "Add student" },
    { href: "/instructor/team", label: "Instructors" },
    { href: "/instructor/syllabus", label: "Manage syllabus" },
    { href: "/instructor/ratings", label: "Rating requirements" },
    { href: "/instructor/exams", label: "Exam content" },
    { href: "/instructor/study-material", label: "Study material" },
    { href: "/admin/forms-procedures", label: "Forms & procedures" },
    queue,
    { href: "/admin/pilots", label: "Pilots", badge: pendingPilotCount + pendingRenewalCount },
    { href: "/admin/password-resets", label: "Password resets", badge: pendingResetCount },
    { href: "/instructor/sq", label: "Safety & Quality", badge: sqWaiting },
    { href: "/instructor/safety", label: "Safety notices" },
    { href: "/instructor/settings", label: "Settings" },
    { href: "/instructor/activity", label: "Activity log" },
  ];
}


/** Links shown on the right, under the name (batch 107). */
export const STAFF_PROFILE_LINKS: NavLink[] = [
  { href: "/pilot", label: "👤 My profile" },
  { href: "/pilot/logbook", label: "📒 My logbook" },
];
