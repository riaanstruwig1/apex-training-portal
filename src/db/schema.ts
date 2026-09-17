import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Users & roles
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // null until an invited student/instructor sets a password
  name: text("name").notNull(),
  // "cfi" = Chief Flight Instructor / admin: full access, incl. managing
  // students and other instructors, the syllabus, and settings.
  // "instructor" = a regular instructor created by the CFI: can sign off
  // exercises and countersign logbook entries, nothing administrative.
  // "admin" = Office Manager: reviews/approves new sign-ups, no
  // instructional authority.
  // "pilot" = a licensed pilot / club member with no student folio.
  // A cfi/instructor account MAY also carry a pilotProfiles row (an
  // instructor is a pilot too) -- role stays "cfi"/"instructor" in that
  // case, it just gets a linked pilot profile alongside it.
  role: text("role", {
    enum: ["cfi", "instructor", "student", "pilot", "admin"],
  }).notNull(),
  // Invite token for an instructor account created by the CFI (mirrors
  // studentProfiles.inviteToken below, but instructors have no profile row
  // to hang it off of, so it lives here instead).
  inviteToken: text("invite_token").unique(),
  inviteTokenExpiresAt: integer("invite_token_expires_at", {
    mode: "timestamp",
  }),
  // Governs public self-sign-up (Student or Pilot). Accounts created
  // directly by the CFI (existing student-invite / instructor-invite flow)
  // are "active" from the start and never touch this gate.
  accountStatus: text("account_status", {
    enum: ["pending_verification", "active", "rejected", "suspended"],
  })
    .notNull()
    .default("active"),
  rejectionReason: text("rejection_reason"),

  // ---- Shared applicant/personal details, captured at public sign-up ----
  // (nullable -- existing CFI-created accounts predate this and don't have
  // them; the sign-up form is the only writer for new rows.)
  apexNumber: text("apex_number").unique(), // system-generated, e.g. "APEX-000123"
  title: text("title"),
  initials: text("initials"),
  nickname: text("nickname"),
  idPassportNumber: text("id_passport_number"),
  idPassportFile: text("id_passport_file"), // filename under data/uploads/<userId>/
  profilePictureFile: text("profile_picture_file"),
  dob: integer("dob", { mode: "timestamp" }),
  sex: text("sex"),
  phone: text("phone"),
  altPhone: text("alt_phone"),
  nokName: text("nok_name"),
  nokContactNo: text("nok_contact_no"),
  postalAddress: text("postal_address"),
  homeAddress: text("home_address"),
  clubName: text("club_name"),
  // Consent (CA 183-540) and Indemnity/Release -- required on every
  // application. Simple e-sign for now (typed full name + timestamp counts
  // as signature); populating the actual SACAA/SAHPA PDF is a later stage.
  consentSigned: integer("consent_signed", { mode: "boolean" })
    .notNull()
    .default(false),
  consentSignedAt: integer("consent_signed_at", { mode: "timestamp" }),
  consentSignedName: text("consent_signed_name"),
  indemnitySigned: integer("indemnity_signed", { mode: "boolean" })
    .notNull()
    .default(false),
  indemnitySignedAt: integer("indemnity_signed_at", { mode: "timestamp" }),
  indemnitySignedName: text("indemnity_signed_name"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Extra fields specific to a student pilot. One row per student user.
export const studentProfiles = sqliteTable("student_profiles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  phone: text("phone"),
  // What the student signed up to train toward -- gates which exam
  // categories they (and their instructor) see for them. Null means not
  // yet declared, e.g. an older account from before this field existed --
  // treated as "show everything" rather than hiding exams unexpectedly.
  trainingType: text("training_type", { enum: ["pg", "ppg", "ppt"] }),
  callSign: text("call_sign"), // radio call sign, e.g. "PPG-DYB"
  licenseNumber: text("license_number"),
  startDate: integer("start_date", { mode: "timestamp" }), // date the student started training
  sahpaNumber: text("sahpa_number"), // SAHPA membership / student pilot license (SPL) number
  sahpaExpiryDate: integer("sahpa_expiry_date", { mode: "timestamp" }), // SAHPA membership expiry
  dtoNumber: text("dto_number").default("SACAA-0012DTO"),
  shopifyCustomerId: text("shopify_customer_id").unique(),
  // Proof of Payment (POP) for training fees -- chat request, 16 Sep 2026.
  // A student uploads their own POP for safekeeping; until they have, the
  // app shows a "contact the office" note (no bank details stored in-app,
  // per Riaan) plus a one-click "request an invoice" that just flags the
  // office -- no document is generated, no Shopify integration (that's
  // still pending per the "Add a student" form's own note above).
  popFile: text("pop_file"),
  popUploadedAt: integer("pop_uploaded_at", { mode: "timestamp" }),
  invoiceRequestedAt: integer("invoice_requested_at", { mode: "timestamp" }),
  status: text("status", {
    enum: ["invited", "active", "suspended", "archived"],
  })
    .notNull()
    .default("invited"),
  inviteToken: text("invite_token").unique(),
  inviteTokenExpiresAt: integer("invite_token_expires_at", {
    mode: "timestamp",
  }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ---------------------------------------------------------------------------
// Syllabus: sections group exercises into a gated progression.
// Instructors can reorder/rename these from the admin UI -- the seed data
// below is a proposed grouping of DTO Manual Appendix A, not gospel.
// ---------------------------------------------------------------------------

export const sections = sqliteTable("sections", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  order: integer("order").notNull(),
});

export const exercises = sqliteTable(
  "exercises",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sectionId: text("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    code: text("code").notNull(), // e.g. "1", "1E", "10A", "12/13E"
    title: text("title").notNull(),
    description: text("description"),
    order: integer("order").notNull(),
  },
  (table) => [uniqueIndex("exercises_code_unique").on(table.code)]
);

// One row per (student, exercise): tracks sign-off status.
export const studentExerciseProgress = sqliteTable(
  "student_exercise_progress",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["not_started", "in_progress", "signed_off"],
    })
      .notNull()
      .default("not_started"),
    notes: text("notes"),
    signedOffByUserId: text("signed_off_by_user_id").references(
      () => users.id
    ),
    signedOffAt: integer("signed_off_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("student_exercise_unique").on(
      table.studentId,
      table.exerciseId
    ),
  ]
);

