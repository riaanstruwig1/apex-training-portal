# Apex Flight Hub → Sky Adventures: changes to copy across (6–13 Oct 2026)

**For:** the Sky Adventures Claude project. **From:** the Apex Flight Hub project. **Updated:** 13 Oct 2026 (batch 59 added). This replaces the earlier file, which covered batches 53–56 only.

Sky Adventures was copied from the Apex code at **Apex batch 52** (5 Oct 2026). Since then, Apex has had seven more batches, **53 to 59**. This file has everything needed to make the same changes in Sky: why each was made, what it does, how to test it, and the exact code changes. The changes are written as patches against the **batch-52 version of each file that Sky started from**.

- **Checked:** every patch was test-applied to a fresh copy of the Sky code (`sky-adventures-portal.zip`). It applied cleanly, the code type-checked, and Sky's own migration generated as described below.
- **Brand:** the one Sky-renamed file touched here (the Admin profile page) keeps `BRAND.memberNoLabel`.
- **If Sky has changed any of these files since 5 Oct,** apply the change by hand from the descriptions instead.

## Summary

| Apex batch | Date | What | Database change |
|---|---|---|---|
| 53 | 6 Oct | **Fix:** saving a study note (or any upload) over 10MB crashed the page | none |
| 54 | 8 Oct | **Download** button next to "View what was submitted" (paper exams) and every profile document | none |
| 55 | 9 Oct | CFI/instructor can **upload a paper exam for a student** from the folio and mark it pass/fail | none |
| 56 | 9 Oct | Student and pilot lists sorted **A–Z by name** (ignoring case, accents, spaces) | none |
| 57 | 13 Oct | CFI can **change a question's mark** with a note to the student, and the exam is **re-marked** | yes (see Migration) |
| 58 | 13 Oct | CFI can **change the student's answer** to the correct one in one click (or any option). The exam re-marks, so a **FAIL becomes a PASS** when the marks reach the pass mark. The student's own answer is kept. | yes (see Migration) |
| 59 | 13 Oct | CFI can **set the final result PASS / FAIL** with a required note (e.g. 99.5% failed only on the Airlaw must-pass rule). The review banner also **lists the must-pass questions not at full marks**, with jump links. | yes (see Batch 59 addendum) |

