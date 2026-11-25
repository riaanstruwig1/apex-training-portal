import "server-only";
import { countPendingApplicants } from "@/lib/verification";
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
export async function getStaffNavLinks(role: string): Promise<NavLink[]> {
  const isCFI = role === "cfi";
  const [pendingCount, phase2Count, pendingPilotCount, pendingRenewalCount, pendingResetCount] = await Promise.all([
    countPendingApplicants(!isCFI),
    countPhase2Requests(),
    isCFI ? countPendingPilotEndorsements() : Promise.resolve(0),
    isCFI ? countPendingLicenceRenewals() : Promise.resolve(0),
    isCFI ? countPasswordResetRequests() : Promise.resolve(0),
  ]);
  const students: NavLink = { href: "/instructor", label: "Students" };
  const queue: NavLink = { href: "/admin", label: "Verification queue", badge: pendingCount + phase2Count };
  if (!isCFI) {
    return [
      students,
      { href: "/admin/pilots", label: "Pilots" },
      queue,
      { href: "/instructor/study-material", label: "Study material" },
    ];
  }
  return [
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
    { href: "/instructor/settings", label: "Settings" },
    { href: "/instructor/activity", label: "Activity log" },
  ];
}

/** Links shown on the right, under the name (batch 107). */
export const STAFF_PROFILE_LINKS: NavLink[] = [
  { href: "/pilot", label: "👤 My profile" },
  { href: "/pilot/logbook", label: "📒 My logbook" },
];
