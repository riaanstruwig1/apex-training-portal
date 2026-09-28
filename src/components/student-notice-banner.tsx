import type { StudentNotice } from "@/lib/settings";

/** The student-portal notification bar (28 Sep 2026, Riaan: "One line big
 * ORANGE... type a note and add a button... doc, or hyperlink... option to
 * hide or show, CFI selected"). Rendered just under the header in
 * StudentLayout. CFI-controlled visibility only -- no per-student dismiss,
 * since that's not what was asked for; every student sees the same banner
 * while it's switched on. */
export default function StudentNoticeBanner({ notice }: { notice: StudentNotice }) {
  if (!notice.visible || !notice.message) return null;

  const href = notice.file ? `/api/forms-procedures/${notice.file}` : notice.linkUrl;

  return (
    <div className="bg-orange-500 px-4 py-2 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center sm:flex-nowrap sm:justify-between sm:text-left">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold sm:whitespace-nowrap">
          {notice.message}
        </p>
        {notice.buttonLabel && href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-md bg-white px-3 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-50"
          >
            {notice.buttonLabel}
          </a>
        )}
      </div>
    </div>
  );
}