**Suggested Sky batch:** do all seven in one batch (apply batch 59's addendum patch *after* the 53–58 patches):
1. Apply the 13 patches and add the 4 new files listed under "Code changes".
2. Generate the Sky migration (see Migration).
3. Commit with a message like *"Port Apex 53-58: upload fix, Download buttons, CFI paper-exam upload, A–Z lists, exam corrections and re-marking"*.
4. Add the matching rows to the Sky tracker, status doc and manual.

Not shipped in Apex (for information only): CFI-only **Mark passed / Mark failed / Delete** buttons on every exam card for online attempts. It was built and put aside when Riaan said the existing flow worked.

---

## Batch 53: crash when saving uploads over 10MB (6 Oct)

**Report:** saving a ~20MB document under Instructor → Study material showed "This page couldn't load. A server error occurred."

**Cause:** `src/proxy.ts` runs on every page, including the POST that carries a server-action upload. Next.js buffers request bodies for the proxy only up to **10MB** by default (`experimental.proxyClientMaxBodySize`). Bigger uploads arrived cut short ("Unexpected end of form"), and the page crashed. The dev log shows *"Request body exceeded 10MB"*.

**Fix:** add `proxyClientMaxBodySize: "60mb"` next to `serverActions.bodySizeLimit`. This also covers Forms & procedures, exercise "i" sub-sections and sign-up documents. Sky's `/api/content-import` was never affected, because the proxy skips `/api`.

**Test:** in Study material, save a small file, a link, a 20MB file and a 40MB file. All should save.

**Rule:** any page-form upload over 10MB needs **both** limits in `next.config.ts`.

## Batch 54: Download buttons (8 Oct)

**Request:** "When a student uploads an exam or doc, it only shows View what was submitted, New upload, Delete. Can we add the function for me to download it also?"

**What it does:**
- **Exam review:** a **Download** button next to "View what was submitted". The file saves as "<Student> - <Exam>.pdf".
- **Profile page** (`/admin/applicants/[id]`): every document row shows **View →** and **Download**. The file saves as "<Name> - <document>.ext".
- **How:** `/api/uploads/[userId]/[filename]?download=<name>` adds a `Content-Disposition: attachment` header. The name is cleaned to safe characters. Access is the same as View: the owner or staff, and signed-out users are refused.

**Test:**
- Download from a paper exam as CFI.
- Download a document from the profile page as both CFI and Admin.
- Signed out → 404.

## Batch 55: CFI uploads a paper exam for a student (9 Oct)

**Request:** "I need to be able to upload an exam for a student as CFI, or delete the file and then verify pass or fail."

**What it does:**
- **Where the button shows:** each exam card on the staff view of a student's folio gets **Upload paper exam** when nothing is waiting for review. That covers: not started, opened but unanswered, or after a verified fail (the button then reads **Upload retake (paper)**, and staff skip the retry wait).
- **The form:**
  - the scan (PDF or photo, max 10MB)
  - for the radio exam, an optional licence number
  - **Result:** Mark later, Passed or Failed. Passed or Failed is recorded as verified by that staff member.
- **How it's saved:** like a student's own paper submission, so View, Download, New upload, Delete, Mark passed and Mark failed all work on it.
- **Blocked** if the student answered online, already passed, or has a submission awaiting review. An empty online attempt (opened, nothing answered) is replaced.
- **Permissions:** the new action `staffSubmitPaperExam` uses `requireInstructor`.

**Test:**
1. Upload with Mark later, then Review & verify, Download and Mark passed.
2. Radio exam with licence number, marked Failed in one step.
3. Upload a retake: it becomes attempt 2.
4. Delete it.
5. An empty online attempt is replaced by the upload.

## Batch 56: A–Z lists (9 Oct)

**Request:** "The student and pilot list, can we make it that the order is alphabetic, sort on name."

**Cause:** the database's `ORDER BY name` is case-sensitive, so "Zane" came above "andre".

**Fix:** a shared `compareByName` (`Intl.Collator("en", { sensitivity: "base", numeric: true })` on the trimmed name), used in:
- `getAllStudentsWithSummary` (CFI roster)
- `getAdminStudentList` (Student profiles)
- `getAllPilotsWithSummary` (Pilots)

Use it for any new people list.

## Batch 57: CFI changes a question's mark, with a note; the exam re-marks (13 Oct)

**Request:** "If CFI verifies or reviews the exam answers, I must be able to edit and change the mark, with note, discuss, and corrected with student. If corrected it will remark and correct."

**What it does:**
- **CFI only,** under every question of an online exam review: set the marks (0 up to the question's maximum, halves allowed; blank means automatic) and a note to the student, then **Save & re-mark**.
- The whole attempt is re-scored straight away: total, percentage, must-pass sections and PASS/FAIL. This works before or after verifying, and the verified status is kept.
- Unanswered questions can be marked too: a row is created with no selected option.
- **Students** see the corrected mark and the note on their verified results. The marked `.docx` shows them as well.
- **Instructors** see notes but can't change anything.

**Code:**
- **Marks rule:** `effectiveMarks()` in the new `src/lib/exam-marks.ts`. A question's mark is the CFI's set mark if there is one; otherwise full marks when the answer is correct, else 0.
- **Re-marking:** `rescoreExamAttempt()` in `src/lib/actions/exams.ts` uses the same rules as `submitExam`.
- **Action:** `adjustExamAnswer` (`requireCFI`).
- **UI:** `adjust-mark-form.tsx`.

## Batch 58: CFI changes the student's answer; FAIL can become PASS (13 Oct)

**Request:** "I must be able to change the answer to the correct one, change the mark and also give the point. If corrected it must change the marks; if fail it must be changed to pass with the note correction."

**What it does (CFI only, under each question):**
- **✔ Mark correct (full marks):** one click sets the answer to the correct option, gives automatic full marks and adds the note "Corrected after review."
- **Change answer / mark / add note:** pick any option as the answer, optionally override the marks, add a note, then **Save & re-mark**.
- **Re-marking:** the whole exam is re-marked, so a FAIL becomes a PASS when the new total reaches the pass mark. The status stays verified.
- **The student's own answer is kept** (`original_option_id`, `answer_changed`) and shown: "Student's own answer: …" on the CFI view, and "Corrected by your instructor. Your answer was: …" on the student's view. **Undo correction** restores it and clears the mark and note.
- **Result banners** (CFI and student) say how many questions were corrected. The `.docx` shows "Answer corrected by instructor (student's answer: …)".

**Test (12 checks in Apex):**
1. A verified FAIL at 37/50 (radio exam, pass mark 75%).
2. ✔ Mark correct takes it to PASS at 38/50, with the original answer kept and the default note added.
3. A hand-picked correct answer adds the point.
4. Giving an unanswered question the correct answer adds the point.
5. A half mark on a wrong answer adds 0.5.
6. Undo restores the student's answer.
7. The `.docx` shows the correction.
8. The student's view shows the PASS, the banner and the notes.
9. A regular instructor has no buttons.

## Migration (batches 57 + 58)

Apex shipped two migrations (`0039_exam_answer_adjustments`, `0040_exam_answer_corrections`). **Don't copy Apex's migration files into Sky.** Sky has its own migration numbering, and may have added migrations since 5 Oct. After applying the `src/db/schema.ts` patch, generate Sky's own migration instead:

```bash
npm run db:generate -- --name exam_answer_corrections
```

On the untouched Sky copy, this produced one migration, `drizzle/0039_exam_answer_corrections.sql`, plus its snapshot and journal entry:

```sql
ALTER TABLE `exam_answers` ADD `original_option_id` text REFERENCES exam_options(id);
ALTER TABLE `exam_answers` ADD `answer_changed` integer DEFAULT false NOT NULL;
ALTER TABLE `exam_answers` ADD `awarded_marks` real;
ALTER TABLE `exam_answers` ADD `staff_note` text;
ALTER TABLE `exam_answers` ADD `marked_by_user_id` text REFERENCES users(id);
ALTER TABLE `exam_answers` ADD `marked_at` integer;
```

Include the new `.sql`, `meta/00NN_snapshot.json` and `meta/_journal.json` in the Sky batch. Railway runs it on deploy.

Sky's **content export/import** (`src/lib/content-transfer.ts`) copies exams, questions and options, never exam answers, so it needs no change.

---

## Code changes

Each patch is one combined change per file, covering every batch that touched it. Each applies to the Sky file as it was at the copy (Apex batch 52 plus the Sky rename).

### `next.config.ts` (batch 53)
```diff
--- a/next.config.ts
+++ b/next.config.ts
@@ -14,6 +14,13 @@
     serverActions: {
       bodySizeLimit: "60mb",
     },
+    // 6 Oct 2026 (Riaan: saving a ~20MB study note crashed the page with
+    // "This page couldn't load"). proxy.ts runs on every page, including
+    // the POSTs that carry server-action uploads, and Next buffers those
+    // bodies for the proxy only up to 10MB by default -- anything bigger
+    // reached the upload action cut short ("Unexpected end of form") and
+    // the page crashed. Same headroom as bodySizeLimit above.
+    proxyClientMaxBodySize: "60mb",
   },
 };
```

### `src/app/api/uploads/[userId]/[filename]/route.ts` (batch 54)
```diff
--- a/src/app/api/uploads/[userId]/[filename]/route.ts
+++ b/src/app/api/uploads/[userId]/[filename]/route.ts
@@ -9,6 +9,15 @@
   webp: "image/webp",
 };
 
+/** "?download=<name>" (8 Oct 2026, Riaan: CFI wants to download what a
+ * student submitted, not just view it) sends the file as a download, saved
+ * as "<name>.<ext>" -- the name is cleaned to safe characters. */
+function downloadName(raw: string | null, ext: string, fallback: string): string | null {
+  if (raw === null) return null;
+  const clean = raw.replace(/[^A-Za-z0-9 ._()-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
+  return clean ? `${clean}.${ext}` : fallback;
+}
+
 /**
  * Serves an uploaded document (ID copy, CAA licence, profile picture).
  * Never public -- these are personal documents, so only the owner or staff
@@ -17,7 +26,7 @@
  * record has never needed this before -- keep it to owner + admin/cfi).
  */
 export async function GET(
-  _req: Request,
+  req: Request,
   ctx: RouteContext<"/api/uploads/[userId]/[filename]">
 ) {
   const { userId, filename } = await ctx.params;
@@ -37,10 +46,12 @@
   try {
     const bytes = await readFile(filePath);
     const ext = filename.split(".").pop() ?? "";
+    const asDownload = downloadName(new URL(req.url).searchParams.get("download"), ext, filename);
     return new Response(new Uint8Array(bytes), {
       headers: {
         "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
         "Cache-Control": "private, max-age=0, no-store",
+        ...(asDownload ? { "Content-Disposition": `attachment; filename="${asDownload}"` } : {}),
       },
     });
   } catch {
```

### `src/app/admin/applicants/[id]/page.tsx` (batch 54 — keeps Sky's `BRAND.memberNoLabel`)
```diff
--- a/src/app/admin/applicants/[id]/page.tsx
+++ b/src/app/admin/applicants/[id]/page.tsx
@@ -34,10 +34,13 @@
   userId,
   filename,
   label,
+  personName,
 }: {
   userId: string;
   filename: string | null;
   label: string;
+  /** Used to name the downloaded file, e.g. "John Doe - ID Passport copy". */
+  personName: string;
 }) {
   if (!filename) {
     return (
@@ -46,15 +49,22 @@
       </div>
     );
   }
+  const href = `/api/uploads/${userId}/${filename}`;
   return (
-    <a
-      href={`/api/uploads/${userId}/${filename}`}
-      target="_blank"
-      rel="noreferrer"
-      className="flex items-center justify-between rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
-    >
-      {label} <span className="text-red-600">View →</span>
-    </a>
+    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
+      <span>{label}</span>
+      <span className="flex shrink-0 items-center gap-3">
+        <a href={href} target="_blank" rel="noreferrer" className="text-red-600 hover:underline">
+          View →
+        </a>
+        <a
+          href={`${href}?download=${encodeURIComponent(`${personName} - ${label}`)}`}
+          className="text-slate-600 hover:text-red-600 hover:underline"
+        >
+          Download
+        </a>
+      </span>
+    </div>
   );
 }
 
@@ -155,11 +165,12 @@
       <div className="rounded-xl border border-slate-200 bg-white p-5">
         <h2 className="mb-2 text-sm font-semibold text-slate-900">Documents</h2>
         <div className="space-y-2">
-          <DocLink userId={applicant.id} filename={applicant.idPassportFile} label="ID / Passport copy" />
-          <DocLink userId={applicant.id} filename={applicant.profilePictureFile} label="Profile picture" />
+          <DocLink personName={applicant.name} userId={applicant.id} filename={applicant.idPassportFile} label="ID / Passport copy" />
+          <DocLink personName={applicant.name} userId={applicant.id} filename={applicant.profilePictureFile} label="Profile picture" />
           {applicant.role === "pilot" && (
             <>
               <DocLink
+                personName={applicant.name}
                 userId={applicant.id}
                 filename={pilot?.profile.caaLicenceFile ?? null}
                 label="Current CAA licence"
@@ -176,12 +187,14 @@
           )}
           {applicant.role === "student" && (
             <DocLink
+              personName={applicant.name}
               userId={applicant.id}
               filename={student?.profile.popFile ?? null}
               label="Proof of payment"
             />
           )}
           <DocLink
+            personName={applicant.name}
             userId={applicant.id}
             filename={applicant.flightMedicalCertFile}
             label="Flight medical certificate"
```

### `src/app/instructor/students/[id]/exams/[examId]/page.tsx` (batch 54, 57, 58)
```diff
--- a/src/app/instructor/students/[id]/exams/[examId]/page.tsx
+++ b/src/app/instructor/students/[id]/exams/[examId]/page.tsx
@@ -5,6 +5,8 @@
 import { requireInstructor } from "@/lib/auth/dal";
 import { getExamDetail, getAttemptHistory } from "@/lib/exams";
 import VerifyButton from "./verify-button";
+import AdjustMarkForm from "./adjust-mark-form";
+import { effectiveMarks, formatMarks } from "@/lib/exam-marks";
 import VerifyPaperButton from "./verify-paper-button";
 import PaperAttemptAdminActions from "./paper-attempt-admin-actions";
 
@@ -33,7 +35,8 @@
 export default async function ExamReviewPage(
   props: PageProps<"/instructor/students/[id]/exams/[examId]">
 ) {
-  await requireInstructor();
+  const staff = await requireInstructor();
+  const isCFI = staff.role === "cfi";
   const { id, examId } = await props.params;
   const sp = await props.searchParams;
   const requestedAttemptId = typeof sp.attempt === "string" ? sp.attempt : undefined;
@@ -121,14 +124,24 @@
         )}
         <div className="flex flex-wrap items-center gap-3">
           {attempt.proofFile ? (
-            <a
-              href={`/api/uploads/${id}/${attempt.proofFile}`}
-              target="_blank"
-              rel="noreferrer"
-              className="inline-block rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
-            >
-              View what was submitted
-            </a>
+            <>
+              <a
+                href={`/api/uploads/${id}/${attempt.proofFile}`}
+                target="_blank"
+                rel="noreferrer"
+                className="inline-block rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
+              >
+                View what was submitted
+              </a>
+              <a
+                href={`/api/uploads/${id}/${attempt.proofFile}?download=${encodeURIComponent(
+                  `${student.name} - ${exam.title}`
+                )}`}
+                className="inline-block rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
+              >
+                Download
+              </a>
+            </>
           ) : (
             <p className="text-sm text-slate-400">No file on record.</p>
           )}
@@ -174,7 +187,7 @@
         {attempt.status === "verified" ? (
           <>
             <span className="font-semibold">{attempt.passed ? "PASS" : "FAIL"}</span> —{" "}
-            {attempt.scoreMarks} / {attempt.totalMarks} marks ({attempt.scorePercent?.toFixed(1)}%).
+            {formatMarks(attempt.scoreMarks ?? 0)} / {attempt.totalMarks} marks ({attempt.scorePercent?.toFixed(1)}%).
             Verified by {attempt.verifiedByName}
             {attempt.verifiedAt ? ` on ${attempt.verifiedAt.toLocaleDateString()}` : ""}.
             {!attempt.mustPassSectionsOk && (
@@ -188,17 +201,20 @@
           <>
             Submitted{attempt.submittedAt ? ` on ${attempt.submittedAt.toLocaleDateString()}` : ""} —
             computed result: <span className="font-semibold">{attempt.passed ? "PASS" : "FAIL"}</span>{" "}
-            ({attempt.scoreMarks} / {attempt.totalMarks} marks, {attempt.scorePercent?.toFixed(1)}%).
+            ({formatMarks(attempt.scoreMarks ?? 0)} / {attempt.totalMarks} marks, {attempt.scorePercent?.toFixed(1)}%).
             Not yet verified.
           </>
         )}
+        {attempt.correctedCount > 0 && (
+          <span className="mt-1 block text-xs font-medium">
+            {attempt.correctedCount} question{attempt.correctedCount > 1 ? "s" : ""} corrected by the
+            CFI after review -- marks and result recalculated.
+          </span>
+        )}
       </div>
 
       {exam.sections.map((section) => {
-        const earned = section.questions.reduce((sum, q) => {
-          const selected = q.options.find((o) => o.id === q.selectedOptionId);
-          return sum + (selected?.isCorrect ? q.marks : 0);
-        }, 0);
+        const earned = section.questions.reduce((sum, q) => sum + effectiveMarks(q), 0);
         return (
           <section key={section.id} className="space-y-3">
             <h2 className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-slate-500">
@@ -206,12 +222,16 @@
                 Section {section.code}: {section.name}
               </span>
               <span className="font-normal normal-case text-slate-400">
-                {earned} / {section.totalMarks} marks
+                {formatMarks(earned)} / {section.totalMarks} marks
               </span>
             </h2>
             {section.questions.map((q) => {
               const selected = q.options.find((o) => o.id === q.selectedOptionId);
-              const isCorrect = !!selected?.isCorrect;
+              const autoMarks = selected?.isCorrect ? q.marks : 0;
+              const got = effectiveMarks(q);
+              const isAdjusted = q.awardedMarks !== null;
+              const full = got >= q.marks;
+              const none = got <= 0;
               return (
                 <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
                   <div className="mb-2 flex items-start justify-between gap-3">
@@ -220,10 +240,15 @@
                     </p>
                     <span
                       className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
-                        isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
+                        full
+                          ? "bg-green-100 text-green-800"
+                          : none
+                            ? "bg-red-100 text-red-800"
+                            : "bg-amber-100 text-amber-800"
                       }`}
                     >
-                      {isCorrect ? `✔ ${q.marks}/${q.marks}` : `✘ 0/${q.marks}`}
+                      {full ? "✔" : none ? "✘" : "½"} {formatMarks(got)}/{q.marks}
+                      {(isAdjusted || q.answerChanged) && " (corrected)"}
                     </span>
                   </div>
                   <div className="text-sm">
@@ -245,6 +270,41 @@
                       <div className="text-slate-400">No answer</div>
                     )}
                   </div>
