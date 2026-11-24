import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { getStudyMaterials } from "@/lib/actions/study-materials";
import { isIntroStudent } from "@/lib/intro-course-server";
import { INTRO_LOCK_TEXT } from "@/lib/intro-course";

/**
 * Batch 105 (Riaan, 24 Nov 2026): shareable link to one study note, copied by
 * the CFI / instructor from Study material. Opens only for a signed-in
 * account: anyone else goes to the login page and comes straight back here.
 * The link follows the slot (1-8), so it keeps working when the file in that
 * slot is replaced.
 */
export default async function StudyLinkPage(props: PageProps<"/study/[slot]">) {
  const { slot } = await props.params;
  const n = Number(slot);
  if (!Number.isInteger(n) || n < 1 || n > 8) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/study/${n}`)}`);

  const item = (await getStudyMaterials()).find((s) => s.slot === n);
  const home = user.role === "student" ? "/student/study-notes" : user.role === "pilot" ? "/pilot" : "/instructor/study-material";
  const locked = user.role === "student" && (await isIntroStudent(user.id));

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Apex Flight Hub - Study note</p>
        {!item || (!item.filename && !item.linkUrl) ? (
          <p className="mt-3 text-sm text-slate-600">This study note isn&apos;t available any more.</p>
        ) : (
          <>
            <h1 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h1>
            {locked ? (
              <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                🔒 {INTRO_LOCK_TEXT}
              </p>
            ) : (
              <a
                href={item.filename ? `/api/study-material/${item.filename}` : item.linkUrl!}
                target={item.filename ? undefined : "_blank"}
                rel={item.filename ? undefined : "noreferrer"}
                className="mt-5 inline-block rounded-md bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                {item.filename ? "Download" : "Open link"}
              </a>
            )}
          </>
        )}
        <p className="mt-6 text-xs">
          <Link href={home} className="text-slate-500 underline">
            {user.role === "student" ? "All study notes" : "Back to the Hub"}
          </Link>
        </p>
      </div>
    </main>
  );
}