// ---------------------------------------------------------------------------
// Flight logbook
// ---------------------------------------------------------------------------

export const flightLogEntries = sqliteTable("flight_log_entries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: integer("date", { mode: "timestamp" }).notNull(),
  site: text("site").notNull(),
  aircraftType: text("aircraft_type").notNull(), // e.g. "PPG - Cumulus Frame / Ozone Motoprime"
  // Which equipment type the flight was on -- matches the training-type
  // vocabulary used everywhere else (PG/PPG/PPT). Replaced the old solo/dual
  // distinction (solo_ppg/solo_trike/dual_trike) as of v16, per Riaan's
  // request -- equipment type is what he actually wants tracked here.
  flightType: text("flight_type", {
    // "winching" added 16 Sep 2026 per Riaan's request -- a launch method
    // students log distinctly from PG/PPG/PPT equipment type, same "no
    // migration needed" story as the rest of this column (plain TEXT, no
    // CHECK constraint -- see the 0004 migration's own note).
    enum: ["pg", "ppg", "ppt", "winching"],
  }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  launches: integer("launches").notNull().default(1),
  exerciseCodesCovered: text("exercise_codes_covered"), // comma-separated codes
  notes: text("notes"),
  // Which instructor/CFI the student says flew this flight with them --
  // student-picked from a dropdown at logging time (Notes4 item 3). This is
  // distinct from verifiedByUserId below: that's whoever actually clicked
  // "Verify" (any instructor/CFI can), this is who was on the flight. Any
  // instructor/CFI can still countersign, but the named instructor and any
  // CFI are the ones expected to.
  instructorUserId: text("instructor_user_id").references(() => users.id),
  verified: integer("verified", { mode: "boolean" })
    .notNull()
    .default(false),
  verifiedByUserId: text("verified_by_user_id").references(() => users.id),
  verifiedAt: integer("verified_at", { mode: "timestamp" }),
  instructorComment: text("instructor_comment"), // instructor's note added at verification time
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ---------------------------------------------------------------------------
// Pilot Portal: licensed pilots (and club members). A pilotProfiles row can
// belong to a "pilot" user, or to a "cfi"/"instructor" user who is also a
// pilot -- either way it's one row per userId.
// ---------------------------------------------------------------------------

export const pilotProfiles = sqliteTable("pilot_profiles", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  // Self-declared at sign-up, verified by CFI/Admin like everything else
  // here. Only ever set for a genuine "pilot" role account -- a student
  // never has one (it's allocated on completion of their licence, which is
  // a later stage of this system, not sign-up).
  callSign: text("call_sign"),
  sahpaNumber: text("sahpa_number"),
  sahpaExpiryDate: integer("sahpa_expiry_date", { mode: "timestamp" }),
  caaLicenceFile: text("caa_licence_file"), // filename under data/uploads/<userId>/
  status: text("status", {
    enum: ["pending_verification", "active", "suspended"],
  })
    .notNull()
    .default("pending_verification"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// One row per licence/endorsement/instructor-rating a pilot has declared
// (checkbox list at sign-up, e.g. "sport_endorsement", "pg_instructor_a").
// Nothing here is shown on the pilot's dashboard until `verified` -- see
// SOW Section 3.7/3.8.
export const pilotEndorsements = sqliteTable(
  "pilot_endorsements",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pilotProfileId: text("pilot_profile_id")
      .notNull()
      .references(() => pilotProfiles.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // see ENDORSEMENT_OPTIONS in lib/pilot-endorsements.ts
    // When this was first declared/applied for -- at sign-up, or later via
    // the pilot's own "Apply" button on their dashboard (v17). Existing
    // pre-v17 rows get "now" as a stand-in via the column default, since
    // their real declare date wasn't recorded.
    declaredAt: integer("declared_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    verified: integer("verified", { mode: "boolean" })
      .notNull()
      .default(false),
    verifiedAt: integer("verified_at", { mode: "timestamp" }),
    verifiedByUserId: text("verified_by_user_id").references(() => users.id),
    // Decline-with-comment (added v18, Notes3 item 7) -- a CFI/Admin can
    // decline a single declared item with a reason, instead of the only
    // previous option (verify it, or leave it sitting unverified forever).
    // Declining and verifying are mutually exclusive: declineEndorsement
    // always clears verified/verifiedAt/verifiedByUserId, and
    // setEndorsementVerified (verifying) always clears these decline
    // fields back out -- whichever action ran most recently wins. Applying
    // again for a previously-declined item (applyForEndorsement) also
    // clears these fields, so a pilot can retry after fixing whatever the
    // comment flagged.
    declined: integer("declined", { mode: "boolean" }).notNull().default(false),
    declineReason: text("decline_reason"),
    declinedAt: integer("declined_at", { mode: "timestamp" }),
    declinedByUserId: text("declined_by_user_id").references(() => users.id),
  },
  (table) => [
    uniqueIndex("pilot_endorsement_unique").on(
      table.pilotProfileId,
      table.key
    ),
  ]
);

// ---------------------------------------------------------------------------
// Site-wide settings: a single row (id "singleton"), edited by the
// instructor and applied to every student -- e.g. the standard radio call
// script every student is taught. Not per-student; add a proper key/value
// shape here later if more settings like this show up.
// ---------------------------------------------------------------------------

export const siteSettings = sqliteTable("site_settings", {
  id: text("id").primaryKey(), // always "singleton"
  radioCallScript: text("radio_call_script"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ---------------------------------------------------------------------------
// Exams: a bank of multiple-choice theory tests. Content (sections,
// questions, options, marks, images) is loaded by db:seed from a JSON
// export of the official paper exam -- not editable from the UI yet.
// ---------------------------------------------------------------------------

export const exams = sqliteTable("exams", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(), // e.g. "pg-basic-licence-theory"
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  // Which of the roster's four headline exam badges this counts toward
  // (PG Exam / PPG Exam / PPT Exam / SAHPA RT exam). Null for anything that
  // doesn't map to one of those. No PPT-category exam has content loaded
  // yet -- same situation PPG was in before -- but the slot exists so one
  // can be added later without another migration.
  category: text("category", { enum: ["pg", "ppg", "ppt", "rt"] }),
  passPercent: integer("pass_percent").notNull().default(85),
  // Section code(s) that must be passed in full regardless of overall score
  // (e.g. "E" for Airlaw on the PG Basic Licence Theory Test), comma-separated.
  mustPassSections: text("must_pass_sections"),
  // Null = no clock (PG). Set (e.g. 60 for the RT exam) = a hard countdown
  // shown on screen; time running out auto-submits whatever's answered.
  timeLimitMinutes: integer("time_limit_minutes"),
  // Null = unlimited retries any time (PG). Set (e.g. 7 for the RT exam) =
  // a fail starts a cooldown before the student can start another attempt.
  retryCooldownDays: integer("retry_cooldown_days"),
  order: integer("order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const examSections = sqliteTable("exam_sections", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  examId: text("exam_id")
    .notNull()
    .references(() => exams.id, { onDelete: "cascade" }),
  code: text("code").notNull(), // "A".."F"
  name: text("name").notNull(),
  order: integer("order").notNull(),
  totalMarks: real("total_marks").notNull(),
});

export const examQuestions = sqliteTable("exam_questions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sectionId: text("section_id")
    .notNull()
    .references(() => examSections.id, { onDelete: "cascade" }),
  code: text("code").notNull(), // e.g. "B.7a" -- matches the master paper's numbering
  prompt: text("prompt").notNull(),
  // Alternate wording used ONLY on the printed/downloaded exam, for the
  // handful of questions whose on-screen multiple-choice phrasing ("Which
  // of the four diagrams (A-D)...") would give away that it was a
  // multiple-choice test. Null means the printed copy just uses `prompt`.
  printPrompt: text("print_prompt"),
  marks: real("marks").notNull(),
  order: integer("order").notNull(),
  stemImage: text("stem_image"), // filename under /exam-media/<exam-slug>/, if any
});

export const examOptions = sqliteTable("exam_options", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  questionId: text("question_id")
    .notNull()
    .references(() => examQuestions.id, { onDelete: "cascade" }),
  label: text("label", { enum: ["A", "B", "C", "D"] }).notNull(),
  text: text("text"), // null when the option is image-only
  image: text("image"), // filename under /exam-media/<exam-slug>/, null when text-only
  isCorrect: integer("is_correct", { mode: "boolean" })
    .notNull()
    .default(false),
  order: integer("order").notNull(),
});

// One row per attempt at an exam. A student normally has one, but a
// verified FAIL unlocks another (attemptNumber 2, 3, ...) via
// startNewAttempt -- so (studentId, examId) is intentionally NOT unique
// here. "Current" attempt for a student+exam = the most recent row.
export const examAttempts = sqliteTable("exam_attempts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  examId: text("exam_id")
    .notNull()
    .references(() => exams.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull().default(1),
  status: text("status", {
    enum: ["in_progress", "submitted", "verified"],
  })
    .notNull()
    .default("in_progress"),
  startedAt: integer("started_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  submittedAt: integer("submitted_at", { mode: "timestamp" }),
  verifiedAt: integer("verified_at", { mode: "timestamp" }),
  verifiedByUserId: text("verified_by_user_id").references(() => users.id),
  scoreMarks: real("score_marks"),
  totalMarks: real("total_marks"),
  scorePercent: real("score_percent"),
  passed: integer("passed", { mode: "boolean" }),
  mustPassSectionsOk: integer("must_pass_sections_ok", { mode: "boolean" }),
});

export const examAnswers = sqliteTable(
  "exam_answers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => examAttempts.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => examQuestions.id, { onDelete: "cascade" }),
    selectedOptionId: text("selected_option_id").references(
      () => examOptions.id
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("exam_answers_attempt_question_unique").on(
      table.attemptId,
      table.questionId
    ),
  ]
);