+                  {q.answerChanged && (
+                    <p className="mt-2 text-xs text-amber-700">
+                      Answer changed by the CFI. Student&apos;s own answer:{" "}
+                      {(() => {
+                        const orig = q.options.find((o) => o.id === q.originalOptionId);
+                        return orig ? `${orig.label}. ${orig.text ?? "(picture)"}` : "no answer";
+                      })()}
+                    </p>
+                  )}
+                  {isAdjusted && (
+                    <p className="mt-2 text-xs text-slate-500">
+                      Mark set by the CFI (automatic would be {formatMarks(autoMarks)}/{q.marks}).
+                    </p>
+                  )}
+                  {q.staffNote && (
+                    <div className="mt-2 rounded-md border-l-4 border-amber-300 bg-amber-50 px-3 py-2 text-sm text-slate-700">
+                      <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
+                        Note to student
+                      </span>
+                      <p className="whitespace-pre-wrap">{q.staffNote}</p>
+                    </div>
+                  )}
+                  {isCFI && (
+                    <AdjustMarkForm
+                      attemptId={attempt.id}
+                      questionId={q.id}
+                      maxMarks={q.marks}
+                      autoMarks={autoMarks}
+                      awardedMarks={q.awardedMarks}
+                      staffNote={q.staffNote}
+                      options={q.options}
+                      selectedOptionId={q.selectedOptionId}
+                      isCorrected={q.answerChanged || isAdjusted || !!q.staffNote}
+                    />
+                  )}
                 </div>
               );
             })}
```

### `src/app/instructor/students/[id]/page.tsx` (batch 55)
```diff
--- a/src/app/instructor/students/[id]/page.tsx
+++ b/src/app/instructor/students/[id]/page.tsx
@@ -24,6 +24,7 @@
 import LogbookTable from "./logbook-table";
 import CallSignEditor from "./call-sign-editor";
 import StudentEndorsementToggle from "./student-endorsement-toggle";
+import StaffPaperUpload from "./staff-paper-upload";
 
 const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
   pg: "Paraglider (PG)",
@@ -336,11 +337,18 @@
                     ? "bg-amber-100 text-amber-800"
                     : "bg-slate-100 text-slate-600";
               const canReview = e.status === "submitted" || e.status === "verified";
+              // 9 Oct 2026: staff can upload a paper exam for the student when
+              // nothing is awaiting review yet (not started / opened but not
+              // answered / a verified fail). The action itself re-checks.
+              const canStaffUpload =
+                e.status === "not_started" ||
+                (e.status === "in_progress" && e.answeredCount === 0) ||
+                (e.status === "verified" && !e.passed);
 
               return (
                 <div
                   key={e.examId}
-                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
+                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
                 >
                   <div>
                     <div className="text-sm font-medium text-slate-900">{e.title}</div>
@@ -348,14 +356,24 @@
                       {statusLabel}
                     </span>
                   </div>
-                  {canReview && (
-                    <Link
-                      href={`/instructor/students/${id}/exams/${e.examId}`}
-                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
-                    >
-                      {e.status === "submitted" ? "Review & verify" : "Review"}
-                    </Link>
-                  )}
+                  <div className="flex flex-wrap items-start justify-end gap-2">
+                    {canReview && (
+                      <Link
+                        href={`/instructor/students/${id}/exams/${e.examId}`}
+                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
+                      >
+                        {e.status === "submitted" ? "Review & verify" : "Review"}
+                      </Link>
+                    )}
+                    {canStaffUpload && (
+                      <StaffPaperUpload
+                        studentId={id}
+                        examId={e.examId}
+                        isRadio={e.category === "rt"}
+                        label={e.status === "verified" ? "Upload retake (paper)" : "Upload paper exam"}
+                      />
+                    )}
+                  </div>
                 </div>
               );
             })}
```

### `src/lib/actions/exams.ts` (batch 55, 57, 58)
```diff
--- a/src/lib/actions/exams.ts
+++ b/src/lib/actions/exams.ts
@@ -342,6 +342,276 @@
   return undefined;
 }
 
