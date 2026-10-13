# Apex Flight Hub — Chat Register & Project Rules
Companion to `team-apex-portal-status.md` (narrative/decisions record). Last updated 13 Oct 2026.

## Project rules (from Riaan's project instructions)
1. All chats in this project are linked; records, rules and files here are the shared reference.
2. A summary of the project and all chats is kept in memory at all times.
3. The status MD and the Excel tracker (`apex-flight-hub-tracker.xlsx`) are kept up to date for every chat in the project.
4. Riaan opens separate chats inside the project to isolate important changes; each one gets an entry below.
5. Line numbers from Riaan's 28 Sep 2026 master list are the reference numbering (V24 continued reuses 71-77 for the student redesign).
6. Parked items (line 54, renewal-time logbook review + SACAA doc pack) are not started without asking first.
7. Every delivered batch gets a row (or Batch-column entry) in the tracker; a later batch that includes an earlier one is shown as "N -> M".
8. Syllabus display order is **phase first** (Phase 1 → 2 → 3 → Conversion → Practical Theory), then training type, then the CFI's order — Riaan's rule, 1 Oct 2026 (batch 52).
9. **User manual** (8 Oct 2026): "Apex Flight Hub — User Manual", a living Claude Doc — https://claude.ai/code/artifact/ff76fa39-40ac-4e44-bd9a-c79334f88b1d. Sections: 1 Getting started, 2 Students, 3 Pilots, 4 Instructors, 5 CFI, 6 Admin, 7 WhatsApp, 8 Troubleshooting, 9 Manual change log. Every batch that changes what users see or do also updates the affected section(s) and adds a row (date · batch · change · sections, newest first) to section 9.
10. Sky Adventures is a **separate** project (own claude.ai project, code, GitHub, Railway). Work on it never touches Apex, and the reverse (Riaan, 5 Oct 2026). Apex changes Sky also wants are handed over as a porting MD with Sky-ready patches written against Sky's own files. Latest: `apex-changes-for-sky-adventures-6-13-oct-2026.md` (batches 53-59; batch 59 is an addendum patch applied after 53-58; replaces the 6-9 Oct file). Sky generates its own migrations rather than copying Apex's. No Apex student names go into Sky files.
11. People lists (students, pilots) are shown **A–Z by name**, ignoring case, accents and spaces — use `compareByName` in `src/lib/sort-by-name.ts` for any new list (batch 56).
12. When the session is linked to Riaan's computer, put each new batch script (and handover files) straight into his Downloads folder (he runs it from there).
13. Exam marks: a question's mark = the CFI's set mark if any, else automatic (full marks when the — possibly CFI-corrected — answer is right). Always use `effectiveMarks` in `src/lib/exam-marks.ts`; re-marking lives in `rescoreExamAttempt` (`src/lib/actions/exams.ts`). A CFI answer change keeps the student's own answer in `exam_answers.original_option_id` with `answer_changed = true` (batches 57-58).
14. Exam PASS/FAIL: calculated = score ≥ pass % **and** every must-pass section (PG: Airlaw, Section E) at full marks. A CFI's **final result** (`exam_attempts.result_override` pass|fail + required note) wins over the calculation and survives re-marking; "Back to calculated result" clears it (batch 59).

## Chat register

| # | Chat name | Started | Scope | Status |
|---|-----------|---------|-------|--------|
| 1 | Original portal chat(s) | 9 Sep 2026 → | Batches 1-59 (see status doc, full sections v55-v59), Sky Adventures fork (moved to its own project), user manual, Sky handover files | Batch 54 (includes 53) pushed 8 Oct 2026 (commit 98c5ed4). **Batch 59 (includes 55-58) delivered 13 Oct 2026**, in Riaan's Downloads — run 59 only (replaces 58). Then fix Herman Peacock's Basic Licence Theory result (one Airlaw question short → ✔ Mark correct, or Set final result PASS). Sky handover for 53-59 delivered 13 Oct. |
| 2 | New Student Screen and Exercises | 30 Sep 2026 | New student screen; training-folio exercises (V24 lines 71-77 + line 70 exercise info overlay) | Spec written here (`student-screen-exercises-spec.md`). **Built in chat 1 on 1 Oct 2026** as batches 50 (71-77) and 51 (line 70), order corrected to phase first in batch 52; decisions recorded in the spec doc. Any follow-up changes can continue in either chat — check the status doc first. |

## Cross-chat links
- Line 70 (exercise info button + Add+ overlay) — built in batch 51. Its `content_items` table is generic so line 62 (rating overlay) can reuse it; line 62 is not built yet.
- Lines 75-77 folio/syllabus order — batch 50, corrected by batch 52 (phase first).
- Exam review chain: batch 55 (CFI paper-exam upload) → 57 (change a mark + note) → 58 (change the answer; FAIL→PASS) → 59 (CFI final result + must-pass question links).
- Any change that touches the student folio, Manage Syllabus, study notes, exams or sign-up must be logged in the status doc, the tracker and the user manual — and, if Sky needs it, the next Sky handover file.

## Open housekeeping
- The tracker spreadsheet is regenerated and re-sent in chat after each change; it isn't stored in the project files.
- Not shipped (Riaan said "ignore, it worked", 9 Oct): CFI-only Mark passed / Mark failed / Delete buttons on every exam card for online attempts. Kept aside in Claude's working copy (git stash) in case it's wanted later.
