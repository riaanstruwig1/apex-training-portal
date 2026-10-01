import { requireStudent } from "@/lib/auth/dal";
import { getStudyMaterials } from "@/lib/actions/study-materials";
import { visibleExamCategories, EXAM_CATEGORY_ORDER } from "@/lib/exams";
import { categoryForBox } from "@/lib/study-note-boxes";

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** V24 item 74 (1 Oct 2026): "Study Notes" in the student menu, next to
 * Forms & procedures -- every study note the CFI has loaded. A note tied to
 * an exam the student can't see (e.g. PPT notes for a PG-only student) is
 * left out, same as on the dashboard. */
export default async function StudyNotesPage() {
  const { profile } = await requireStudent();
  const slots = await getStudyMaterials();
  const visible = visibleExamCategories(profile?.trainingType) ?? EXAM_CATEGORY_ORDER;
  const items = slots.filter((s) => {
    if (!s.filename && !s.linkUrl) return false;
    const cat = categoryForBox(s.dashboardBox);
    return !cat || visible.includes(cat);
  });

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Study Notes</h1>
      <p className="mb-6 text-sm text-slate-500">
        Notes, slide decks and videos from your instructor. Download them or open the link.
      </p>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No study notes yet -- your instructor will add them here.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <a
              key={item.id}
              href={item.filename ? `/api/study-material/${item.filename}` : item.linkUrl!}
              target={item.filename ? undefined : "_blank"}
              rel={item.filename ? undefined : "noreferrer"}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:border-red-300"
            >
              <div>
                <div className="text-sm font-medium text-slate-900">{item.title}</div>
                {item.filename && (
                  <div className="text-xs text-slate-500">{formatBytes(item.fileSize)}</div>
                )}
              </div>
              <span className="text-sm font-medium text-red-600">
                {item.filename ? "Download" : "Open link"}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