+/**
+ * Re-scores an online attempt from its answers, using the CFI's adjusted
+ * mark on any question that has one (13 Oct 2026) -- same rules as
+ * submitExam: percent of total marks, pass mark, and every "must pass"
+ * section needing full marks. Status is left as it is: a verified attempt
+ * stays verified with its new result.
+ */
+async function rescoreExamAttempt(attemptId: string) {
+  const [attempt] = await db
+    .select()
+    .from(examAttempts)
+    .where(eq(examAttempts.id, attemptId))
+    .limit(1);
+  if (!attempt || attempt.source !== "online") return;
+  const [exam] = await db.select().from(exams).where(eq(exams.id, attempt.examId)).limit(1);
+  if (!exam) return;
+
+  const sectionRows = await db.select().from(examSections).where(eq(examSections.examId, exam.id));
+  const sectionIds = sectionRows.map((x) => x.id);
+  const questionRows = sectionIds.length
+    ? await db.select().from(examQuestions).where(inArray(examQuestions.sectionId, sectionIds))
+    : [];
+  const answerRows = await db.select().from(examAnswers).where(eq(examAnswers.attemptId, attemptId));
+  const optionIds = answerRows.map((a) => a.selectedOptionId).filter((id): id is string => !!id);
+  const optionRows = optionIds.length
+    ? await db.select().from(examOptions).where(inArray(examOptions.id, optionIds))
+    : [];
+  const optionById = new Map(optionRows.map((o) => [o.id, o]));
+  const answerByQuestion = new Map(answerRows.map((a) => [a.questionId, a]));
+
+  const totalMarks = questionRows.reduce((sum, q) => sum + q.marks, 0);
+  let scoreMarks = 0;
+  const sectionScored = new Map<string, { earned: number; total: number }>();
+  for (const sec of sectionRows) sectionScored.set(sec.id, { earned: 0, total: 0 });
+  for (const q of questionRows) {
+    const a = answerByQuestion.get(q.id);
+    const auto = a?.selectedOptionId && optionById.get(a.selectedOptionId)?.isCorrect ? q.marks : 0;
+    const earned = a?.awardedMarks ?? auto;
+    const entry = sectionScored.get(q.sectionId)!;
+    entry.total += q.marks;
+    entry.earned += earned;
+    scoreMarks += earned;
+  }
+  const scorePercent = totalMarks > 0 ? (scoreMarks / totalMarks) * 100 : 0;
+  const mustPassCodes = (exam.mustPassSections ?? "")
+    .split(",")
+    .map((c) => c.trim())
+    .filter(Boolean);
+  const mustPassSectionsOk = mustPassCodes.every((code) => {
+    const section = sectionRows.find((x) => x.code === code);
+    if (!section) return true;
+    const scored = sectionScored.get(section.id);
+    return scored ? scored.earned >= scored.total : true;
+  });
+  const passed = scorePercent >= exam.passPercent && mustPassSectionsOk;
+
+  await db
+    .update(examAttempts)
+    .set({ scoreMarks, totalMarks, scorePercent, passed, mustPassSectionsOk })
+    .where(eq(examAttempts.id, attemptId));
+}
+
+export type AdjustAnswerState = { error: string } | { success: true } | undefined;
+
+/**
+ * 13 Oct 2026 (Riaan: "if CFI verifies or reviews the exam answers, I must
+ * be able to edit and change the mark, with note, discuss, and corrected
+ * with student. If corrected it will remark and correct" -- then: "I must
+ * be able to change the answer to the correct one, change the mark and
+ * also give the point ... if fail it must be changed to pass with the note
+ * correction"). CFI-only, for a submitted or verified online attempt:
+ *  - answer: change the student's chosen option (e.g. to the correct one);
+ *    the student's own first answer is kept (originalOptionId).
+ *  - marks: override the question's mark (blank = automatic, i.e. full
+ *    marks when the -- possibly corrected -- answer is right).
+ *  - note: shown to the student with their results.
+ *  - action "correct": one click -- set the answer to the correct option,
+ *    automatic (full) marks, note defaults to "Corrected after review."
+ *  - reset "1": back to the student's own answer, automatic mark, no note.
+ * Then the whole attempt is re-marked (total, %, must-pass, PASS/FAIL).
+ */
+export async function adjustExamAnswer(
+  attemptId: string,
+  questionId: string,
+  _prev: AdjustAnswerState,
+  formData: FormData
+): Promise<AdjustAnswerState> {
+  const cfi = await requireCFI();
+
+  const [attempt] = await db
+    .select()
+    .from(examAttempts)
+    .where(eq(examAttempts.id, attemptId))
+    .limit(1);
+  if (!attempt || attempt.source !== "online") return { error: "Exam attempt not found." };
+  if (attempt.status === "in_progress") {
+    return { error: "The student hasn't submitted this exam yet." };
+  }
+  const [question] = await db
+    .select()
+    .from(examQuestions)
+    .where(eq(examQuestions.id, questionId))
+    .limit(1);
+  if (!question) return { error: "Question not found." };
+  const options = await db.select().from(examOptions).where(eq(examOptions.questionId, questionId));
+
+  const [existing] = await db
+    .select()
+    .from(examAnswers)
+    .where(and(eq(examAnswers.attemptId, attemptId), eq(examAnswers.questionId, questionId)))
+    .limit(1);
+  // The student's own answer, whatever staff have done since.
+  const studentAnswer = existing?.answerChanged ? existing.originalOptionId : (existing?.selectedOptionId ?? null);
+
+  const reset = formData.get("reset") === "1";
+  const quickCorrect = formData.get("action") === "correct";
+  let answerId: string | null = existing?.selectedOptionId ?? null;
+  let awardedMarks: number | null = null;
+  let note = String(formData.get("note") ?? "").trim();
+
+  if (reset) {
+    answerId = studentAnswer;
+    note = "";
+  } else if (quickCorrect) {
+    const correct = options.find((o) => o.isCorrect);
+    if (!correct) return { error: "This question has no correct answer set in Exam content." };
+    answerId = correct.id;
+    if (!note) note = "Corrected after review.";
+  } else {
+    const answerRaw = String(formData.get("answer") ?? "").trim();
+    if (answerRaw) {
+      if (!options.some((o) => o.id === answerRaw)) return { error: "That answer isn't one of this question's options." };
+      answerId = answerRaw;
+    }
+    const marksRaw = String(formData.get("marks") ?? "").trim().replace(",", ".");
+    if (marksRaw !== "") {
+      const n = Number(marksRaw);
+      if (!Number.isFinite(n) || n < 0 || n > question.marks) {
+        return { error: `Marks must be between 0 and ${question.marks}.` };
+      }
+      awardedMarks = n;
+    }
+  }
+
+  const answerChanged = answerId !== studentAnswer;
+  const touched = answerChanged || awardedMarks !== null || !!note;
+  const now = new Date();
+  const fields = {
+    selectedOptionId: answerId,
+    originalOptionId: answerChanged ? studentAnswer : null,
+    answerChanged,
+    awardedMarks,
+    staffNote: note || null,
+    markedByUserId: touched ? cfi.id : null,
+    markedAt: touched ? now : null,
+    updatedAt: now,
+  };
+  if (existing) {
+    await db.update(examAnswers).set(fields).where(eq(examAnswers.id, existing.id));
+  } else if (touched) {
+    await db.insert(examAnswers).values({ attemptId, questionId, ...fields });
+  }
+
+  await rescoreExamAttempt(attemptId);
+
+  revalidatePath(`/instructor/students/${attempt.studentId}`);
+  revalidatePath(`/instructor/students/${attempt.studentId}/exams/${attempt.examId}`);
+  revalidatePath("/instructor");
+  revalidatePath("/student");
+  revalidatePath(`/student/exams/${attempt.examId}`);
+  return { success: true };
+}
+
+export type StaffPaperUploadState = { error: string } | { success: true } | undefined;
+
+/**
+ * 9 Oct 2026 (Riaan: "I need to be able to upload an exam for a student as
+ * CFI, or delete the file and then verify pass or fail"): the staff side of
+ * submitPaperExam above -- a CFI/instructor uploads a paper exam (or, for
+ * the radio exam, the student's SACAA radio licence) straight from the
+ * student's folio, for a student who hasn't submitted anything themselves.
+ * Same storage as the student's own upload (the student's upload folder),
+ * so View / Download / New upload / Delete / Mark passed / Mark failed on
+ * the review page all work on it unchanged. The reviewer can also record
+ * the result in the same step ("result" = pending | passed | failed).
+ *
+ * Allowed when the exam is not started, after a verified fail (a retake;
+ * staff aren't held to the retry wait), or over an online attempt the
+ * student opened but never answered. Blocked if the student has answered
+ * questions online or already has a submission awaiting review / passed.
+ */
+export async function staffSubmitPaperExam(
+  studentId: string,
+  examId: string,
+  _prevState: StaffPaperUploadState,
+  formData: FormData
+): Promise<StaffPaperUploadState> {
+  const staff = await requireInstructor();
+
+  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
+  if (!exam) return { error: "Exam not found." };
+
+  const current = await latestAttempt(studentId, examId);
+  let replaceEmptyAttemptId: string | null = null;
+  if (current) {
+    if (current.status === "verified" && current.passed) {
+      return { error: "This exam is already passed." };
+    }
+    if (current.status === "submitted") {
+      return { error: "This exam already has a submission awaiting review -- open Review & verify." };
+    }
+    if (current.status === "in_progress") {
+      const [{ n }] = await db
+        .select({ n: sql<number>`count(*)` })
+        .from(examAnswers)
+        .where(eq(examAnswers.attemptId, current.id));
+      if (Number(n) > 0) {
+        return {
+          error: `The student has started this exam online (${n} answered). They need to finish or you can review it once submitted.`,
+        };
+      }
+      replaceEmptyAttemptId = current.id;
+    }
+  }
+
+  const file = formData.get("proofFile");
+  if (!(file instanceof File) || file.size === 0) {
+    return { error: "Choose the scanned exam (or licence) to upload." };
+  }
+  const licenseNumberRaw = formData.get("licenseNumber");
+  const licenseNumber = typeof licenseNumberRaw === "string" ? licenseNumberRaw.trim() : "";
+  const resultRaw = String(formData.get("result") ?? "pending");
+  const result = resultRaw === "passed" || resultRaw === "failed" ? resultRaw : "pending";
+
+  let proofFile: string | null;
+  try {
+    proofFile = await saveUpload(studentId, `paper-exam-${exam.slug}`, file);
+  } catch (err) {
+    return { error: err instanceof UploadError ? err.message : "Upload failed." };
+  }
+  if (!proofFile) return { error: "Choose the scanned exam (or licence) to upload." };
+
+  if (replaceEmptyAttemptId) {
+    await db.delete(examAttempts).where(eq(examAttempts.id, replaceEmptyAttemptId));
+  }
+  const attemptNumber =
+    replaceEmptyAttemptId && current ? current.attemptNumber : (current?.attemptNumber ?? 0) + 1;
+  const now = new Date();
+  await db.insert(examAttempts).values({
+    studentId,
+    examId,
+    attemptNumber,
+    status: result === "pending" ? "submitted" : "verified",
+    submittedAt: now,
+    source: "paper",
+    proofFile,
+    externalLicenseNumber: exam.category === "rt" && licenseNumber ? licenseNumber : null,
+    ...(result === "pending"
+      ? {}
+      : { passed: result === "passed", verifiedAt: now, verifiedByUserId: staff.id }),
+  });
+
+  revalidatePath(`/instructor/students/${studentId}`);
+  revalidatePath(`/instructor/students/${studentId}/exams/${examId}`);
+  revalidatePath("/instructor");
+  revalidatePath("/student");
+  revalidatePath(`/student/exams/${examId}`);
+  return { success: true };
+}
+
 /** CFI/Admin reviews a paper submission and decides pass/fail -- the
  * counterpart to verifyExamAttempt above, but for a "paper" attempt
  * `passed` isn't already computed, so the reviewer sets it explicitly
```

### `src/lib/progress.ts` (batch 56)
```diff
--- a/src/lib/progress.ts
+++ b/src/lib/progress.ts
@@ -15,6 +15,7 @@
   type SectionPhase,
   type SectionTrainingType,
 } from "@/lib/syllabus-tags";
+import { compareByName } from "@/lib/sort-by-name";
 
 export type ExerciseWithProgress = {
   id: string;
@@ -221,7 +222,7 @@
     pendingLogbookCounts.map((r) => [r.studentId, Number(r.count)])
   );
 
-  return students.map((s) => {
+  return [...students].sort(compareByName).map((s) => {
     const ids = applicableExerciseIds(s.trainingType);
     const done = signedOffByStudent.get(s.id);
     return {
```

### `src/lib/admin-students.ts` (batch 56)
```diff
--- a/src/lib/admin-students.ts
+++ b/src/lib/admin-students.ts
@@ -3,6 +3,7 @@
 import { and, eq } from "drizzle-orm";
 import { db } from "@/db";
 import { users, studentProfiles } from "@/db/schema";
+import { compareByName } from "@/lib/sort-by-name";
 
 export type AdminStudentRow = {
   id: string; // user id
@@ -63,7 +64,7 @@
   ]);
   const profileByUser = new Map(profileRows.map((p) => [p.userId, p]));
 
-  return userRows.flatMap((u) => {
+  return [...userRows].sort(compareByName).flatMap((u) => {
     const p = profileByUser.get(u.id);
     if (!p) return []; // no student profile row -- not a real student account
     return [
```

### `src/lib/pilots.ts` (batch 56)
```diff
--- a/src/lib/pilots.ts
+++ b/src/lib/pilots.ts
@@ -2,6 +2,7 @@
 import { eq, and, isNotNull } from "drizzle-orm";
 import { db } from "@/db";
 import { users, pilotProfiles, pilotEndorsements } from "@/db/schema";
+import { compareByName } from "@/lib/sort-by-name";
 
 export type PilotSummary = {
   id: string; // user id
@@ -72,7 +73,7 @@
       caaLicenceExpiryDate: r.caaLicenceExpiryDate,
       caaLicenceRenewalSubmittedAt: r.caaLicenceRenewalSubmittedAt,
     }))
-    .sort((a, b) => a.name.localeCompare(b.name));
+    .sort(compareByName);
 }
 
 /** A CFI/instructor is very often also a pilot (Notes4 item 24, flagged
```

### `src/db/schema.ts` (batch 57, 58)
```diff
--- a/src/db/schema.ts
+++ b/src/db/schema.ts
@@ -747,6 +747,24 @@
     selectedOptionId: text("selected_option_id").references(
       () => examOptions.id
     ),
+    // 13 Oct 2026 (Riaan: "if CFI verifies or reviews the exam answers, I
+    // must be able to edit and change the mark, with note ... if corrected
+    // it will remark"). awardedMarks overrides the automatic mark for this
+    // question (null = automatic: full marks if the chosen option is
+    // correct, else 0). staffNote is the CFI's note to the student, shown
+    // on the student's results once the attempt is verified. A row can
+    // exist with no selectedOptionId when the CFI marks an unanswered
+    // question.
+    // 13 Oct 2026 (follow-up): when the CFI changes the student's answer
+    // (e.g. to the correct option after discussing it), the student's own
+    // first answer is kept here so the change stays visible. Null = the
+    // answer was never changed by staff.
+    originalOptionId: text("original_option_id").references(() => examOptions.id),
+    answerChanged: integer("answer_changed", { mode: "boolean" }).notNull().default(false),
+    awardedMarks: real("awarded_marks"),
+    staffNote: text("staff_note"),
+    markedByUserId: text("marked_by_user_id").references(() => users.id),
+    markedAt: integer("marked_at", { mode: "timestamp" }),
     updatedAt: integer("updated_at", { mode: "timestamp" })
       .notNull()
       .default(sql`(unixepoch())`),
```

### `src/lib/exams.ts` (batch 57, 58)
```diff
--- a/src/lib/exams.ts
+++ b/src/lib/exams.ts
@@ -210,6 +210,16 @@
   stemImage: string | null;
   options: ExamOptionView[];
   selectedOptionId: string | null;
+  /** CFI's adjusted mark for this question (null = automatic). Only filled
+   * in when answers are revealed (staff review, or the student's own
+   * verified results). */
+  awardedMarks: number | null;
+  /** CFI's note to the student on this question (revealed views only). */
+  staffNote: string | null;
+  /** True when staff changed the student's answer (revealed views only);
+   * originalOptionId is the student's own answer then (null = left blank). */
+  answerChanged: boolean;
+  originalOptionId: string | null;
 };
 
 export type ExamSectionView = {
@@ -250,6 +260,8 @@
   source: "online" | "paper";
   proofFile: string | null;
   externalLicenseNumber: string | null;
+  /** How many questions the CFI corrected (answer, mark or note). */
+  correctedCount: number;
 };
 
 export type AttemptSummary = Pick<
