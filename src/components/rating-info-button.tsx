"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addRatingContent,
  deleteRatingContent,
  deleteRatingDocument,
  getRatingInfo,
  uploadRatingDocument,
  type RatingFormState,
  type RatingInfo,
} from "@/lib/actions/rating-info";
import { applyForEndorsement } from "@/lib/actions/pilot-endorsements";
import { ContentAddForm, ContentItemCards } from "@/components/content-items-panel";
import { endorsementGroup, endorsementLabel } from "@/lib/pilot-endorsements";

export type RatingStatus = {
  tone: "held" | "pending" | "declined" | "eligible" | "locked" | "none";
  text: string;
};

const TONE_CLASS: Record<RatingStatus["tone"], string> = {
  held: "bg-green-50 text-green-800 border-green-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  declined: "bg-red-50 text-red-800 border-red-200",
  eligible: "bg-slate-50 text-slate-700 border-slate-200",
  locked: "bg-slate-50 text-slate-500 border-slate-200",
  none: "bg-slate-50 text-slate-600 border-slate-200",
};

function UploadForm({ ratingKey, onUploaded }: { ratingKey: string; onUploaded: () => Promise<void> }) {
  const [state, setState] = useState<RatingFormState>(undefined);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await uploadRatingDocument(undefined, fd);
      if (result && "success" in result) {
        await onUploaded();
        form.reset();
      }
      setState(result);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
      <input type="hidden" name="ratingKey" value={ratingKey} />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate-500">
          Document name (optional)
          <input
            name="label"
            placeholder="e.g. Signed application form"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-slate-500">
          File (PDF or photo, max 10MB)
          <input
            type="file"
            name="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,.heic,.heif"
            className="mt-1 block w-full text-xs"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
        >
          {isPending ? "Uploading..." : "Upload document"}
        </button>
        {state && "error" in state && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

/**
 * Line 62 (13 Oct 2026): the requirements overlay for one rating /
 * licence / endorsement -- "almost the same as no 70". Shows:
 *  - where the pilot stands (status line, passed in by the page),
 *  - the requirements and forms to download the CFI added (Add+ for CFI),
 *  - the pilot's own uploaded documents for the application (upload /
 *    remove for the pilot; view / download for staff),
 *  - an Apply button for the pilot when it's open to apply for.
 *
 * mode "pilot": the signed-in pilot's own view.
 * mode "staff": a CFI/Admin/Instructor looking at one pilot (pilotUserId).
 * mode "manage": Instructor -> Rating requirements (no pilot involved).
 */
export default function RatingInfoButton({
  ratingKey,
  label,
  count,
  docCount = 0,
  mode,
  canEdit,
  pilotUserId,
  pilotName,
  status,
  applyLabel,
  applyBlockedReason,
  canRemoveDocs = false,
  variant = "pill",
}: {
  ratingKey: string;
  label: string;
  /** Requirement items the CFI has added. */
  count: number;
  /** Documents this pilot has uploaded for it. */
  docCount?: number;
  mode: "pilot" | "staff" | "manage";
  canEdit: boolean;
  pilotUserId?: string;
  pilotName?: string;
  status?: RatingStatus;
  /** "Apply" / "Re-apply" when the pilot can apply now; null otherwise. */
  applyLabel?: string | null;
  /** Why Apply isn't available yet (e.g. "Eligible from 1 Mar 2027"). */
  applyBlockedReason?: string | null;
  /** Staff: CFI/Admin may remove a pilot's uploaded document. */
  canRemoveDocs?: boolean;
  /** "pill": small (i n) button. "link": the rating name itself is the
   * button (used in the "Apply for something else" list). */
  variant?: "pill" | "link";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<RatingInfo | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isWorking, startWorking] = useTransition();
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const dirty = useRef(false);

  async function fetchInfo() {
    setInfo(await getRatingInfo(ratingKey, mode === "staff" ? pilotUserId : undefined));
  }
  function openOverlay() {
    setOpen(true);
    startLoading(fetchInfo);
  }
  function close() {
    setOpen(false);
    if (dirty.current) {
      dirty.current = false;
      router.refresh();
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close only reads refs + stable setters
  }, [open]);

  // Labels like "Intermediate" only make sense with their group, so the
  // overlay always shows e.g. "Paraglider (PG) -- Intermediate".
  const group = endorsementGroup(ratingKey);
  const fullName = `${group} -- ${endorsementLabel(ratingKey)}`;
  const items = info?.items ?? [];
  const documents = info?.documents ?? [];
  const showDocs = mode !== "manage";

  const trigger =
    variant === "link" ? (
      <button
        type="button"
        onClick={openOverlay}
        title="Requirements & documents"
        className="inline-flex items-center gap-1 text-left font-medium text-slate-700 underline decoration-dotted decoration-slate-300 underline-offset-2 hover:text-red-600 hover:decoration-red-400"
      >
        {label}
        <span aria-hidden className="font-serif text-[11px] italic text-red-500">i</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={openOverlay}
        aria-label={`Requirements for ${label}`}
        title="Requirements & documents"
        className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${
          count > 0 || docCount > 0
            ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            : "border-slate-200 text-slate-400 hover:bg-slate-50"
        }`}
      >
        <span aria-hidden className="font-serif italic">i</span>
        {count > 0 ? count : canEdit ? "+" : ""}
        {showDocs && docCount > 0 && <span title="Uploaded documents">· 📎{docCount}</span>}
      </button>
    );

  return (
    <>
      {trigger}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 text-left sm:items-center"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={fullName}
            className="w-full max-w-2xl rounded-xl bg-white text-sm font-normal text-slate-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Requirements &amp; documents
                </div>
                <h2 className="text-base font-semibold text-slate-900">{fullName}</h2>
                {mode === "staff" && pilotName && (
                  <p className="text-xs text-slate-500">Pilot: {pilotName}</p>
                )}
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="max-h-[75vh] space-y-5 overflow-y-auto p-4">
              {status && !applied && (
                <p className={`rounded-md border px-3 py-2 text-xs ${TONE_CLASS[status.tone]}`}>{status.text}</p>
              )}
              {applied && (
                <p className={`rounded-md border px-3 py-2 text-xs ${TONE_CLASS.pending}`}>
                  Applied -- your CFI or Admin will review it. You can still add documents below.
                </p>
              )}

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Requirements &amp; forms to download
                </h3>
                {info === null || (isLoading && items.length === 0) ? (
                  <p className="text-slate-500">Loading...</p>
                ) : items.length === 0 ? (
                  <p className="text-slate-500">
                    {canEdit
                      ? "Nothing added yet -- add the requirements and any forms below."
                      : "Your CFI hasn't added the requirements for this one yet -- ask them directly."}
                  </p>
                ) : (
                  <ContentItemCards
                    items={items}
                    canEdit={canEdit}
                    removing={isWorking}
                    onRemove={(item) => {
                      if (!confirm(`Remove "${item.title}"?`)) return;
                      startWorking(async () => {
                        await deleteRatingContent(item.id);
                        dirty.current = true;
                        await fetchInfo();
                      });
                    }}
                  />
                )}
                {canEdit && (
                  <ContentAddForm
                    hidden={{ ratingKey }}
                    submit={(fd) => addRatingContent(undefined, fd)}
                    heading="Add+ requirement or form"
                    titlePlaceholder="Title, e.g. Minimum flights & hours, or Application form"
                    onAdded={async () => {
                      dirty.current = true;
                      await fetchInfo();
                    }}
                  />
                )}
              </section>

              {showDocs && (
                <section className="space-y-3 border-t border-slate-100 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {mode === "pilot" ? "Your documents for this application" : "Documents uploaded by the pilot"}
                  </h3>
                  {info !== null && documents.length === 0 && (
                    <p className="text-slate-500">
                      {mode === "pilot"
                        ? "None yet. Upload completed forms, logbook pages or certificates here -- optional, but it speeds up the review."
                        : "The pilot hasn't uploaded anything for this one."}
                    </p>
                  )}
                  {documents.map((d) => {
                    const href = `/api/uploads/${d.userId}/${d.filename}`;
                    const dlName = `${pilotName ? `${pilotName} - ` : ""}${fullName.replace(/ -- /g, " ")} - ${d.label}`;
                    return (
                      <div
                        key={d.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2"
                      >
                        <span>
                          <span className="font-medium text-slate-900">{d.label}</span>{" "}
                          <span className="text-xs text-slate-400">
                            uploaded {new Date(d.createdAt).toLocaleDateString()}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3 text-sm">
                          <a href={href} target="_blank" rel="noreferrer" className="text-red-600 hover:underline">
                            View →
                          </a>
                          <a
                            href={`${href}?download=${encodeURIComponent(dlName)}`}
                            className="text-slate-600 hover:text-red-600 hover:underline"
                          >
                            Download
                          </a>
                          {(mode === "pilot" || canRemoveDocs) && (
                            <button
                              type="button"
                              disabled={isWorking}
                              onClick={() => {
                                if (!confirm(`Remove "${d.label}"?`)) return;
                                startWorking(async () => {
                                  await deleteRatingDocument(d.id);
                                  dirty.current = true;
                                  await fetchInfo();
                                });
                              }}
                              className="text-xs text-slate-400 hover:text-red-600"
                            >
                              Remove
                            </button>
                          )}
                        </span>
                      </div>
                    );
                  })}
                  {mode === "pilot" && (
                    <UploadForm
                      ratingKey={ratingKey}
                      onUploaded={async () => {
                        dirty.current = true;
                        await fetchInfo();
                      }}
                    />
                  )}
                </section>
              )}

              {mode === "pilot" && !applied && (applyLabel || applyBlockedReason) && (
                <section className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                  {applyLabel ? (
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() =>
                        startWorking(async () => {
                          const result = await applyForEndorsement(ratingKey, { deferRefresh: true });
                          if (result?.error) {
                            setApplyError(result.error);
                          } else {
                            setApplyError(null);
                            setApplied(true);
                            dirty.current = true;
                          }
                        })
                      }
                      className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {isWorking ? "Working..." : `${applyLabel} for ${fullName}`}
                    </button>
                  ) : (
                    <p className="text-xs text-slate-500">Not open to apply for yet: {applyBlockedReason}</p>
                  )}
                  {applyError && <span className="text-sm text-red-600">{applyError}</span>}
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
