"use client";

import { useActionState, useState } from "react";
import { updateStudentNotice } from "@/lib/actions/settings";
import type { SettingsState } from "@/lib/actions/settings";
import type { StudentNotice } from "@/lib/settings";

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500";

/** CFI-side editor for the student-portal notification bar (28 Sep 2026).
 * One banner, shown or hidden with the checkbox at the bottom -- nothing
 * saves live as you type, so toggling it off doesn't lose the message. */
export default function NoticeForm({ initial }: { initial: StudentNotice }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updateStudentNotice,
    undefined
  );
  const [removeFile, setRemoveFile] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="noticeMessage" className="block text-sm font-medium text-slate-700">
          Message
        </label>
        <textarea
          id="noticeMessage"
          name="noticeMessage"
          defaultValue={initial.message ?? ""}
          rows={2}
          placeholder="e.g. Grasslands closed for maintenance this weekend -- see the notice for details."
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="noticeButtonLabel" className="block text-sm font-medium text-slate-700">
            Button label (optional)
          </label>
          <input
            id="noticeButtonLabel"
            name="noticeButtonLabel"
            defaultValue={initial.buttonLabel ?? ""}
            placeholder="e.g. Read more"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="noticeLinkUrl" className="block text-sm font-medium text-slate-700">
            Button links to -- a web address
          </label>
          <input
            id="noticeLinkUrl"
            name="noticeLinkUrl"
            placeholder="e.g. apexadventures.co.za/notice"
            className={inputClass}
          />
        </div>
      </div>

      <div className="rounded-md border border-dashed border-slate-300 p-3">
        <p className="text-xs text-slate-500">
          ...or instead, upload a document for the button to open (PDF, image, PowerPoint or
          zip). Uploading a new file replaces any web address above, and vice versa -- the
          button can only go one place at a time.
        </p>
        {initial.file && !removeFile && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            Currently attached:{" "}
            <a
              href={`/api/forms-procedures/${initial.file}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-red-600 hover:text-red-700"
            >
              {initial.fileOriginalName ?? initial.file}
            </a>
            <label className="ml-2 inline-flex items-center gap-1 text-slate-500">
              <input
                type="checkbox"
                name="removeFile"
                onChange={(e) => setRemoveFile(e.target.checked)}
              />
              Remove
            </label>
          </p>
        )}
        <input
          type="file"
          name="noticeFile"
          accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,application/zip,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" name="noticeVisible" defaultChecked={initial.visible} />
        Show this banner to students
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        {state?.saved && <span className="text-sm text-green-700">Saved.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