@@ -359,6 +371,7 @@
     ? await db.select().from(examAnswers).where(eq(examAnswers.attemptId, attemptRow.id))
     : [];
   const answerByQuestion = new Map(answerRows.map((a) => [a.questionId, a.selectedOptionId]));
+  const answerRowByQuestion = new Map(answerRows.map((a) => [a.questionId, a]));
 
   const optionsByQuestion = new Map<string, typeof optionRows>();
   for (const o of optionRows) {
@@ -384,6 +397,10 @@
           marks: q.marks,
           stemImage: q.stemImage,
           selectedOptionId: answerByQuestion.get(q.id) ?? null,
+          awardedMarks: reveal ? (answerRowByQuestion.get(q.id)?.awardedMarks ?? null) : null,
+          staffNote: reveal ? (answerRowByQuestion.get(q.id)?.staffNote ?? null) : null,
+          answerChanged: reveal ? !!answerRowByQuestion.get(q.id)?.answerChanged : false,
+          originalOptionId: reveal ? (answerRowByQuestion.get(q.id)?.originalOptionId ?? null) : null,
           options: opts.map((o) => ({
             id: o.id,
             label: o.label as "A" | "B" | "C" | "D",
@@ -428,6 +445,9 @@
           source: attemptRow.source as "online" | "paper",
           proofFile: attemptRow.proofFile,
           externalLicenseNumber: attemptRow.externalLicenseNumber,
+          correctedCount: answerRows.filter(
+            (a) => a.answerChanged || a.awardedMarks !== null || !!a.staffNote
+          ).length,
         }
       : null,
   };
```

### `src/lib/exam-print.ts` (batch 57, 58)
```diff
--- a/src/lib/exam-print.ts
+++ b/src/lib/exam-print.ts
@@ -19,6 +19,7 @@
   TableBorders,
 } from "docx";
 import type { ExamDetail, AttemptView } from "@/lib/exams";
+import { effectiveMarks } from "@/lib/exam-marks";
 
 const NO_BORDERS = TableBorders.NONE;
 
@@ -114,11 +115,9 @@
   // letters over a fraction of marks-obtained over marks-available, e.g.
   // "12 + 16.5 + ... = 61.5 = 31.5%" with the section totals (20 50 34 67
   // 9 15 195) as the denominators and "Pass Mark = 85%" alongside them.
+  // Uses the CFI's corrected mark where one was set (13 Oct 2026).
   const sectionEarned = exam.sections.map((s) =>
-    s.questions.reduce((sum, q) => {
-      const sel = q.options.find((o) => o.id === q.selectedOptionId);
-      return sum + (sel?.isCorrect ? q.marks : 0);
-    }, 0)
+    s.questions.reduce((sum, q) => sum + effectiveMarks(q), 0)
   );
   const grandEarned = sectionEarned.reduce((a, b) => a + b, 0);
   const grandTotal = exam.totalMarks;
@@ -385,7 +384,8 @@
       // the other options, so the paper reads as an open-answer exam
       // rather than a multiple-choice one.
       const selected = q.options.find((o) => o.id === q.selectedOptionId);
-      const isCorrect = !!selected?.isCorrect;
+      const got = effectiveMarks(q);
+      const isCorrect = got >= q.marks;
       const humanNumber = q.code.replace(/^[A-F]\./, "");
       const promptText = q.printPrompt ?? q.prompt;
 
@@ -458,6 +458,29 @@
         );
       }
       body.push(...answerRuns);
+      if (q.awardedMarks !== null || q.staffNote || q.answerChanged) {
+        const orig = q.options.find((o) => o.id === q.originalOptionId);
+        body.push(
+          new Paragraph({
+            spacing: { before: 40 },
+            children: [
+              ...(q.answerChanged
+                ? [
+                    new TextRun({
+                      text: `Answer corrected by instructor (student's answer: ${orig ? orig.text ?? orig.label : "none"}). `,
+                      bold: true,
+                      color: "8a5a00",
+                    }),
+                  ]
+                : []),
+              ...(q.awardedMarks !== null
+                ? [new TextRun({ text: `Mark corrected: ${fmtMark(got)} / ${q.marks}. `, bold: true, color: "8a5a00" })]
+                : []),
+              ...(q.staffNote ? [new TextRun({ text: `Instructor note: ${q.staffNote}`, italics: true })] : []),
+            ],
+          })
+        );
+      }
     }
 
     const sIdx = exam.sections.indexOf(section);
```

### `src/app/student/exams/[examId]/exam-form.tsx` (batch 57, 58)
```diff
--- a/src/app/student/exams/[examId]/exam-form.tsx
+++ b/src/app/student/exams/[examId]/exam-form.tsx
@@ -4,6 +4,7 @@
 import { useRouter } from "next/navigation";
 import { saveExamAnswer, submitExam, startNewAttempt } from "@/lib/actions/exams";
 import type { ExamDetail, AttemptView, AttemptSummary } from "@/lib/exams";
