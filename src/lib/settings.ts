import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";

const SINGLETON_ID = "singleton";

/** The site-wide standard radio call script, shown to every student. Null
 * until the instructor sets one from Instructor -> Settings. */
export async function getRadioCallScript(): Promise<string | null> {
  const [row] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, SINGLETON_ID))
    .limit(1);
  return row?.radioCallScript ?? null;
}

export type StudentNotice = {
  message: string | null;
  buttonLabel: string | null;
  linkUrl: string | null;
  file: string | null;
  fileOriginalName: string | null;
  visible: boolean;
};

/** The student-portal notification bar (28 Sep 2026, Riaan: a one-line
 * orange banner just under the header, with a note and an optional
 * renameable button linking to a doc or a hyperlink) -- CFI-controlled,
 * one banner for the whole school, hidden unless the CFI has explicitly
 * turned it on via Instructor -> Settings. */
export async function getStudentNotice(): Promise<StudentNotice> {
  const [row] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.id, SINGLETON_ID))
    .limit(1);
  return {
    message: row?.noticeMessage ?? null,
    buttonLabel: row?.noticeButtonLabel ?? null,
    linkUrl: row?.noticeLinkUrl ?? null,
    file: row?.noticeFile ?? null,
    fileOriginalName: row?.noticeFileOriginalName ?? null,
    visible: row?.noticeVisible ?? false,
  };
}
