/**
 * Seeds:
 *  - one instructor account (you)
 *  - one demo student account, so you have something to click through
 *  - the Section -> Exercise catalog, built from Appendix A of the
 *    EPIC Aviation DTO Procedures Manual (2022).
 *
 * The section groupings below are a PROPOSED progression, not something the
 * DTO manual itself defines -- it lists exercises 1-18C flat. Adjust freely
 * from Instructor -> Manage Syllabus once the app is running; this seed only
 * runs once against an empty database.
 *
 * Run with: npm run db:seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./index";
import {
  users,
  studentProfiles,
  pilotProfiles,
  pilotEndorsements,
  sections,
  exercises,
  exams,
  examSections,
  examQuestions,
  examOptions,
} from "./schema";
import pgBasicTheory from "./exam-data/pg-basic-licence-theory.json";
import rtRestrictedRadio from "./exam-data/rt-restricted-radio.json";
import ppgTheoreticalKnowledge from "./exam-data/ppg-theoretical-knowledge.json";

async function main() {
  console.log("Seeding database...");

  // --- Chief Flight Instructor account -------------------------------------
  const instructorEmail = "riaan@epic-aviation.co.za";
  const instructorTempPassword = "ChangeMe123!";
  const [instructor] = await db
    .insert(users)
    .values({
      email: instructorEmail,
      name: "Riaan Struwig",
      role: "cfi",
      passwordHash: await bcrypt.hash(instructorTempPassword, 12),
    })
    .onConflictDoNothing()
    .returning();

  // --- Demo student account ------------------------------------------------
  // consentSigned/indemnitySigned are set true here (unlike a real CFI-added
  // student via /instructor/students/new) -- these seeded accounts stand in
  // for an already fully-onboarded user, and defaulting to false would now
  // trip the Notes3-item-9 consent hard gate on every seeded login (16 Sep
  // 2026 -- caught by the regression suite, not a live report).
  const studentEmail = "demo.student@example.com";
  const studentTempPassword = "DemoStudent123!";
  const [studentUser] = await db
    .insert(users)
    .values({
      email: studentEmail,
      name: "Demo Student",
      role: "student",
      passwordHash: await bcrypt.hash(studentTempPassword, 12),
      consentSigned: true,
      consentSignedAt: new Date(),
      consentSignedName: "Demo Student",
      indemnitySigned: true,
      indemnitySignedAt: new Date(),
      indemnitySignedName: "Demo Student",
    })
    .onConflictDoNothing()
    .returning();

  if (studentUser) {
    await db
      .insert(studentProfiles)
      .values({
        userId: studentUser.id,
        status: "active",
        dtoNumber: "SACAA-0012DTO",
      })
      .onConflictDoNothing();
  }

  // --- Demo Pilot account ---------------------------------------------------
  // Seeded with an 8-month-old verified PPG Basic and one pending (declared,
  // unverified) add-on, so the v17 ratings ladder and the CFI/Admin "Pilots"
  // review queue both have something real to look at without Riaan having
  // to sign up a test pilot and backdate anything by hand.
  const pilotEmail = "demo.pilot@example.com";
  const pilotTempPassword = "DemoPilot123!";
  const [pilotUser] = await db
    .insert(users)
    .values({
      email: pilotEmail,
      name: "Demo Pilot",
      role: "pilot",
      passwordHash: await bcrypt.hash(pilotTempPassword, 12),
      accountStatus: "active",
      apexNumber: "APEX-000001",
      consentSigned: true,
      consentSignedAt: new Date(),
      consentSignedName: "Demo Pilot",
      indemnitySigned: true,
      indemnitySignedAt: new Date(),
      indemnitySignedName: "Demo Pilot",
    })
    .onConflictDoNothing()
    .returning();

  if (pilotUser) {
    const [pilotProfile] = await db
      .insert(pilotProfiles)
      .values({
        userId: pilotUser.id,
        callSign: "PPG-DEMO",
        status: "active",
      })
      .onConflictDoNothing()
      .returning();

    if (pilotProfile) {
      const eightMonthsAgo = new Date();
      eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);

      await db
        .insert(pilotEndorsements)
        .values([
          {
            pilotProfileId: pilotProfile.id,
            key: "ppg_footlaunch", // PPG Basic
            declaredAt: eightMonthsAgo,
            verified: true,
            verifiedAt: eightMonthsAgo,
          },
          {
            pilotProfileId: pilotProfile.id,
            key: "pg_winching",
            declaredAt: new Date(),
            verified: false,
          },
        ])
        .onConflictDoNothing();
    }
  }

  // --- Demo Office Manager (Admin) account ---------------------------------
  const adminEmail = "admin@epic-aviation.co.za";
  const adminTempPassword = "DemoAdmin123!";
  await db
    .insert(users)
    .values({
      email: adminEmail,
      name: "Demo Office Manager",
      role: "admin",
      passwordHash: await bcrypt.hash(adminTempPassword, 12),
    })
    .onConflictDoNothing();

  // --- Dummy role accounts (quick manual testing, one per role) ------------
  // Riaan-requested short-password logins, one per role, for fast manual
  // click-through testing -- separate from the "Demo ..." accounts above,
  // which carry more realistic seeded data. Emails are stored lowercase
  // since login() lowercases whatever's typed before matching.
  const dummyPassword = "1234";
  const dummyPasswordHash = await bcrypt.hash(dummyPassword, 12);

  const [dummyCfi] = await db
    .insert(users)
    .values({
      email: "cfi@apex.co.za",
      name: "Dummy CFI",
      role: "cfi",
      passwordHash: dummyPasswordHash,
    })
    .onConflictDoNothing()
    .returning();

  const [dummyInstructor] = await db
    .insert(users)
    .values({
      email: "instructor@apex.co.za",
      name: "Dummy Instructor",
      role: "instructor",
      passwordHash: dummyPasswordHash,
    })
    .onConflictDoNothing()
    .returning();

  const [dummyAdmin] = await db
    .insert(users)
    .values({
      email: "admin@apex.co.za",
      name: "Dummy Admin",
      role: "admin",
      passwordHash: dummyPasswordHash,
    })
    .onConflictDoNothing()
    .returning();

  const [dummyStudent] = await db
    .insert(users)
    .values({
      email: "student@apex.co.za",
      name: "Dummy Student",
      role: "student",
      passwordHash: dummyPasswordHash,
      consentSigned: true,
      consentSignedAt: new Date(),
      consentSignedName: "Dummy Student",
      indemnitySigned: true,
      indemnitySignedAt: new Date(),
      indemnitySignedName: "Dummy Student",
    })
    .onConflictDoNothing()
    .returning();
  if (dummyStudent) {
    await db
      .insert(studentProfiles)
      .values({
        userId: dummyStudent.id,
        status: "active",
        dtoNumber: "SACAA-0012DTO",
      })
      .onConflictDoNothing();
  }

  const [dummyPilot] = await db
    .insert(users)
    .values({
      email: "pilot@apex.co.za",
      name: "Dummy Pilot",
      role: "pilot",
      passwordHash: dummyPasswordHash,
      accountStatus: "active",
      apexNumber: "APEX-000002",
      consentSigned: true,
      consentSignedAt: new Date(),
      consentSignedName: "Dummy Pilot",
      indemnitySigned: true,
      indemnitySignedAt: new Date(),
      indemnitySignedName: "Dummy Pilot",
    })
    .onConflictDoNothing()
    .returning();
  if (dummyPilot) {
    await db
      .insert(pilotProfiles)
      .values({
        userId: dummyPilot.id,
        callSign: "DUMMY-01",
        status: "active",
      })
      .onConflictDoNothing();
  }

  // --- Sections & exercises (DTO Manual Appendix A) ------------------------
  const sectionData: {
    name: string;
    description: string;
    exercises: { code: string; title: string; description?: string }[];
  }[] = [
    {
      name: "Ground Handling & Pre-Flight Basics",
      description:
        "Familiarisation, pre/post-flight procedure, ground handling and early air experience.",
      exercises: [
        { code: "1", title: "Familiarisation with the aircraft", description: "Characteristics, systems, checklists, drills and controls (HG/PG or powered version)." },
        { code: "1E", title: "Emergency drills", description: "Action in the event of fire on the ground and in the air, electrical fire, escape drills." },
        { code: "2", title: "Preparation for and action after flight", description: "Equipment, external/internal checks, harness/seat adjustment, starting and shut-down, parking and securing." },
        { code: "3", title: "Air experience", description: "Introductory flight exercise, aircraft-type-specific flight." },
        { code: "4", title: "Effects of controls", description: "Primary and secondary effects, airspeed, power, trim, airmanship." },
        { code: "5", title: "Taxiing / ground handling", description: "Pre-launch checks, control of direction/speed, wind effects, marshalling signals, ground handling/kiting." },
        { code: "5E", title: "Emergencies (ground handling)", description: "Brake and steering failure, taxi emergencies, engine emergencies." },
      ],
    },
    {
      name: "Core Flight Skills",
      description:
        "Straight and level, climbing, descending, turning, slow flight and stall/spin avoidance.",
      exercises: [
        { code: "6", title: "Straight and level", description: "Cruise power, high-speed flight, inherent stability, PIO recovery, trim." },
        { code: "7", title: "Climbing", description: "Entry, normal and max-rate climb, levelling off, max angle of climb." },
        { code: "8", title: "Descending", description: "Entry, levelling off, glide/powered/cruise descent, instrument use." },
        { code: "9", title: "Turning", description: "Entry and maintaining medium turns, fault recognition/correction, climbing and descending turns." },
        { code: "10A", title: "Slow flight", description: "Safety checks, introduction to slow flight, recovery to normal climb, airspeed recognition." },
        { code: "10B", title: "Stalling", description: "Symptoms, recognition, B-line/full stall recovery with and without power, approach-to-stall recovery." },
        { code: "11", title: "Spin avoidance", description: "Stalling and recovery, descending and thermal turns." },
      ],
    },
    {
      name: "Circuit, Landings & First Solo",
      description:
        "Take-off, circuit work, landings, related emergencies and the first solo flight.",
      exercises: [
        { code: "12", title: "Take-off and climb to downwind position", description: "Pre-take-off checks, into-wind/crosswind take-off, launch and take-off techniques, noise abatement." },
        { code: "13", title: "Circuit, approach and landing", description: "Circuit procedures, powered/glide approach, crosswind landing, short/soft field technique, missed approach." },
        { code: "12/13E", title: "Emergencies (take-off/circuit)", description: "Abandoned take-off, engine failure after take-off, engine shutdown/restart, missed landing/go-around." },
        { code: "14", title: "First solo", description: "Instructor briefing, observation of flight and de-briefing, local-area procedures." },
      ],
    },
    {
      name: "Advanced Handling",
      description:
        "Advanced turning, forced and precautionary landings, low-level flying.",
      exercises: [
        { code: "15", title: "Advanced turning", description: "Steep turns (45deg), stalling in the turn and recovery, unusual attitude recovery incl. spiral dives." },
        { code: "16", title: "Forced landing without power", description: "Big ears/wing tuck, choice of landing area, gliding distance, descent plan, key positions, approach and landing." },
        { code: "17A", title: "Low level flying", description: "Safety considerations, speed/configuration, danger recognition, ridge soaring." },
        { code: "17B", title: "Precautionary landing", description: "Occasions necessitating, landing-area selection, circuit and approach, actions after landing." },
      ],
    },
    {
      name: "Navigation",
      description: "Flight planning, cross-country navigation, and GPS navigation.",
      exercises: [
        { code: "18A", title: "Navigation", description: "Flight planning, weather, route/airspace, calculations, departure and en-route procedure." },
        { code: "18B", title: "Navigation problems at lower levels and reduced visibility", description: "Actions prior to descending, hazard/terrain/turbulence awareness, joining the circuit." },
        { code: "18C", title: "Navigation with GPS" },
      ],
    },
  ];

  for (let sIdx = 0; sIdx < sectionData.length; sIdx++) {
    const s = sectionData[sIdx];
    const [section] = await db
      .insert(sections)
      .values({ name: s.name, description: s.description, order: sIdx + 1 })
      .returning();

    for (let eIdx = 0; eIdx < s.exercises.length; eIdx++) {
      const e = s.exercises[eIdx];
      await db
        .insert(exercises)
        .values({
          sectionId: section.id,
          code: e.code,
          title: e.title,
          description: e.description,
          order: eIdx + 1,
        })
        .onConflictDoNothing();
    }
  }

  // --- Exams ----------------------------------------------------------------
  type ParsedOption = {
    label: "A" | "B" | "C" | "D";
    text?: string | null;
    image?: string | null;
    correct: boolean;
  };
  type ParsedQuestion = {
    code: string;
    prompt: string;
    print_prompt?: string | null;
    marks: number;
    type: "text" | "image";
    options: ParsedOption[];
    stem_image?: string | null;
  };
  type ParsedSection = {
    letter: string;
    name: string;
    questions: ParsedQuestion[];
  };
  type ParsedExam = { sections: ParsedSection[] };

  const examDefs: {
    slug: string;
    title: string;
    subtitle: string;
    category: "pg" | "ppg" | "rt";
    passPercent: number;
    mustPassSections: string | null;
    timeLimitMinutes: number | null;
    retryCooldownDays: number | null;
    content: ParsedExam;
  }[] = [
    {
      slug: "pg-basic-licence-theory",
      title: "Basic Licence Theory Test",
      subtitle: "Paragliding Training Manual (Version February 2006)",
      category: "pg",
      passPercent: 85,
      mustPassSections: "E",
      timeLimitMinutes: null,
      retryCooldownDays: null,
      content: pgBasicTheory as ParsedExam,
    },
    {
      slug: "ppg-theoretical-knowledge",
      title: "PPG Theoretical Knowledge Test",
      subtitle: "Last Updated 2020-02-03 (Basjan/Riaan)",
      category: "ppg",
      passPercent: 85,
      // Section B (Air Law & Radio Procedures) mirrors the source paper's
      // "Air law questions to be passed, 100%" instruction.
      mustPassSections: "B",
      timeLimitMinutes: 90, // matches the PG exam's timer, per the #41 backlog note
      retryCooldownDays: null,
      content: ppgTheoreticalKnowledge as ParsedExam,
    },
    {
      slug: "rt-restricted-radio",
      title: "DTO Restricted Radio Exam No 2",
      subtitle: "Part 61, Appendix 1.5 -- The Pilot's Radio Handbook (D. Lempp)",
      category: "rt",
      passPercent: 75,
      mustPassSections: null,
      timeLimitMinutes: 60,
      retryCooldownDays: 7,
      content: rtRestrictedRadio as ParsedExam,
    },
  ];

  for (let examIdx = 0; examIdx < examDefs.length; examIdx++) {
    const def = examDefs[examIdx];
    const [exam] = await db
      .insert(exams)
      .values({
        slug: def.slug,
        title: def.title,
        subtitle: def.subtitle,
        category: def.category,
        passPercent: def.passPercent,
        mustPassSections: def.mustPassSections,
        timeLimitMinutes: def.timeLimitMinutes,
        retryCooldownDays: def.retryCooldownDays,
        order: examIdx + 1,
      })
      .onConflictDoNothing()
      .returning();

    if (!exam) continue; // already seeded

    for (let sIdx = 0; sIdx < def.content.sections.length; sIdx++) {
      const s = def.content.sections[sIdx];
      const totalMarks = s.questions.reduce((sum, q) => sum + q.marks, 0);
      const [section] = await db
        .insert(examSections)
        .values({
          examId: exam.id,
          code: s.letter,
          name: s.name,
          order: sIdx + 1,
          totalMarks,
        })
        .returning();

      for (let qIdx = 0; qIdx < s.questions.length; qIdx++) {
        const q = s.questions[qIdx];
        const [question] = await db
          .insert(examQuestions)
          .values({
            sectionId: section.id,
            code: q.code,
            prompt: q.prompt,
            printPrompt: q.print_prompt ?? null,
            marks: q.marks,
            order: qIdx + 1,
            stemImage: q.stem_image ?? null,
          })
          .returning();

        for (let oIdx = 0; oIdx < q.options.length; oIdx++) {
          const o = q.options[oIdx];
          await db.insert(examOptions).values({
            questionId: question.id,
            label: o.label,
            text: o.text ?? null,
            image: o.image ?? null,
            isCorrect: o.correct,
            order: oIdx + 1,
          });
        }
      }
    }

    console.log(`Seeded exam: ${def.title}`);
  }

  console.log("Done.");
  if (instructor) {
    console.log(`\nChief Flight Instructor login: ${instructorEmail} / ${instructorTempPassword}`);
  } else {
    console.log(`\nCFI account already existed (${instructorEmail}).`);
  }
  if (studentUser) {
    console.log(`Demo student login: ${studentEmail} / ${studentTempPassword}`);
  }
  if (pilotUser) {
    console.log(`Demo pilot login: ${pilotEmail} / ${pilotTempPassword}`);
  }
  console.log(`Demo Office Manager login: ${adminEmail} / ${adminTempPassword}`);

  console.log("\nDummy role accounts (one per role, password '1234' for all):");
  if (dummyCfi) console.log(`  CFI:        cfi@apex.co.za`);
  if (dummyInstructor) console.log(`  Instructor: instructor@apex.co.za`);
  if (dummyAdmin) console.log(`  Admin:      admin@apex.co.za`);
  if (dummyStudent) console.log(`  Student:    student@apex.co.za`);
  if (dummyPilot) console.log(`  Pilot:      pilot@apex.co.za`);

  console.log("\nChange these passwords after first login.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