+import { formatMarks } from "@/lib/exam-marks";
 
 function mediaUrl(slug: string, filename: string) {
   return `/exam-media/${slug}/${filename}`;
@@ -264,7 +265,7 @@
             {attempt.passed ? "PASS" : "FAIL"} (Attempt {attempt.attemptNumber})
           </span>
           {" — "}
-          {attempt.scoreMarks} / {attempt.totalMarks} marks (
+          {formatMarks(attempt.scoreMarks ?? 0)} / {attempt.totalMarks} marks (
           {attempt.scorePercent?.toFixed(1)}%). Verified by {attempt.verifiedByName}
           {attempt.verifiedAt ? ` on ${attempt.verifiedAt.toLocaleDateString()}` : ""}.
           {!attempt.mustPassSectionsOk && (
@@ -273,6 +274,12 @@
               correct to pass, regardless of overall score.
             </span>
           )}
+          {attempt.correctedCount > 0 && (
+            <span className="block font-medium">
+              {attempt.correctedCount} question{attempt.correctedCount > 1 ? "s were" : " was"} corrected by
+              your instructor after review -- see the notes below. Your marks include the corrections.
+            </span>
+          )}
           {canRetry && !retryAvailableNow && nextRetryAt && (
             <div className="mt-3 font-medium">
               You can attempt this exam again from {nextRetryAt.toLocaleDateString()} (
@@ -376,6 +383,25 @@
                   />
                 ))}
               </div>
+              {reveal && (q.awardedMarks !== null || q.staffNote || q.answerChanged) && (
+                <div className="mt-3 rounded-md border-l-4 border-amber-300 bg-amber-50 px-3 py-2 text-sm text-slate-700">
+                  {q.answerChanged && (
+                    <p className="font-medium">
+                      Corrected by your instructor. Your answer was:{" "}
+                      {(() => {
+                        const orig = q.options.find((o) => o.id === q.originalOptionId);
+                        return orig ? `${orig.label}${orig.text ? `. ${orig.text}` : ""}` : "no answer";
+                      })()}
+                    </p>
+                  )}
+                  {q.awardedMarks !== null && (
+                    <p className="font-medium">
+                      Mark corrected by your instructor: {formatMarks(q.awardedMarks)} / {q.marks}
+                    </p>
+                  )}
+                  {q.staffNote && <p className="whitespace-pre-wrap">{q.staffNote}</p>}
+                </div>
+              )}
             </div>
           ))}
         </section>
```

### New file: `src/app/instructor/students/[id]/staff-paper-upload.tsx` (batch 55)
```tsx
"use client";

import { useActionState, useState } from "react";
import { staffSubmitPaperExam, type StaffPaperUploadState } from "@/lib/actions/exams";

/** 9 Oct 2026: on the CFI/instructor's view of a student's folio, lets
 * staff upload a paper exam (or radio licence) for the student and, if they
 * like, record the result in the same step. See staffSubmitPaperExam. */
export default function StaffPaperUpload({
  studentId,
  examId,
  isRadio,
  label,
}: {
  studentId: string;
  examId: string;
  isRadio: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const bound = staffSubmitPaperExam.bind(null, studentId, examId);
  const [state, formAction, isPending] = useActionState<StaffPaperUploadState, FormData>(
    bound,
    undefined
  );

  // Close the form once an upload has saved. (After a FAIL the button stays
  // on the card for the retake, so it must go back to its closed state.)
  const [handled, setHandled] = useState<StaffPaperUploadState>(undefined);
  if (state !== handled) {
    setHandled(state);
    if (state && "success" in state) setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {label}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="w-full space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:w-96"
    >
      <label className="block text-sm">
        <span className="font-medium text-slate-700">
          {isRadio ? "Scanned paper exam or SACAA radio licence" : "Scanned paper exam"}
        </span>
        <input
          name="proofFile"
          type="file"
          required
          accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif"
          className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
        />
        <span className="mt-1 block text-xs text-slate-500">PDF or photo, max 10MB.</span>
      </label>
      {isRadio && (
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Radio licence number (if it&apos;s a licence)</span>
          <input
            name="licenseNumber"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </label>
      )}
      <label className="block text-sm">
        <span className="font-medium text-slate-700">Result</span>
        <select
          name="result"
          defaultValue="pending"
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="pending">Mark later (awaiting review)</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
        </select>
      </label>
      {state && "error" in state && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "Uploading..." : "Upload"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

### New file: `src/lib/sort-by-name.ts` (batch 56)
```ts
// Alphabetical order for people lists (9 Oct 2026, Riaan: "the student and
// pilot list, can we make it that the order is alphabetic, sort on name").
// SQLite's ORDER BY name is case-sensitive ("Zak" before "andre") and counts
// stray spaces, so lists are sorted here instead: A-Z, ignoring case,
// accents and leading/trailing spaces.
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

export function compareByName(a: { name: string | null }, b: { name: string | null }): number {
  return collator.compare((a.name ?? "").trim(), (b.name ?? "").trim());
}
```

### New file: `src/lib/exam-marks.ts` (batch 57)
```ts
// Marks per question, shared by the CFI review page, the student's results,
// the marked-exam .docx and re-scoring (13 Oct 2026). Client-safe.
//
// A question's mark is the CFI's adjusted mark when one is set, otherwise
// the automatic mark: full marks if the student's chosen option is correct,
// else 0.
export function effectiveMarks(q: {
  marks: number;
  selectedOptionId: string | null;
  awardedMarks?: number | null;
  options: { id: string; isCorrect?: boolean }[];
}): number {
  if (q.awardedMarks !== null && q.awardedMarks !== undefined) return q.awardedMarks;
  const selected = q.options.find((o) => o.id === q.selectedOptionId);
  return selected?.isCorrect ? q.marks : 0;
}

export function formatMarks(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, "");
}
```

### New file: `src/app/instructor/students/[id]/exams/[examId]/adjust-mark-form.tsx` (batch 57, 58)
```tsx
"use client";

import { useActionState, useState } from "react";
import { adjustExamAnswer, type AdjustAnswerState } from "@/lib/actions/exams";

type Option = { id: string; label: string; text: string | null; isCorrect?: boolean };

/** 13 Oct 2026: CFI-only, under each question of an online exam review --
 * mark the question correct in one click, or change the answer, the mark
 * and/or leave a note for the student. Saving re-marks the whole exam
 * (see adjustExamAnswer), so a FAIL can become a PASS. */
export default function AdjustMarkForm({
  attemptId,
  questionId,
  maxMarks,
  autoMarks,
  awardedMarks,
  staffNote,
  options,
  selectedOptionId,
  isCorrected,
}: {
  attemptId: string;
  questionId: string;
  maxMarks: number;
  autoMarks: number;
  awardedMarks: number | null;
  staffNote: string | null;
  options: Option[];
  selectedOptionId: string | null;
  /** Answer, mark or note already changed by the CFI. */
  isCorrected: boolean;
}) {
  const [open, setOpen] = useState(false);
  const bound = adjustExamAnswer.bind(null, attemptId, questionId);
  const [state, formAction, isPending] = useActionState<AdjustAnswerState, FormData>(bound, undefined);
  const [handled, setHandled] = useState<AdjustAnswerState>(undefined);
  if (state !== handled) {
    setHandled(state);
    if (state && "success" in state) setOpen(false);
  }
  const isRight = autoMarks >= maxMarks && awardedMarks === null;

  const quickCorrect = !isRight && options.some((o) => o.isCorrect) && (
    <form action={formAction} className="inline">
      <input type="hidden" name="action" value="correct" />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md border border-green-300 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-60"
      >
        {isPending ? "Saving..." : "✔ Mark correct (full marks)"}
      </button>
    </form>
  );

  if (!open) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {quickCorrect}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-red-600 hover:underline"
        >
          {isCorrected ? "Edit correction" : "Change answer / mark / add note"}
        </button>
        {state && "error" in state && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="block text-xs text-slate-600">
        Answer
        <select
          name="answer"
          defaultValue={selectedOptionId ?? ""}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
        >
          {!selectedOptionId && <option value="">(no answer)</option>}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}. {o.text ?? "(picture)"}
              {o.isCorrect ? "  ✔ correct" : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600">
          Marks (out of {maxMarks})
          <input
            name="marks"
            type="number"
            min={0}
            max={maxMarks}
            step={0.5}
            defaultValue={awardedMarks ?? ""}
            placeholder="automatic"
            className="mt-1 block w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <span className="pb-1 text-xs text-slate-500">
          Leave blank for the automatic mark: full marks if the answer above is correct, else 0.
        </span>
      </div>
      <label className="block text-xs text-slate-600">
        Note to the student (shown with their results)
        <textarea
          name="note"
          rows={2}
          defaultValue={staffNote ?? ""}
          placeholder="e.g. Discussed -- your reasoning was right, marked correct."
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      {state && "error" in state && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save & re-mark"}
        </button>
        {isCorrected && (
          <button
            type="submit"
            name="reset"
            value="1"
            disabled={isPending}
            className="text-sm text-slate-600 hover:text-red-600"
          >
            Undo correction (student&apos;s own answer)
          </button>
        )}
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">
          Cancel
        </button>
      </div>
    </form>
  );
}
```

---

## Batch 59 addendum: CFI sets the final result PASS / FAIL (13 Oct, later the same day)

**Why:** Riaan's screenshot — a student (Basic Licence Theory Test) on **194/195 = 99.5%, still FAIL**, after 3 questions were corrected: "after correction, I need to pass the student. It is showing fail." The PG exam has a **must-pass rule**: every Airlaw (Section E) question needs full marks, whatever the overall %. One Airlaw question was still short, so batch 58's corrections didn't change the result.

**What it does:**
- **Must-pass list:** when must-pass questions aren't at full marks, the CFI's review banner lists them ("Must-pass question not at full marks: E.42"), each a link jumping to that question (cards now have `id="q-<questionId>"`), so the CFI can **✔ Mark correct** it.
- **Set final result (PASS / FAIL):** CFI-only button next to "Download marked exam". Choose PASS or FAIL, a note is required (the student sees it) → **Save final result**. Verifies an unverified attempt at the same time. The CFI's result wins over the calculated one and **survives later re-marking** (`rescoreExamAttempt` keeps it). The button becomes **Change final result**, with **Back to calculated result** to remove it.
- Shown on: CFI banner ("Final result set by the CFI: PASS — note"; the must-pass warning is hidden when the CFI set PASS), folio exam card (Verified — PASS), the student's results ("Final result set by your instructor: PASS — note"), and the marked .docx.
- Gotcha fixed in testing: "Back to calculated result" posts its own field `clear=1`. Don't give it `name="result"` — the PASS/FAIL radios also post `result`, and `FormData.get` returns the first one, so the clear was ignored.

**Test:** open a student's online PG exam where one Section E question is wrong (e.g. 194/195) → banner shows FAIL and lists the question → click it → ✔ Mark correct → PASS. Undo it, then Set final result → Save with no note (error) → add a note → PASS + verified. Change another question's mark → still PASS. Back to calculated result → FAIL. Student login sees PASS + the note. A regular instructor sees no final-result button.

**Migration:** after applying the patch, generate Sky's own migration (don't copy Apex's `0041_exam_result_override`):

```bash
npm run db:generate -- --name exam_result_override
```

On the Sky copy (with the 53–58 patches applied) this produced `drizzle/0040_exam_result_override.sql`:

```sql
ALTER TABLE `exam_attempts` ADD `result_override` text;
ALTER TABLE `exam_attempts` ADD `result_override_note` text;
ALTER TABLE `exam_attempts` ADD `result_override_by_user_id` text REFERENCES users(id);
ALTER TABLE `exam_attempts` ADD `result_override_at` integer;
```

**Checked:** this patch applied cleanly to the Sky copy *after* the 53–58 patches above, the migration generated as shown, and the code type-checked. In Apex: 12/12 end-to-end checks, and batch 58's 12 checks re-run with no change.

**Patch** (7 files: 6 changed + new `result-override-form.tsx`; apply with `patch -p1` or `git apply` from the Sky repo root, after the 53–58 patches):

```diff
diff --git a/src/app/instructor/students/[id]/exams/[examId]/page.tsx b/src/app/instructor/students/[id]/exams/[examId]/page.tsx
index 0e9e498..e8d8089 100644
--- a/src/app/instructor/students/[id]/exams/[examId]/page.tsx
+++ b/src/app/instructor/students/[id]/exams/[examId]/page.tsx
@@ -6,6 +6,7 @@ import { requireInstructor } from "@/lib/auth/dal";
 import { getExamDetail, getAttemptHistory } from "@/lib/exams";
 import VerifyButton from "./verify-button";
 import AdjustMarkForm from "./adjust-mark-form";
+import ResultOverrideForm from "./result-override-form";
 import { effectiveMarks, formatMarks } from "@/lib/exam-marks";
 import VerifyPaperButton from "./verify-paper-button";
 import PaperAttemptAdminActions from "./paper-attempt-admin-actions";
@@ -55,6 +56,13 @@ export default async function ExamReviewPage(
   if (!detail || !detail.attempt || detail.attempt.status === "in_progress") notFound();
 
   const { exam, attempt } = detail;
+  // Questions in "must pass" sections (e.g. E = Airlaw) that aren't at full
+  // marks -- listed in the result box so the CFI can jump to them.
+  const mustPassCodes = (exam.mustPassSections ?? "").split(",").map((c) => c.trim()).filter(Boolean);
+  const mustPassMissing = exam.sections
+    .filter((sec) => mustPassCodes.includes(sec.code))
+    .flatMap((sec) => sec.questions)
+    .filter((q) => effectiveMarks(q) < q.marks);
 
   const historyTabs = history.length > 1 && (
     <div className="flex flex-wrap gap-2 text-xs">
@@ -162,7 +170,14 @@ export default async function ExamReviewPage(
             {student.name} — Attempt {attempt.attemptNumber}
           </p>
         </div>
-        <div className="flex items-center gap-3">
+        <div className="flex flex-wrap items-start justify-end gap-3">
+          {isCFI && (
+            <ResultOverrideForm
+              attemptId={attempt.id}
+              current={attempt.resultOverride}
+              currentNote={attempt.resultOverrideNote}
+            />
+          )}
           <a
             href={`/instructor/students/${id}/exams/${examId}/download?attempt=${attempt.id}`}
             className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
@@ -190,9 +205,9 @@ export default async function ExamReviewPage(
             {formatMarks(attempt.scoreMarks ?? 0)} / {attempt.totalMarks} marks ({attempt.scorePercent?.toFixed(1)}%).
             Verified by {attempt.verifiedByName}
             {attempt.verifiedAt ? ` on ${attempt.verifiedAt.toLocaleDateString()}` : ""}.
-            {!attempt.mustPassSectionsOk && (
+            {!attempt.mustPassSectionsOk && attempt.resultOverride !== "pass" && (
               <span className="block font-medium">
-                Not every Airlaw question was answered correctly — those must all be
+                Not every must-pass (Airlaw) question has full marks — those must all be
                 correct to pass, regardless of overall score.
               </span>
             )}
@@ -205,6 +220,26 @@ export default async function ExamReviewPage(
             Not yet verified.
           </>
         )}
+        {mustPassMissing.length > 0 && !attempt.resultOverride && (
+          <span className="mt-1 block text-xs">
+            Must-pass question{mustPassMissing.length > 1 ? "s" : ""} not at full marks:{" "}
+            {mustPassMissing.map((q, i) => (
+              <span key={q.id}>
+                {i > 0 && ", "}
+                <a href={`#q-${q.id}`} className="font-semibold underline">
+                  {q.code}
+                </a>
+              </span>
+            ))}
+            . Correct {mustPassMissing.length > 1 ? "them" : "it"} below, or set the final result yourself.
+          </span>
+        )}
+        {attempt.resultOverride && (
+          <span className="mt-1 block font-semibold">
+            Final result set by the CFI: {attempt.resultOverride === "pass" ? "PASS" : "FAIL"}
+            {attempt.resultOverrideNote ? ` — ${attempt.resultOverrideNote}` : ""}
+          </span>
+        )}
         {attempt.correctedCount > 0 && (
           <span className="mt-1 block text-xs font-medium">
             {attempt.correctedCount} question{attempt.correctedCount > 1 ? "s" : ""} corrected by the
@@ -233,7 +268,7 @@ export default async function ExamReviewPage(
               const full = got >= q.marks;
               const none = got <= 0;
               return (
-                <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
+                <div key={q.id} id={`q-${q.id}`} className="scroll-mt-4 rounded-xl border border-slate-200 bg-white p-4">
                   <div className="mb-2 flex items-start justify-between gap-3">
                     <p className="text-sm font-medium text-slate-900">
                       {q.code}. {q.prompt}
diff --git a/src/app/instructor/students/[id]/exams/[examId]/result-override-form.tsx b/src/app/instructor/students/[id]/exams/[examId]/result-override-form.tsx
new file mode 100644
index 0000000..c0451c1
--- /dev/null
+++ b/src/app/instructor/students/[id]/exams/[examId]/result-override-form.tsx
@@ -0,0 +1,87 @@
+"use client";
+
+import { useActionState, useState } from "react";
+import { setExamResultOverride, type ResultOverrideState } from "@/lib/actions/exams";
+
+/** 13 Oct 2026: CFI-only -- set the exam's final result to PASS or FAIL
+ * regardless of the calculated one (e.g. 99.5% failed only on the Airlaw
+ * must-pass rule), with a note the student sees. Also verifies an
+ * unverified attempt. "Back to calculated result" removes it. */
+export default function ResultOverrideForm({
+  attemptId,
+  current,
+  currentNote,
+}: {
+  attemptId: string;
+  current: "pass" | "fail" | null;
+  currentNote: string | null;
+}) {
+  const [open, setOpen] = useState(false);
+  const bound = setExamResultOverride.bind(null, attemptId);
+  const [state, formAction, isPending] = useActionState<ResultOverrideState, FormData>(bound, undefined);
+  const [handled, setHandled] = useState<ResultOverrideState>(undefined);
+  if (state !== handled) {
+    setHandled(state);
+    if (state && "success" in state) setOpen(false);
+  }
+
+  if (!open) {
+    return (
+      <button
+        type="button"
+        onClick={() => setOpen(true)}
+        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
+      >
+        {current ? "Change final result" : "Set final result (PASS / FAIL)"}
+      </button>
+    );
+  }
+
+  return (
+    <form action={formAction} className="w-full space-y-2 rounded-lg border border-slate-200 bg-white p-3 sm:w-96">
+      <div className="text-sm font-semibold text-slate-900">Final result (CFI decision)</div>
+      <div className="flex gap-4 text-sm">
+        <label className="flex items-center gap-1.5">
+          <input type="radio" name="result" value="pass" defaultChecked={current !== "fail"} /> PASS
+        </label>
+        <label className="flex items-center gap-1.5">
+          <input type="radio" name="result" value="fail" defaultChecked={current === "fail"} /> FAIL
+        </label>
+      </div>
+      <label className="block text-xs text-slate-600">
+        Note to the student (required)
+        <textarea
+          name="note"
+          rows={2}
+          defaultValue={currentNote ?? ""}
+          placeholder="e.g. Airlaw answer discussed and accepted -- passed by the CFI."
+          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
+        />
+      </label>
+      {state && "error" in state && <p className="text-sm text-red-600">{state.error}</p>}
+      <div className="flex flex-wrap items-center gap-3">
+        <button
+          type="submit"
+          disabled={isPending}
+          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
+        >
+          {isPending ? "Saving..." : "Save final result"}
+        </button>
+        {current && (
+          <button
+            type="submit"
+            name="clear"
+            value="1"
+            disabled={isPending}
+            className="text-sm text-slate-600 hover:text-red-600"
+          >
+            Back to calculated result
+          </button>
+        )}
+        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-400 hover:text-slate-600">
+          Cancel
+        </button>
+      </div>
+    </form>
+  );
+}
diff --git a/src/app/student/exams/[examId]/exam-form.tsx b/src/app/student/exams/[examId]/exam-form.tsx
index 033c0da..f93f29a 100644
--- a/src/app/student/exams/[examId]/exam-form.tsx
+++ b/src/app/student/exams/[examId]/exam-form.tsx
@@ -268,12 +268,18 @@ export default function ExamForm({
           {formatMarks(attempt.scoreMarks ?? 0)} / {attempt.totalMarks} marks (
           {attempt.scorePercent?.toFixed(1)}%). Verified by {attempt.verifiedByName}
           {attempt.verifiedAt ? ` on ${attempt.verifiedAt.toLocaleDateString()}` : ""}.
-          {!attempt.mustPassSectionsOk && (
+          {!attempt.mustPassSectionsOk && attempt.resultOverride !== "pass" && (
             <span className="block font-medium">
               Note: not every Airlaw question was answered correctly — those must all be
               correct to pass, regardless of overall score.
             </span>
           )}
+          {attempt.resultOverride && (
+            <span className="block font-semibold">
+              Final result set by your instructor: {attempt.resultOverride === "pass" ? "PASS" : "FAIL"}
+              {attempt.resultOverrideNote ? ` — ${attempt.resultOverrideNote}` : ""}
+            </span>
+          )}
           {attempt.correctedCount > 0 && (
             <span className="block font-medium">
               {attempt.correctedCount} question{attempt.correctedCount > 1 ? "s were" : " was"} corrected by
diff --git a/src/db/schema.ts b/src/db/schema.ts
index e3c6119..212cf0b 100644
--- a/src/db/schema.ts
+++ b/src/db/schema.ts
@@ -667,6 +667,15 @@ export const examAttempts = sqliteTable("exam_attempts", {
   // field elsewhere) -- there's no dedicated radio-licence column on
   // studentProfiles, this is it.
   externalLicenseNumber: text("external_license_number"),
+  // 13 Oct 2026 (Riaan: "after correction, I need to pass the student. It
+  // is showing fail" -- 99.5% but one Airlaw mark short of the must-pass
+  // rule). CFI's own final result for an online attempt, overriding the
+  // calculated PASS/FAIL: "pass" | "fail" | null (= calculated). Kept
+  // through any later re-marking. The note is shown to the student.
+  resultOverride: text("result_override", { enum: ["pass", "fail"] }),
+  resultOverrideNote: text("result_override_note"),
+  resultOverrideByUserId: text("result_override_by_user_id").references(() => users.id),
+  resultOverrideAt: integer("result_override_at", { mode: "timestamp" }),
 });
 
 // ---------------------------------------------------------------------------
diff --git a/src/lib/actions/exams.ts b/src/lib/actions/exams.ts
index b66e5c5..f989e14 100644
--- a/src/lib/actions/exams.ts
+++ b/src/lib/actions/exams.ts
@@ -396,7 +396,10 @@ async function rescoreExamAttempt(attemptId: string) {
     const scored = sectionScored.get(section.id);
     return scored ? scored.earned >= scored.total : true;
   });
-  const passed = scorePercent >= exam.passPercent && mustPassSectionsOk;
+  const calculatedPass = scorePercent >= exam.passPercent && mustPassSectionsOk;
+  // A CFI's own final result (setExamResultOverride) wins over the
+  // calculated one and survives any later re-marking.
+  const passed = attempt.resultOverride ? attempt.resultOverride === "pass" : calculatedPass;
 
   await db
     .update(examAttempts)
@@ -515,6 +518,71 @@ export async function adjustExamAnswer(
   return { success: true };
 }
 
+export type ResultOverrideState = { error: string } | { success: true } | undefined;
+
+/**
+ * 13 Oct 2026 (Riaan, screenshot: 194/195 = 99.5% but FAIL because one
+ * Airlaw mark was missing -- "after correction, I need to pass the
+ * student"). CFI-only: sets the final result of an online attempt to PASS
+ * or FAIL regardless of the calculated one, with a note the student sees.
+ * A submitted (not yet verified) attempt is verified at the same time.
+ * formData: result ("pass" | "fail"), note (required); clear=1 goes back
+ * to the calculated result.
+ */
+export async function setExamResultOverride(
+  attemptId: string,
+  _prev: ResultOverrideState,
+  formData: FormData
+): Promise<ResultOverrideState> {
+  const cfi = await requireCFI();
+  const [attempt] = await db
+    .select()
+    .from(examAttempts)
+    .where(eq(examAttempts.id, attemptId))
+    .limit(1);
+  if (!attempt || attempt.source !== "online") return { error: "Exam attempt not found." };
+  if (attempt.status === "in_progress") return { error: "The student hasn't submitted this exam yet." };
+
+  const result = String(formData.get("result") ?? "");
+  const note = String(formData.get("note") ?? "").trim();
+  const now = new Date();
+
+  // "Back to calculated result" posts clear=1 (its own field: the PASS/FAIL
+  // radios also post "result", and FormData.get returns the first one).
+  if (formData.get("clear") === "1" || result === "clear") {
+    await db
+      .update(examAttempts)
+      .set({ resultOverride: null, resultOverrideNote: null, resultOverrideByUserId: null, resultOverrideAt: null })
+      .where(eq(examAttempts.id, attemptId));
+  } else if (result === "pass" || result === "fail") {
+    if (!note) return { error: "Add a short note saying why (the student will see it)." };
+    await db
+      .update(examAttempts)
+      .set({
+        resultOverride: result,
+        resultOverrideNote: note,
+        resultOverrideByUserId: cfi.id,
+        resultOverrideAt: now,
+        ...(attempt.status === "submitted"
+          ? { status: "verified" as const, verifiedAt: now, verifiedByUserId: cfi.id }
+          : {}),
+      })
+      .where(eq(examAttempts.id, attemptId));
+  } else {
+    return { error: "Choose PASS or FAIL." };
+  }
+
+  // Re-mark so `passed` follows the override (or the calculation again).
+  await rescoreExamAttempt(attemptId);
+
+  revalidatePath(`/instructor/students/${attempt.studentId}`);
+  revalidatePath(`/instructor/students/${attempt.studentId}/exams/${attempt.examId}`);
+  revalidatePath("/instructor");
+  revalidatePath("/student");
+  revalidatePath(`/student/exams/${attempt.examId}`);
+  return { success: true };
+}
+
 export type StaffPaperUploadState = { error: string } | { success: true } | undefined;
 
 /**
diff --git a/src/lib/exam-print.ts b/src/lib/exam-print.ts
index 2b935d3..8e7374a 100644
--- a/src/lib/exam-print.ts
+++ b/src/lib/exam-print.ts
@@ -212,7 +212,15 @@ export async function buildExamDocx(
         bold: true,
         color: attempt.passed ? "1a7a3a" : "c0392b",
       }),
-      ...(useSahpaMasterCover && !attempt.mustPassSectionsOk
+      ...(attempt.resultOverride
+        ? [
+            new TextRun({
+              text: `  (final result set by the CFI${attempt.resultOverrideNote ? `: ${attempt.resultOverrideNote}` : ""})`,
+              italics: true,
+            }),
+          ]
+        : []),
+      ...(useSahpaMasterCover && !attempt.mustPassSectionsOk && !attempt.resultOverride
         ? [
             new TextRun({
               text: "  (not every Airlaw question was correct -- those must all be right to pass)",
diff --git a/src/lib/exams.ts b/src/lib/exams.ts
index 8d20164..49d74a4 100644
--- a/src/lib/exams.ts
+++ b/src/lib/exams.ts
@@ -262,6 +262,9 @@ export type AttemptView = {
   externalLicenseNumber: string | null;
   /** How many questions the CFI corrected (answer, mark or note). */
   correctedCount: number;
+  /** CFI's own final result, overriding the calculated one (or null). */
+  resultOverride: "pass" | "fail" | null;
+  resultOverrideNote: string | null;
 };
 
 export type AttemptSummary = Pick<
@@ -445,6 +448,8 @@ export async function getExamDetail(
           source: attemptRow.source as "online" | "paper",
           proofFile: attemptRow.proofFile,
           externalLicenseNumber: attemptRow.externalLicenseNumber,
+          resultOverride: (attemptRow.resultOverride as "pass" | "fail" | null) ?? null,
+          resultOverrideNote: attemptRow.resultOverrideNote ?? null,
           correctedCount: answerRows.filter(
             (a) => a.answerChanged || a.awardedMarks !== null || !!a.staffNote
           ).length,
```

---

## Other notes from these days

- **User manual:** Apex has a living user manual (a Claude Doc) with a change log, updated with every batch. Sky would need its own copy with Sky's names and regulations.
- **Batch scripts:** when the chat is linked to Riaan's computer, Claude puts the `.ps1` straight into his Downloads folder. He then runs:
  ```
  cd C:\sky-adventures-portal
  powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\<script>.ps1"
  ```
- **Rebuilding Claude's working copy** (it can be wiped between sessions):
  1. Request access to the project folder.
  2. Stage `src/`, `drizzle/` (sql files, `meta/_journal.json` and the latest snapshot), `public/` logos and the root config files. A stage call takes at most 50 files.
  3. Run `npm ci`, `mkdir data`, `npm run db:migrate`, then seed.
  
  `src/app/instructor/students/[id]/exams/[examId]/download/route.ts` is too deep to stage (8 folders; the limit is 7). It hasn't changed since Apex batch 34, so take it from any earlier copy.
